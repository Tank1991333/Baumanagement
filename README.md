# Bau-App

Werkzeug für Baufirmen mit 1 bis 100 Mitarbeitern. Läuft im Browser auf Handy, Tablet und PC, lässt sich wie eine App auf den Startbildschirm legen und funktioniert auch ohne Netz.

## Funktionen

- **Übersicht:** Suche über alles, Erinnerungen (Fristen, Lieferungen, Geräteprüfungen, Unterweisungen), wer eingestempelt ist, fehlende Tagesberichte. Auf Wunsch als Mitteilung aufs Handy.
- **Baustellen:** Adresse mit Navigation, Kunde, Telefon und **Nachkalkulation** (Stunden gegen Kalkulation, Lohn- und Materialkosten gegen Auftragssumme).
- **Zeiten:** Stempeluhr mit Pausenabzug nach ArbZG, Vorschlag aus der Plantafel, Monatsliste, CSV und **Export fürs Lohnbüro** (Personalnummer, Tag, Stunden).
- **Plantafel:** Wochenplanung wer wo arbeitet, Vorwoche übernehmen. Mitarbeiter sehen ihren eigenen Einsatzplan.
- **Bautagebuch:** Tagesbericht mit Wetter, Anwesenden, Leistungen und Behinderungen, Druck als PDF.
- **Mängel & Abnahme:** Mängel mit mehreren Fotos, Frist und Zuständigem. **Abnahmeprotokoll** mit Unterschrift beider Seiten.
- **Regieberichte:** Zusatzarbeiten mit Stunden, Material und Geräten, **Unterschrift des Bauherrn auf dem Handy**, PDF.
- **Fotos:** Fotodokumentation pro Baustelle und Bauabschnitt, als PDF druckbar.
- **Material & Geräte:** Materialanfragen mit Status und Liefertermin, Geräteverzeichnis mit Standort und Prüfterminen.
- **Team:** Mitarbeiter mit Personalnummer, Kostensatz und Unterweisungsdatum, Hell-/Dunkelmodus, Datensicherung.

## Zwei Betriebsarten

**Ohne Einrichtung:** Alles bleibt auf dem einen Gerät. Gut zum Ausprobieren oder für den Ein-Mann-Betrieb.

**Mit Supabase (kostenlos):** Alle arbeiten auf denselben Daten, mit Login und Rollen (Chef/Büro und Mitarbeiter). Änderungen ohne Netz werden später automatisch abgeglichen.

### Supabase einrichten (ca. 10 Minuten)

1. Auf supabase.com kostenlos registrieren und ein Projekt anlegen (Region Frankfurt).
2. *SQL Editor → New query*, den Inhalt von `supabase.sql` einfügen, *Run*.
3. *Authentication → Sign In / Providers → Email*: „Confirm email“ ausschalten, wenn Mitarbeiter sich ohne Bestätigungsmail anmelden sollen.
4. *Project Settings → API*: „Project URL“ und „anon public key“ kopieren.
5. Beim Hosting zwei Umgebungsvariablen eintragen (siehe `.env.example`): `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY`. Danach neu veröffentlichen.
6. In der App unter *Team → Firma und Konto*: Konto erstellen, Firma anlegen. Den Mitarbeiter-Code an das Team weitergeben.
7. Unter *Team → Wer sieht was* jedes Konto seinem Namen zuordnen und die Rechte festlegen.

Wer eine ältere Version eingerichtet hat, führt `supabase.sql` einfach noch einmal aus. Vorhandene Daten bleiben erhalten.

### Wer sieht was

Unter *Team → Wer sieht was* legt der Chef pro Konto fest:

| Recht | Bedeutung |
|---|---|
| Chef / Büro | alles, inklusive Rechteverwaltung und Lohnexport |
| Kosten und Preise sehen | Stundensätze, Auftragssummen, Materialpreise, Nachkalkulation |
| Zeiten aller Mitarbeiter | fremde Stunden sehen, nachtragen, korrigieren, für alle stempeln |
| Plantafel bearbeiten | alle Mitarbeiter einteilen |
| Baustellen und Geräte verwalten | anlegen, bearbeiten, löschen |

Vorlagen: *Mitarbeiter* (nichts davon), *Polier* (Zeiten und Plantafel), *Bauleiter* (alles außer Chef). Ohne Rechte sieht man nur die eigenen Stunden und den eigenen Einsatzplan, dazu Baustellen, Mängel, Bautagebuch, Regieberichte, Fotos und Material ohne Preise.

Die Rechte prüft die Datenbank, nicht nur die App: Preise und fremde Stundenzettel werden gar nicht erst an Geräte ohne dieses Recht geschickt, und unerlaubte Änderungen lehnt der Server ab. Werden Rechte entzogen, löscht die App beim nächsten Abgleich ihre lokale Kopie und lädt nur noch das Erlaubte.

Hinweise zum kostenlosen Tarif: 500 MB Datenbank reichen für viele tausend Fotos in der verkleinerten Form der App. Projekte, die eine Woche lang nicht benutzt werden, pausiert Supabase und sie müssen im Dashboard wieder gestartet werden.

## Veröffentlichen

1. Neues Repository auf GitHub anlegen und den Ordnerinhalt hochladen (ohne `node_modules`).
2. Hosting verbinden und das Repository importieren. Build: `npm run build`, Ausgabeordner: `dist`.
   - **Vercel:** Der kostenlose Hobby-Tarif ist laut Vercel nur für private, nicht-kommerzielle Nutzung gedacht. Für den Firmenbetrieb den Pro-Tarif nehmen oder:
   - **Cloudflare Pages** oder **Netlify:** kostenlose Tarife, die auch gewerblich genutzt werden dürfen. Beide erkennen Vite automatisch.
3. Jeder Push auf GitHub aktualisiert die App.

Auf dem Handy die Seite öffnen und „Zum Home-Bildschirm“ wählen.

## Lokal starten

```bash
npm install
npm run dev
```
