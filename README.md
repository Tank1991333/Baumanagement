# Bau-App

Werkzeug für Baufirmen in Österreich mit 1 bis 100 Mitarbeitern. Läuft im Browser auf Handy, Tablet und PC, lässt sich wie eine App auf den Startbildschirm legen und funktioniert auch ohne Netz.

## Funktionen

**Baustelle**
- **Baustellen:** Adresse mit Navigation, Kunde, Nachkalkulation (Stunden und Kosten gegen Auftragssumme), Standort per GPS festlegen, Bauherren-Link.
- **Bautagebuch:** Wetter automatisch (Open-Meteo), Anwesende aus Zeiterfassung und Plantafel, Diktieren per Sprache, Schlechtwetter-Ausfallstunden, Druck als PDF.
- **Behinderungsanzeige:** aus dem Bautagebuch als fertiges Schreiben mit Bezug auf ÖNORM B 2110 und Vorbehalt von Mehrkosten und Fristverlängerung.
- **Mängel & Übernahme:** Mängel mit Fotos und Frist, Übernahmeprotokoll nach ÖNORM B 2110 mit Unterschrift beider Seiten.
- **Regie & Aufmaß:** Regieberichte mit Unterschrift des Bauherrn; Aufmaß mit Länge × Breite × Höhe × Anzahl und Abzügen, Druck und CSV.
- **Fotos & Pläne:** Fotodokumentation pro Bauabschnitt (einzelne Fotos für den Bauherrn freigebbar), Pläne und Dokumente als PDF.
- **Material & Geräte:** Materialanfragen, Lieferscheine fotografieren mit Texterkennung, Geräte mit Standort und Prüfterminen.

**Personal**
- **Zeiten:** Stempeluhr mit Pause nach § 11 AZG, optional mit Standort, Stundenkonto (Bau-KV 39 h, österreichische Feiertage), Export für Lohnverrechnung und Schlechtwetter-Auswertung für die BUAK.
- **Plantafel:** Wocheneinteilung mit Urlaub, Krankenstand, Zeitausgleich und Schulung; Feiertage werden angezeigt.
- **Team:** Personalnummer, Kostensatz, Wochenstunden, Unterweisungen nach § 14 ASchG mit Unterschrift, Rechte pro Person.
- **Mehrsprachig:** Deutsch, Türkisch, Bosnisch/Kroatisch/Serbisch, Rumänisch, Polnisch, Ungarisch, Englisch. Die Bereiche für Arbeiter sind übersetzt; Büro-Funktionen und gedruckte Dokumente bleiben deutsch.

## Zwei Betriebsarten

**Ohne Einrichtung:** Alles bleibt auf dem einen Gerät. Gut zum Ausprobieren.

**Mit Supabase (kostenlos):** Alle arbeiten auf denselben Daten, mit Login und Rechten. Ohne Netz erfasste Änderungen werden später automatisch abgeglichen. Bauherren-Link und Pläne/Dokumente funktionieren nur in dieser Betriebsart.

### Supabase einrichten (ca. 10 Minuten)

1. Auf supabase.com kostenlos registrieren und ein Projekt anlegen (Region Frankfurt).
2. *SQL Editor → New query*, den Inhalt von `supabase.sql` einfügen, *Run*. Das Skript legt auch den Dateispeicher für Pläne an. Bei einer älteren Version einfach erneut ausführen; Daten bleiben erhalten.
3. *Authentication → Sign In / Providers → Email*: „Confirm email“ ausschalten, wenn Mitarbeiter sich ohne Bestätigungsmail anmelden sollen.
4. *Project Settings → API*: „Project URL“ und „anon public key“ kopieren.
5. Beim Hosting die Umgebungsvariablen `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` eintragen (siehe `.env.example`) und neu veröffentlichen.
6. In der App unter *Team → Firma und Konto*: Konto erstellen, Firma anlegen, den Mitarbeiter-Code weitergeben.
7. Unter *Team → Wer sieht was* jedes Konto seinem Namen zuordnen und die Rechte festlegen.

Kostenloser Tarif: 500 MB Datenbank und 1 GB Dateispeicher. Projekte, die eine Woche nicht benutzt werden, pausiert Supabase; sie lassen sich im Dashboard wieder starten.

### Wer sieht was

| Recht | Bedeutung |
|---|---|
| Chef / Büro | alles, inklusive Rechteverwaltung, Unterweisungen und Lohnexport |
| Kosten und Preise sehen | Stundensätze, Auftragssummen, Materialpreise, Nachkalkulation |
| Zeiten aller Mitarbeiter | fremde Stunden sehen und bearbeiten, für alle stempeln |
| Plantafel bearbeiten | einteilen, Abwesenheiten eintragen |
| Baustellen und Geräte verwalten | anlegen, bearbeiten, löschen |

Die Datenbank prüft die Rechte selbst: Preise und fremde Stundenzettel werden nicht an Geräte ohne dieses Recht geschickt, unerlaubte Änderungen lehnt der Server ab.

## Wichtige Hinweise

- **Standort beim Stempeln** ist standardmäßig aus. Der Chef schaltet es unter Team ein, jeder Mitarbeiter muss auf seinem Gerät zustimmen. Eine solche Kontrollmaßnahme kann in Österreich eine Betriebsvereinbarung oder die Zustimmung der Mitarbeiter erfordern. Vorher klären.
- **Vorlagen** für Behinderungsanzeige, Übernahmeprotokoll und Regiebericht sind Muster. Bei hohen Summen oder Streit vorher fachlich prüfen lassen.
- **Schlechtwetter-Export** ist eine Auswertung als Grundlage für die Meldung an die BUAK, kein offizielles Meldeformat.
- **Texterkennung** für Lieferscheine lädt beim ersten Einsatz etwa 10 MB (Tesseract) und braucht dafür Internet.

## Veröffentlichen

1. Repository auf GitHub anlegen und den Ordnerinhalt hochladen (ohne `node_modules`).
2. Hosting verbinden: **Cloudflare Pages** oder **Netlify** (kostenlos, gewerbliche Nutzung erlaubt). Vercel Hobby ist laut Vercel nur für nicht-kommerzielle Nutzung. Build: `npm run build`, Ausgabe: `dist`.
3. Jeder Push auf GitHub aktualisiert die App.

## Lokal starten

```bash
npm install
npm run dev
```
