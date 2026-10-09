import { useState } from 'react'
import { uid, heute, fmtDatum, esc, absatz, drucken, unterschriftHtml, del } from '../store'
import { Feld, Kopf, Leer, Formular, Signatur, TextFeld, BaustellenAuswahl } from '../ui.jsx'

const THEMEN = {
  'Jährliche Unterweisung (§ 14 ASchG)':
    'Gefahren auf Baustellen, Absturzsicherung und Öffnungen, persönliche Schutzausrüstung (Helm, Sicherheitsschuhe, Warnkleidung, Gehör- und Augenschutz), Ordnung und Verkehrswege, Arbeitsmittel und ihre Prüfung, Lärm und Staub, Erste Hilfe und Notruf 144, Brandschutz, Verhalten bei Unfällen, Alkohol- und Drogenverbot.',
  'Erstunterweisung bei Eintritt':
    'Betriebliche Abläufe, Ansprechpersonen (Polier, Ersthelfer, Sicherheitsvertrauensperson), Gefahren am Arbeitsplatz, PSA-Ausgabe, Sammelplatz und Notruf, Meldung von Unfällen und Beinaheunfällen.',
  'Gerüste': 'Nur freigegebene Gerüste benutzen, keine Änderungen ohne Befugnis, Seitenschutz vollständig, Beläge und Verankerung prüfen, Lasten beachten.',
  'Absturzsicherung / Dacharbeiten': 'Kollektivschutz vor persönlicher Schutzausrüstung, Anschlagpunkte, Auffanggurt anlegen und prüfen, Öffnungen sichern, Wetter (Wind, Nässe, Eis).',
  'Arbeitsmittel und Maschinen': 'Bestimmungsgemäße Verwendung, Schutzeinrichtungen nicht entfernen, Sichtprüfung vor Benutzung, Mängel melden, Prüffristen nach AM-VO.',
  'Arbeitsstoffe': 'Sicherheitsdatenblätter, Kennzeichnung, Hautschutz, Lagerung, Zement und Quarzstaub, Lösungsmittel.',
  'Baustellenspezifisch': '',
}
const NEU = () => ({ datum: heute(), thema: 'Jährliche Unterweisung (§ 14 ASchG)', inhalt: THEMEN['Jährliche Unterweisung (§ 14 ASchG)'], baustelleId: '', unterweiser: '', zaehltJaehrlich: true, teilnehmer: [] })

