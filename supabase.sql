-- Bau-App: Datenbank für gemeinsame Daten mit Rechten
-- In Supabase unter "SQL Editor" → "New query" einfügen und auf "Run" klicken.
-- Das Skript kann auch über eine ältere Version laufen; vorhandene Daten bleiben erhalten.

create extension if not exists pgcrypto;

-- Tabellen ---------------------------------------------------------------

create table if not exists firmen (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  code_chef text unique not null default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  code_team text unique not null default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  erstellt timestamptz not null default now()
);

create table if not exists mitglieder (
  user_id uuid not null references auth.users on delete cascade,
  firma_id uuid not null references firmen on delete cascade,
  rolle text not null check (rolle in ('chef', 'team')),
  email text,
  primary key (user_id, firma_id)
);
alter table mitglieder add column if not exists rechte jsonb not null default '{}'::jsonb;
alter table mitglieder add column if not exists mitarbeiter_id text;

create table if not exists eintraege (
  firma_id uuid not null references firmen on delete cascade,
  sammlung text not null,
  id text not null,
  daten jsonb,
  geloescht boolean not null default false,
  geaendert timestamptz not null default clock_timestamp(),
  primary key (firma_id, sammlung, id)
);
create index if not exists eintraege_abgleich on eintraege (firma_id, geaendert);

create or replace function setze_geaendert() returns trigger language plpgsql as $$
begin
  new.geaendert := clock_timestamp();
  return new;
end $$;
drop trigger if exists t_geaendert on eintraege;
create trigger t_geaendert before insert or update on eintraege
  for each row execute function setze_geaendert();

-- Kein direkter Zugriff: alles läuft über die geprüften Funktionen unten
alter table firmen enable row level security;
alter table mitglieder enable row level security;
alter table eintraege enable row level security;
drop policy if exists "lesen" on eintraege;
drop policy if exists "anlegen" on eintraege;
drop policy if exists "aendern" on eintraege;
revoke all on firmen, mitglieder, eintraege from anon, authenticated;
drop function if exists meine_firmen();

-- Hilfsfunktionen ----------------------------------------------------------

create or replace function hat_recht(m mitglieder, p_recht text) returns boolean
  language sql immutable as $$
  select m.rolle = 'chef' or coalesce((m.rechte ->> p_recht)::boolean, false)
$$;

-- Felder, die nur mit dem Recht "kosten" übertragen werden
create or replace function sensible_felder(p_sammlung text) returns text[]
  language sql immutable as $$
  select case p_sammlung
    when 'mitarbeiter' then array['stundensatz']
    when 'baustellen' then array['angebot']
    when 'bestellungen' then array['preis']
    else array[]::text[] end
$$;

-- Was ein Mitglied von einem Eintrag sehen darf (null = gar nichts)
create or replace function fuer_mitglied(m mitglieder, p_sammlung text, p_daten jsonb) returns jsonb
  language sql immutable as $$
  select case
    when p_daten is null then null
    when p_sammlung in ('zeiten', 'stempel') and not hat_recht(m, 'alleZeiten')
      and (p_daten ->> 'mitarbeiterId') is distinct from m.mitarbeiter_id then null
    else
      (case when hat_recht(m, 'kosten') then p_daten else p_daten - sensible_felder(p_sammlung) end)
      -- Art der Abwesenheit (z. B. Krankenstand) sehen nur Planende und die Person selbst
      - (case when p_sammlung = 'abwesenheiten' and not hat_recht(m, 'planen')
               and (p_daten ->> 'mitarbeiterId') is distinct from m.mitarbeiter_id
          then array['art', 'notiz'] else array[]::text[] end)
    end
$$;

create or replace function ist_chef(p_firma uuid) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (select 1 from mitglieder where user_id = auth.uid() and firma_id = p_firma and rolle = 'chef')
$$;

-- Firma und Mitgliedschaft --------------------------------------------------

drop function if exists meine_firma();
create function meine_firma() returns json
  language sql security definer stable set search_path = public as $$
  select json_build_object(
    'id', f.id, 'name', f.name, 'rolle', m.rolle, 'rechte', m.rechte, 'mitarbeiter_id', m.mitarbeiter_id,
    'code_chef', case when m.rolle = 'chef' then f.code_chef end,
    'code_team', case when m.rolle = 'chef' then f.code_team end)
  from mitglieder m join firmen f on f.id = m.firma_id
  where m.user_id = auth.uid()
  order by (m.rolle = 'chef') desc
  limit 1
$$;

