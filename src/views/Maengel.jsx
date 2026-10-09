import { useState } from 'react'
import { add, upd, del, heute, fmtDatum, esc, absatz, drucken, unterschriftHtml } from '../store'
import { Feld, Kopf, Leer, Formular, FotoAuswahl, Signatur, BaustellenAuswahl, TextFeld } from '../ui.jsx'
import { t } from '../i18n'

const ERGEBNIS = {
  abgenommen: 'Übernommen',
  vorbehalt: 'Übernommen unter Vorbehalt der aufgeführten Mängel',
  verweigert: 'Übernahme verweigert wegen wesentlicher Mängel',
}

const KURZ = { abgenommen: 'übernommen', vorbehalt: 'unter Vorbehalt', verweigert: 'verweigert' }

export default function Maengel({ daten, setDaten }) {
  const [form, setForm] = useState(null)
  const [abnahme, setAbnahme] = useState(null)
  const [status, setStatus] = useState('offen')
  const [filterBs, setFilterBs] = useState('alle')
  const f = k => e => setForm({ ...form, [k]: e.target.value })
  const fa = k => e => setAbnahme({ ...abnahme, [k]: e.target.value })
  const name = id => daten.mitarbeiter.find(m => m.id === id)?.name ?? ''
  const bsObj = id => daten.baustellen.find(b => b.id === id)
  const bs = id => bsObj(id)?.name ?? '–'
  const h = heute()

  const neu = () =>
    setForm({
      typ: 'Mangel', titel: '', beschreibung: '',
      baustelleId: filterBs !== 'alle' ? filterBs : daten.baustellen[0]?.id ?? '',
      verantwortlichId: '', frist: '', dringend: false, fotos: [], erledigt: false,
    })

  const speichern = e => {
    e.preventDefault()
    if (!form.titel.trim()) return
    form.id ? upd(setDaten, 'maengel', form.id, form) : add(setDaten, 'maengel', form)
    setForm(null)
  }

  const erledigen = m => upd(setDaten, 'maengel', m.id, { erledigt: !m.erledigt, erledigtAm: m.erledigt ? '' : h })

  const neueAbnahme = () => {
    const baustelleId = filterBs !== 'alle' ? filterBs : daten.baustellen[0]?.id ?? ''
    setAbnahme({
      baustelleId, datum: h, art: 'Förmliche Übernahme nach ÖNORM B 2110', teilnehmer: '',
      ergebnis: 'vorbehalt', bemerkung: '', nameAN: '', nameAG: bsObj(baustelleId)?.kunde ?? '',
      unterschriftAN: '', unterschriftAG: '',
    })
    setForm(null)
  }

  const abnahmeSpeichern = e => {
    e.preventDefault()
    const offenBeiAbnahme = daten.maengel
      .filter(m => m.baustelleId === abnahme.baustelleId && !m.erledigt && m.typ === 'Mangel')
      .map(m => ({ titel: m.titel, beschreibung: m.beschreibung, frist: m.frist }))
    const eintrag = { ...abnahme, maengel: abnahme.maengel ?? offenBeiAbnahme }
    abnahme.id ? upd(setDaten, 'abnahmen', abnahme.id, eintrag) : add(setDaten, 'abnahmen', eintrag)
    setAbnahme(null)
  }

  const abnahmeDrucken = a => {
    const b = bsObj(a.baustelleId)
    const liste = a.maengel?.length
      ? `<table><tr><th>Nr.</th><th>Mangel</th><th>Frist zur Beseitigung</th></tr>${a.maengel
          .map((m, i) => `<tr><td>${i + 1}</td><td><b>${esc(m.titel)}</b>${m.beschreibung ? '<br>' + absatz(m.beschreibung) : ''}</td><td>${esc(fmtDatum(m.frist))}</td></tr>`)
          .join('')}</table>`
      : '<p>Keine Mängel festgestellt.</p>'
    drucken('Übernahmeprotokoll', `
      <table class="k">
        <tr><td>Bauvorhaben</td><td>${esc(b?.name ?? '–')}<br>${esc(b?.adresse ?? '')}</td></tr>
        <tr><td>Auftraggeber</td><td>${esc(b?.kunde ?? '')}</td></tr>
        <tr><td>Auftragnehmer</td><td>${esc(daten.firma)}</td></tr>
        <tr><td>Datum</td><td>${esc(fmtDatum(a.datum))}</td></tr>
        <tr><td>Art</td><td>${esc(a.art)}</td></tr>
        <tr><td>Teilnehmer</td><td>${absatz(a.teilnehmer) || '–'}</td></tr>
        <tr><td>Ergebnis</td><td><b>${esc(ERGEBNIS[a.ergebnis])}</b></td></tr>
      </table>
      <h2>Festgestellte Mängel</h2>${liste}
      ${a.bemerkung ? `<h2>Bemerkungen und Vorbehalte</h2><p>${absatz(a.bemerkung)}</p>` : ''}
      <p style="font-size:9pt;margin-top:18px">Mit der Übernahme gehen in der Regel die Gefahr auf den Auftraggeber über und die Gewährleistungsfrist beginnt zu laufen. Bekannte Mängel und Vorbehalte (z. B. Vertragsstrafe/Pönale) sind im Protokoll festzuhalten.</p>
      <div class="sig">${unterschriftHtml(a.unterschriftAG, 'Auftraggeber: ' + (a.nameAG || ''))}${unterschriftHtml(a.unterschriftAN, 'Auftragnehmer: ' + (a.nameAN || ''))}</div>`, daten.firma)
  }

  const liste = daten.maengel
    .filter(m => status === 'alle' || (status === 'offen' ? !m.erledigt : m.erledigt))
    .filter(m => filterBs === 'alle' || m.baustelleId === filterBs)
    .sort((a, b) => Number(b.dringend) - Number(a.dringend) || (a.frist || '9999').localeCompare(b.frist || '9999'))
  const abnahmen = daten.abnahmen
    .filter(a => filterBs === 'alle' || a.baustelleId === filterBs)
    .sort((a, b) => b.datum.localeCompare(a.datum))

  return (
    <>
      <Kopf titel="Mängel & Aufgaben">
        <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Status filtern">
          <option value="offen">{t('Offen')}</option>
          <option value="erledigt">{t('Erledigt')}</option>
          <option value="alle">{t('Alle')}</option>
        </select>
        <BaustellenAuswahl daten={daten} value={filterBs} onChange={setFilterBs} alle label="Baustelle filtern" />
        {!form && !abnahme && <button className="primaer" onClick={neu}>{t('Neu erfassen')}</button>}
      </Kopf>

      {form && (
        <Formular
          titel={form.id ? 'Eintrag bearbeiten' : 'Mangel oder Aufgabe erfassen'}
          onSubmit={speichern}
          onAbbrechen={() => setForm(null)}
          kannLoeschen={!!form.id}
          onLoeschen={() => { if (confirm('Eintrag löschen?')) { del(setDaten, 'maengel', form.id); setForm(null) } }}
        >
          <Feld label="Art">
            <select value={form.typ} onChange={f('typ')}><option>Mangel</option><option>Aufgabe</option></select>
          </Feld>
          <Feld label="Dringlichkeit">
            <select value={form.dringend ? 'ja' : 'nein'} onChange={e => setForm({ ...form, dringend: e.target.value === 'ja' })}>
              <option value="nein">Normal</option><option value="ja">{t('Dringend')}</option>
            </select>
          </Feld>
          <Feld label="Kurzbeschreibung *" breit><input required value={form.titel} onChange={f('titel')} placeholder="z. B. Riss in Wand Treppenhaus EG" /></Feld>
          <TextFeld label="Details, Ort im Gebäude" value={form.beschreibung} onChange={v => setForm(x => ({ ...x, beschreibung: v }))} />
          <Feld label="Baustelle">
            <BaustellenAuswahl daten={daten} value={form.baustelleId} onChange={v => setForm({ ...form, baustelleId: v })} />
          </Feld>
          <Feld label="Zuständig">
            <select value={form.verantwortlichId} onChange={f('verantwortlichId')}>
              <option value="">Niemand</option>
              {daten.mitarbeiter.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Feld>
          <Feld label="Frist"><input type="date" value={form.frist} onChange={f('frist')} /></Feld>
          <FotoAuswahl fotos={form.fotos} onChange={fotos => setForm({ ...form, fotos })} />
        </Formular>
      )}

      {liste.length === 0 ? (
        <Leer titel={status === 'offen' ? 'Nichts offen' : 'Keine Einträge'} text="Mängel mit Fotos und Frist erfassen und abhaken, sobald sie behoben sind." />
      ) : (
        <ul className="liste maengel">
          {liste.map(m => (
            <li key={m.id} className={'mangel' + (m.erledigt ? ' erledigt' : '')}>
              <input type="checkbox" checked={m.erledigt} onChange={() => erledigen(m)} aria-label={'Erledigt: ' + m.titel} />
              <div className="mangel-text">
                <div>
                  <span className="marke">{m.typ}</span>
                  {m.dringend && !m.erledigt && <span className="marke dringend">dringend</span>}
                  {m.frist && !m.erledigt && m.frist < h && <span className="marke dringend">überfällig</span>}
                </div>
                <strong>{m.titel}</strong>
                <span className="leise">
                  {bs(m.baustelleId)}
                  {m.verantwortlichId ? `, ${name(m.verantwortlichId)}` : ''}
                  {m.frist ? `, Frist ${fmtDatum(m.frist)}` : ''}
                  {m.erledigt && m.erledigtAm ? `, erledigt am ${fmtDatum(m.erledigtAm)}` : ''}
                </span>
                {m.beschreibung && <p>{m.beschreibung}</p>}
                {m.fotos?.length > 0 && (
                  <div className="fotoraster klein">
                    {m.fotos.map((src, i) => <img key={i} src={src} alt={`Foto ${i + 1}: ${m.titel}`} />)}
                  </div>
                )}
              </div>
              <button className="klein" onClick={() => { setForm({ ...m }); setAbnahme(null) }}>Bearbeiten</button>
            </li>
          ))}
        </ul>
      )}

      <section className="block">
        <Kopf titel="Übernahmeprotokolle">
          {!abnahme && !form && daten.baustellen.length > 0 && <button onClick={neueAbnahme}>Übernahme protokollieren</button>}
        </Kopf>

        {abnahme && (
          <Formular
            titel={abnahme.id ? 'Übernahmeprotokoll bearbeiten' : 'Übernahme protokollieren'}
            onSubmit={abnahmeSpeichern}
            onAbbrechen={() => setAbnahme(null)}
            kannLoeschen={!!abnahme.id}
            onLoeschen={() => { if (confirm('Protokoll löschen?')) { del(setDaten, 'abnahmen', abnahme.id); setAbnahme(null) } }}
          >
            <Feld label="Baustelle" breit>
              <BaustellenAuswahl daten={daten} value={abnahme.baustelleId} onChange={v => setAbnahme({ ...abnahme, baustelleId: v, nameAG: abnahme.nameAG || bsObj(v)?.kunde || '' })} />
            </Feld>
            <Feld label="Datum"><input type="date" value={abnahme.datum} onChange={fa('datum')} /></Feld>
            <Feld label="Art">
              <select value={abnahme.art} onChange={fa('art')}>
                <option>Förmliche Übernahme nach ÖNORM B 2110</option>
                <option>Teilübernahme nach ÖNORM B 2110</option>
                <option>Übernahme (Werkvertrag nach ABGB)</option>
              </select>
            </Feld>
            <Feld label="Teilnehmer" breit><textarea rows="2" value={abnahme.teilnehmer} onChange={fa('teilnehmer')} placeholder="Name und Funktion, je Zeile eine Person" /></Feld>
            <Feld label="Ergebnis" breit>
              <select value={abnahme.ergebnis} onChange={fa('ergebnis')}>
                {Object.entries(ERGEBNIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Feld>
            <p className="fussnote breit">
              Ins Protokoll kommen automatisch alle offenen Mängel dieser Baustelle
              ({daten.maengel.filter(m => m.baustelleId === abnahme.baustelleId && !m.erledigt && m.typ === 'Mangel').length} Stück). Erfasse vorher alles, was bei der Begehung auffällt.
            </p>
            <TextFeld label="Bemerkungen, Vorbehalte (z. B. Pönale)" value={abnahme.bemerkung} onChange={v => setAbnahme(a => ({ ...a, bemerkung: v }))} rows={2} />
            <Feld label="Name Auftraggeber"><input value={abnahme.nameAG} onChange={fa('nameAG')} /></Feld>
            <Feld label="Name Auftragnehmer"><input value={abnahme.nameAN} onChange={fa('nameAN')} /></Feld>
            <Signatur label="Unterschrift Auftraggeber" wert={abnahme.unterschriftAG} onChange={v => setAbnahme(a => ({ ...a, unterschriftAG: v }))} />
            <Signatur label="Unterschrift Auftragnehmer" wert={abnahme.unterschriftAN} onChange={v => setAbnahme(a => ({ ...a, unterschriftAN: v }))} />
          </Formular>
        )}

        {abnahmen.length === 0 ? (
          <Leer titel="Noch keine Übernahmen" text="Das Protokoll übernimmt die offenen Mängel, wird vor Ort unterschrieben und lässt sich als PDF speichern." />
        ) : (
          <ul className="liste">
            {abnahmen.map(a => (
              <li key={a.id} className="zeile">
                <strong>{bs(a.baustelleId)}</strong>
                <span className="leise">{fmtDatum(a.datum)}, {KURZ[a.ergebnis]}, {a.maengel?.length ?? 0} Mängel</span>
                <span className="rechts knopfreihe eng">
                  <button className="klein" onClick={() => { setAbnahme({ ...a }); setForm(null) }}>Bearbeiten</button>
                  <button className="klein" onClick={() => abnahmeDrucken(a)}>Drucken / PDF</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