export default function Unterweisungen({ daten, setDaten }) {
  const [form, setForm] = useState(null)
  const name = id => daten.mitarbeiter.find(m => m.id === id)?.name ?? '–'
  const bs = id => daten.baustellen.find(b => b.id === id)?.name

  const umschalten = id =>
    setForm(x => ({
      ...x,
      teilnehmer: x.teilnehmer.some(t => t.mitarbeiterId === id) ? x.teilnehmer.filter(t => t.mitarbeiterId !== id) : [...x.teilnehmer, { mitarbeiterId: id, unterschrift: '' }],
    }))

  const speichern = e => {
    e.preventDefault()
    if (!form.teilnehmer.length) return alert('Bitte Teilnehmer auswählen.')
    const eintrag = { ...form, id: form.id || uid() }
    const unterschrieben = new Set(form.teilnehmer.filter(t => t.unterschrift).map(t => t.mitarbeiterId))
    setDaten(d => ({
      ...d,
      unterweisungen: [eintrag, ...d.unterweisungen.filter(u => u.id !== eintrag.id)],
      mitarbeiter: form.zaehltJaehrlich
        ? d.mitarbeiter.map(m => (unterschrieben.has(m.id) && (!m.unterweisung || m.unterweisung < form.datum) ? { ...m, unterweisung: form.datum } : m))
        : d.mitarbeiter,
    }))
    setForm(null)
  }

  const druck = u =>
    drucken('Unterweisungsnachweis', `
      <table class="k">
        <tr><td>Datum</td><td>${esc(fmtDatum(u.datum))}</td></tr>
        <tr><td>Thema</td><td>${esc(u.thema)}</td></tr>
        ${u.baustelleId ? `<tr><td>Baustelle</td><td>${esc(bs(u.baustelleId) ?? '')}</td></tr>` : ''}
        <tr><td>Unterwiesen durch</td><td>${esc(u.unterweiser)}</td></tr>
      </table>
      <h2>Inhalte</h2><p>${absatz(u.inhalt)}</p>
      <h2>Teilnehmer</h2>
      <p style="font-size:9pt">Mit meiner Unterschrift bestätige ich, an der Unterweisung teilgenommen und die Inhalte verstanden zu haben.</p>
      <table><tr><th>Name</th><th>Unterschrift</th></tr>${u.teilnehmer
        .map(t => `<tr><td>${esc(name(t.mitarbeiterId))}</td><td>${t.unterschrift ? `<img src="${t.unterschrift}" style="height:44px">` : ''}</td></tr>`)
        .join('')}</table>
      <div class="sig">${unterschriftHtml('', 'Unterweisende Person: ' + (u.unterweiser || ''))}<div style="border:0"></div></div>`, daten.firma)

  const liste = [...daten.unterweisungen].sort((a, b) => b.datum.localeCompare(a.datum))

  return (
    <>
      <Kopf titel="Unterweisungen">
        {!form && daten.mitarbeiter.length > 0 && <button onClick={() => setForm(NEU())}>Unterweisung durchführen</button>}
      </Kopf>
      {form && (
        <Formular
          titel={form.id ? 'Unterweisung bearbeiten' : 'Unterweisung durchführen'}
          onSubmit={speichern}
          onAbbrechen={() => setForm(null)}
          kannLoeschen={!!form.id}
          onLoeschen={() => { if (confirm('Nachweis löschen?')) { del(setDaten, 'unterweisungen', form.id); setForm(null) } }}
        >
          <Feld label="Datum"><input type="date" value={form.datum} onChange={e => setForm({ ...form, datum: e.target.value })} /></Feld>
          <Feld label="Thema">
            <select value={form.thema} onChange={e => setForm({ ...form, thema: e.target.value, inhalt: THEMEN[e.target.value] ?? form.inhalt, zaehltJaehrlich: e.target.value.startsWith('Jährlich') || e.target.value.startsWith('Erst') })}>
              {Object.keys(THEMEN).map(x => <option key={x}>{x}</option>)}
            </select>
          </Feld>
          <Feld label="Baustelle (optional)">
            <select value={form.baustelleId} onChange={e => setForm({ ...form, baustelleId: e.target.value })}>
              <option value="">Allgemein</option>
              {daten.baustellen.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Feld>
          <Feld label="Unterwiesen durch"><input value={form.unterweiser} onChange={e => setForm({ ...form, unterweiser: e.target.value })} /></Feld>
          <TextFeld label="Inhalte" value={form.inhalt} onChange={v => setForm(x => ({ ...x, inhalt: v }))} rows={4} />
          <label className="recht breit">
            <input type="checkbox" checked={form.zaehltJaehrlich} onChange={e => setForm({ ...form, zaehltJaehrlich: e.target.checked })} />
            <span><b>Gilt als jährliche Sicherheitsunterweisung</b><span className="leise">setzt bei allen, die unterschrieben haben, das Unterweisungsdatum</span></span>
          </label>
          <fieldset className="feld breit">
            <legend>Teilnehmer</legend>
            <div className="chips">
              {daten.mitarbeiter.filter(m => m.aktiv !== false).map(m => {
                const an = form.teilnehmer.some(t => t.mitarbeiterId === m.id)
                return (
                  <label key={m.id} className={'chip' + (an ? ' an' : '')}>
                    <input type="checkbox" checked={an} onChange={() => umschalten(m.id)} />
                    {m.name}
                  </label>
                )
              })}
            </div>
          </fieldset>
          {form.teilnehmer.map(tn => (
            <Signatur
              key={tn.mitarbeiterId}
              label={`Unterschrift ${name(tn.mitarbeiterId)}`}
              wert={tn.unterschrift}
              onChange={v => setForm(x => ({ ...x, teilnehmer: x.teilnehmer.map(y => (y.mitarbeiterId === tn.mitarbeiterId ? { ...y, unterschrift: v } : y)) }))}
            />
          ))}
        </Formular>
      )}
      {liste.length === 0 ? (
        <Leer titel="Noch keine Unterweisungen" text="Thema wählen, Inhalte durchgehen, jeder unterschreibt am Handy. Der Nachweis ist bei Kontrollen durch das Arbeitsinspektorat sofort griffbereit." />
      ) : (
        <ul className="liste">
          {liste.map(u => (
            <li key={u.id} className="zeile">
              <strong>{u.thema}</strong>
              <span className="leise">{fmtDatum(u.datum)}, {u.teilnehmer.filter(t => t.unterschrift).length} von {u.teilnehmer.length} unterschrieben</span>
              <span className="rechts knopfreihe eng">
                <button className="klein" onClick={() => setForm({ ...u })}>Bearbeiten</button>
                <button className="klein" onClick={() => druck(u)}>Drucken / PDF</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