create or replace function firma_anlegen(p_name text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare f uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  insert into firmen (name) values (p_name) returning id into f;
  insert into mitglieder (user_id, firma_id, rolle, email) values (auth.uid(), f, 'chef', auth.jwt() ->> 'email');
  return f;
end $$;

create or replace function firma_beitreten(p_code text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare f uuid; r text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select id, case when code_chef = p_code then 'chef' else 'team' end into f, r
    from firmen where code_chef = p_code or code_team = p_code;
  if f is null then raise exception 'Code ungültig'; end if;
  insert into mitglieder (user_id, firma_id, rolle, email) values (auth.uid(), f, r, auth.jwt() ->> 'email')
    on conflict (user_id, firma_id) do nothing;
  return f;
end $$;

create or replace function mitglieder_liste(p_firma uuid)
  returns table (user_id uuid, email text, rolle text, rechte jsonb, mitarbeiter_id text)
  language plpgsql security definer stable set search_path = public as $$
begin
  if not ist_chef(p_firma) then raise exception 'Nur für Chefs'; end if;
  return query
    select m.user_id, m.email, m.rolle, m.rechte, m.mitarbeiter_id
    from mitglieder m where m.firma_id = p_firma
    order by (m.rolle = 'chef') desc, m.email;
end $$;

create or replace function mitglied_aendern(p_firma uuid, p_user uuid, p_rolle text, p_rechte jsonb, p_mitarbeiter text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not ist_chef(p_firma) then raise exception 'Nur für Chefs'; end if;
  if p_rolle not in ('chef', 'team') then raise exception 'Ungültige Rolle'; end if;
  if p_rolle = 'team' and not exists (
    select 1 from mitglieder where firma_id = p_firma and rolle = 'chef' and user_id <> p_user
  ) then raise exception 'Mindestens ein Chef muss bleiben'; end if;
  update mitglieder
    set rolle = p_rolle, rechte = coalesce(p_rechte, '{}'::jsonb), mitarbeiter_id = nullif(p_mitarbeiter, '')
    where firma_id = p_firma and user_id = p_user;
end $$;

create or replace function mitglied_entfernen(p_firma uuid, p_user uuid)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not ist_chef(p_firma) then raise exception 'Nur für Chefs'; end if;
  if p_user = auth.uid() then raise exception 'Du kannst dich nicht selbst entfernen'; end if;
  delete from mitglieder where firma_id = p_firma and user_id = p_user;
end $$;

-- Abgleich -----------------------------------------------------------------

create or replace function abgleich_holen(p_firma uuid, p_seit timestamptz, p_limit int default 500)
  returns table (sammlung text, id text, daten jsonb, geloescht boolean, geaendert timestamptz)
  language plpgsql security definer stable set search_path = public as $$
declare m mitglieder;
begin
  select * into m from mitglieder x where x.user_id = auth.uid() and x.firma_id = p_firma;
  if not found then raise exception 'Kein Zugriff'; end if;
  return query
    select e.sammlung, e.id, fuer_mitglied(m, e.sammlung, e.daten), e.geloescht, e.geaendert
    from eintraege e
    where e.firma_id = p_firma
      and e.geaendert > p_seit
      and (e.geloescht or fuer_mitglied(m, e.sammlung, e.daten) is not null)
    order by e.geaendert
    limit least(greatest(p_limit, 1), 1000);
end $$;

create or replace function abgleich_senden(p_firma uuid, p_zeilen jsonb) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  m mitglieder;
  z jsonb;
  s text;
  zid text;
  alt eintraege;
  vorhanden boolean;
  neu jsonb;
  erlaubt boolean;
  felder text[];
  abgelehnt jsonb := '[]'::jsonb;
  sichtbar jsonb;
begin
  select * into m from mitglieder x where x.user_id = auth.uid() and x.firma_id = p_firma;
  if not found then raise exception 'Kein Zugriff'; end if;

  for z in select value from jsonb_array_elements(p_zeilen) loop
    s := z ->> 'sammlung';
    zid := z ->> 'id';
    select * into alt from eintraege e where e.firma_id = p_firma and e.sammlung = s and e.id = zid;
    vorhanden := found and not alt.geloescht and alt.daten is not null;
    neu := case when coalesce((z ->> 'geloescht')::boolean, false) then null else z -> 'daten' end;

    erlaubt := case
      when m.rolle = 'chef' then true
      when s in ('mitarbeiter', 'meta', 'unterweisungen') then false
      when s = 'abwesenheiten' then hat_recht(m, 'planen')
      when s = 'dokumente' then neu is not null or hat_recht(m, 'stammdaten')
      when s = 'baustellen' then hat_recht(m, 'stammdaten')
      when s = 'geraete' then hat_recht(m, 'stammdaten') or (vorhanden and neu is not null)
      when s = 'plan' then hat_recht(m, 'planen')
      when s in ('zeiten', 'stempel') then hat_recht(m, 'alleZeiten') or (
        m.mitarbeiter_id is not null
        and (neu is null or neu ->> 'mitarbeiterId' = m.mitarbeiter_id)
        and (not vorhanden or alt.daten ->> 'mitarbeiterId' = m.mitarbeiter_id))
      else true end;

    if not erlaubt then
      sichtbar := case when vorhanden then fuer_mitglied(m, s, alt.daten) end;
      abgelehnt := abgelehnt || jsonb_build_array(jsonb_build_object(
        'sammlung', s, 'id', zid, 'daten', sichtbar, 'geloescht', sichtbar is null));
      continue;
    end if;

    -- Ohne Recht "kosten": gesendete Preise ignorieren, gespeicherte behalten
    if neu is not null and not hat_recht(m, 'kosten') then
      felder := sensible_felder(s);
      neu := neu - felder;
      if vorhanden then
        neu := neu || coalesce(
          (select jsonb_object_agg(k, v) from jsonb_each(alt.daten) as t(k, v) where k = any (felder)),
          '{}'::jsonb);
      end if;
    end if;

    insert into eintraege as e (firma_id, sammlung, id, daten, geloescht)
      values (p_firma, s, zid, neu, neu is null)
      on conflict (firma_id, sammlung, id)
      do update set daten = excluded.daten, geloescht = excluded.geloescht;
  end loop;

  return abgelehnt;
end $$;

-- Bauherren-Link: öffentlich, aber nur mit geheimem Schlüssel und nur Freigegebenes --

create index if not exists eintraege_kunden on eintraege ((daten ->> 'kundenToken')) where sammlung = 'baustellen';

create or replace function kunden_ansicht(p_token text) returns json
  language plpgsql security definer stable set search_path = public as $$
declare b eintraege;
begin
  if p_token is null or length(p_token) < 16 then return null; end if;
  select * into b from eintraege e
    where e.sammlung = 'baustellen' and not e.geloescht
      and e.daten ->> 'kundenToken' = p_token
      and coalesce((e.daten ->> 'kundenFreigabe')::boolean, false)
    limit 1;
  if not found then return null; end if;
  return json_build_object(
    'firma', coalesce(
      (select x.daten ->> 'name' from eintraege x where x.firma_id = b.firma_id and x.sammlung = 'meta' and x.id = 'firma' and not x.geloescht),
      (select f.name from firmen f where f.id = b.firma_id)),
    'baustelle', json_build_object(
      'name', b.daten ->> 'name', 'status', b.daten ->> 'status', 'ende', b.daten ->> 'ende',
      'fortschritt', b.daten ->> 'fortschritt', 'kundenInfo', b.daten ->> 'kundenInfo'),
    'fotos', coalesce((
      select json_agg(x order by x.datum desc) from (
        select e.daten ->> 'datum' as datum, e.daten ->> 'bereich' as bereich, e.daten ->> 'notiz' as notiz, e.daten ->> 'bild' as bild
        from eintraege e
        where e.firma_id = b.firma_id and e.sammlung = 'fotos' and not e.geloescht
          and e.daten ->> 'baustelleId' = b.id
          and coalesce((e.daten ->> 'fuerKunde')::boolean, false)
        order by e.daten ->> 'datum' desc
        limit 40) x), '[]'::json));
end $$;

-- Dateispeicher für Pläne und Dokumente (Ordner = Firma) --------------------

insert into storage.buckets (id, name, public) values ('dokumente', 'dokumente', false)
  on conflict (id) do nothing;

create or replace function darf_dateien(p_ordner text, p_loeschen boolean default false) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from mitglieder m
    where m.user_id = auth.uid() and m.firma_id::text = p_ordner
      and (not p_loeschen or hat_recht(m, 'stammdaten')))
$$;

drop policy if exists "Bau-App Dateien lesen" on storage.objects;
drop policy if exists "Bau-App Dateien hochladen" on storage.objects;
drop policy if exists "Bau-App Dateien löschen" on storage.objects;
create policy "Bau-App Dateien lesen" on storage.objects for select to authenticated
  using (bucket_id = 'dokumente' and darf_dateien((storage.foldername(name))[1]));
create policy "Bau-App Dateien hochladen" on storage.objects for insert to authenticated
  with check (bucket_id = 'dokumente' and darf_dateien((storage.foldername(name))[1]));
create policy "Bau-App Dateien löschen" on storage.objects for delete to authenticated
  using (bucket_id = 'dokumente' and darf_dateien((storage.foldername(name))[1], true));

grant execute on function kunden_ansicht(text) to anon, authenticated;

-- Nur angemeldete Nutzer dürfen die Funktionen aufrufen
revoke execute on function
  meine_firma(), firma_anlegen(text), firma_beitreten(text), mitglieder_liste(uuid),
  mitglied_aendern(uuid, uuid, text, jsonb, text), mitglied_entfernen(uuid, uuid),
  abgleich_holen(uuid, timestamptz, int), abgleich_senden(uuid, jsonb)
  from public, anon;
grant execute on function
  meine_firma(), firma_anlegen(text), firma_beitreten(text), mitglieder_liste(uuid),
  mitglied_aendern(uuid, uuid, text, jsonb, text), mitglied_entfernen(uuid, uuid),
  abgleich_holen(uuid, timestamptz, int), abgleich_senden(uuid, jsonb)
  to authenticated;
