import { useState } from 'react'
import { add, upd, del, heute, wochenStart, plusTage, fmtKurz, fmtDatum, feiertag, abwesendAm, ABWESENHEIT } from '../store'
import { Feld, Kopf, Leer, Formular } from '../ui.jsx'
import { t } from '../i18n'

export default function Plan({ daten, setDaten, rechte, ich }) {
  const [woche, setWoche] = useState(wochenStart())
  const [form, setForm] = useState(null)
  const tage = [0, 1, 2, 3, 4, 5].map(i => plusTage(woche, i))
  const chef = rechte.planen
  const team = daten.mitarbeiter.filter(m => m.aktiv !== false)
  const offeneBs = daten.baustellen.filter(b => b.status !== 'abgeschlossen')
  const bs = id => daten.baustellen.find(b => b.id === id)?.name ?? ''
  const name = id => daten.mitarbeiter.find(m => m.id === id)?.name ?? '–'
  const eintrag = (datum, maId) => daten.plan.find(p => p.id === `${datum}_${maId}`)
  const farbe = id => {
    const i = daten.baustellen.findIndex(b => b.id === id)
    return i < 0 ? '' : 'f' + (i % 6)
  }

  const setzen = (datum, mitarbeiterId, baustelleId) => {
    const id = `${datum}_${mitarbeiterId}`
    setDaten(d => ({
      ...d,
      plan: [...d.plan.filter(p => p.id !== id), ...(baustelleId ? [{ id, datum, mitarbeiterId, baustelleId }] : [])],
    }))
  }

  const vorwoche = () => {
    const alt = daten.plan.filter(p => p.datum >= plusTage(woche, -7) && p.datum < woche)
    if (!alt.length) return alert('In der Vorwoche ist nichts eingeplant.')
    if (!confirm('Einteilung der Vorwoche übernehmen? Vorhandene Einträge werden überschrieben, Abwesenheiten und Feiertage bleiben frei.')) return
    const neu = alt
      .map(p => {
        const datum = plusTage(p.datum, 7)
        return { ...p, id: `${datum}_${p.mitarbeiterId}`, datum }
      })
      .filter(p => !feiertag(p.datum) && !abwesendAm(daten, p.mitarbeiterId, p.datum))
    const ids = new Set(neu.map(p => p.id))
    setDaten(d => ({ ...d, plan: [...d.plan.filter(p => !ids.has(p.id)), ...neu] }))
  }

  const speichern = e => {
    e.preventDefault()
    if (!form.mitarbeiterId || !form.von) return
    const x = { ...form, bis: form.bis && form.bis >= form.von ? form.bis : form.von }
    x.id ? upd(setDaten, 'abwesenheiten', x.id, x) : add(setDaten, 'abwesenheiten', x)
    setForm(null)
  }

  const navi = (
    <>
      <button className="klein" onClick={() => setWoche(plusTage(woche, -7))} aria-label="Vorige Woche">‹</button>
      <button className="klein" onClick={() => setWoche(wochenStart())}>Diese Woche</button>
      <button className="klein" onClick={() => setWoche(plusTage(woche, 7))} aria-label="Nächste Woche">›</button>
    </>
  )

  const abwListe = daten.abwesenheiten
    .filter(a => (a.bis || a.von) >= plusTage(heute(), -31) && (chef || a.mitarbeiterId === ich?.id))
    .sort((a, b) => a.von.localeCompare(b.von))

  const abwesenheiten = (
    <section className="block">
      <Kopf titel={chef ? 'Urlaub, Krankenstand, Zeitausgleich' : 'Meine Abwesenheiten'}>
        {chef && !form && team.length > 0 && (
          <button onClick={() => setForm({ mitarbeiterId: team[0].id, art: 'Urlaub', von: heute(), bis: heute(), notiz: '' })}>Abwesenheit eintragen</button>
        )}
      </Kopf>
      {form && (
        <Formular
          titel={form.id ? 'Abwesenheit bearbeiten' : 'Abwesenheit eintragen'}
          onSubmit={speichern}
          onAbbrechen={() => setForm(null)}
          kannLoeschen={!!form.id}
          onLoeschen={() => { del(setDaten, 'abwesenheiten', form.id); setForm(null) }}
        >
          <Feld label="Mitarbeiter">
            <select value={form.mitarbeiterId} onChange={e => setForm({ ...form, mitarbeiterId: e.target.value })}>
              {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Feld>
          <Feld label="Art">
            <select value={form.art} onChange={e => setForm({ ...form, art: e.target.value })}>
              {ABWESENHEIT.map(a => <option key={a}>{a}</option>)}
            </select>
          </Feld>
          <Feld label="Von"><input type="date" required value={form.von} onChange={e => setForm({ ...form, von: e.target.value })} /></Feld>
          <Feld label="Bis"><input type="date" value={form.bis} onChange={e => setForm({ ...form, bis: e.target.value })} /></Feld>
          <Feld label="Notiz" breit><input value={form.notiz ?? ''} onChange={e => setForm({ ...form, notiz: e.target.value })} /></Feld>
        </Formular>
      )}
      {abwListe.length === 0 ? (
        <Leer titel="Keine Abwesenheiten eingetragen" text="Eingetragene Abwesenheiten sperren die Plantafel und fließen ins Stundenkonto ein." />
      ) : (
        <ul className="liste">
          {abwListe.map(a => (
            <li key={a.id} className="zeile">
              <span className={'marke abw-' + (a.art || 'x').toLowerCase()}>{a.art ? t(a.art) : t('Abwesend')}</span>
              <strong>{name(a.mitarbeiterId)}</strong>
              <span className="leise">{fmtDatum(a.von)}{a.bis && a.bis !== a.von ? ` bis ${fmtDatum(a.bis)}` : ''}{a.notiz ? `, ${a.notiz}` : ''}</span>
              {chef && <button className="klein rechts" onClick={() => setForm({ notiz: '', ...a })}>Bearbeiten</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  if (!chef) {
    return (
      <>
        <Kopf titel="Mein Einsatzplan">{navi}</Kopf>
        {!ich ? (
          <Leer titel="Dein Konto ist keinem Mitarbeiter zugeordnet" text="Der Chef ordnet dein Konto unter Team → Wer sieht was deinem Namen zu." />
        ) : (
          <ul className="liste">
            {tage.map(tg => {
              const p = eintrag(tg, ich.id)
              const a = abwesendAm(daten, ich.id, tg)
              const ft = feiertag(tg)
              return (
                <li key={tg} className={'zeile' + (tg === heute() ? ' heute' : '')}>
                  <strong className="tagname">{fmtKurz(tg)}</strong>
                  <span className={p ? '' : 'leise'}>
                    {ft ? ft : a ? t(a.art || 'Abwesend') : p ? bs(p.baustelleId) : t('nicht eingeplant')}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        {ich && abwesenheiten}
      </>
    )
  }

  return (
    <>
      <Kopf titel="Plantafel">
        {navi}
        <button className="klein" onClick={vorwoche}>Vorwoche übernehmen</button>
      </Kopf>
      {team.length === 0 || offeneBs.length === 0 ? (
        <Leer titel="Plantafel noch leer" text="Lege zuerst Mitarbeiter und Baustellen an." />
      ) : (
        <div className="tafel-rahmen">
          <table className="tafel">
            <thead>
              <tr>
                <th scope="col">Mitarbeiter</th>
                {tage.map(tg => (
                  <th key={tg} scope="col" className={tg === heute() ? 'heute' : feiertag(tg) ? 'feiertag' : ''}>
                    {fmtKurz(tg)}
                    {feiertag(tg) && <span>{feiertag(tg)}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {team.map(m => (
                <tr key={m.id}>
                  <th scope="row">{m.name}<span>{m.rolle}</span></th>
                  {tage.map(tg => {
                    const a = abwesendAm(daten, m.id, tg)
                    if (a || feiertag(tg))
                      return <td key={tg} className="gesperrt"><span>{a ? t(a.art || 'Abwesend') : 'Feiertag'}</span></td>
                    const p = eintrag(tg, m.id)
                    return (
                      <td key={tg} className={p ? farbe(p.baustelleId) : ''}>
                        <select value={p?.baustelleId ?? ''} onChange={e => setzen(tg, m.id, e.target.value)} aria-label={`${m.name}, ${fmtKurz(tg)}`}>
                          <option value="">frei</option>
                          {offeneBs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="fussnote">Jeder Mitarbeiter sieht seinen Plan in der App, und die Stempeluhr schlägt die eingeplante Baustelle vor. Feiertage und Abwesenheiten sind gesperrt.</p>
      {abwesenheiten}
    </>
  )
}
