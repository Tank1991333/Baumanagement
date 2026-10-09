import { useState } from 'react'
import { add, upd, del, heute, fmtDatum, esc, absatz, drucken, plusTage } from '../store'
import { wetterFuerTag } from '../wetter'
import { Feld, Kopf, Leer, Formular, TextFeld, BaustellenAuswahl } from '../ui.jsx'
import { t } from '../i18n'

const WETTER = ['Sonnig', 'Bewölkt', 'Regen', 'Starkregen', 'Schnee', 'Frost', 'Wind / Sturm', 'Hitze', 'Nebel']
const SW_GRUND = ['Regen', 'Schnee', 'Frost', 'Sturm', 'Hitze', 'Sonstiges']

export default function Tagebuch({ daten, setDaten }) {
  const [form, setForm] = useState(null)
  const [anzeige, setAnzeige] = useState(null)
  const [filterBs, setFilterBs] = useState('alle')
  const [wetterInfo, setWetterInfo] = useState('')
  const f = k => e => setForm({ ...form, [k]: e.target.value })
  const name = id => daten.mitarbeiter.find(m => m.id === id)?.name ?? 'Unbekannt'
  const bs = id => daten.baustellen.find(b => b.id === id)

  const neu = () => {
    setWetterInfo('')
    setForm({
      baustelleId: daten.baustellen.find(b => b.status === 'laufend')?.id ?? daten.baustellen[0]?.id ?? '',
      datum: heute(), wetter: 'Sonnig', temperatur: '', wetterDetail: '', anwesend: [],
      leistungen: '', lieferungen: '', behinderungen: '', besucher: '',
      schlechtwetter: { grund: '', stunden: '', mitarbeiter: [] },
    })
  }

  const wetterHolen = async () => {
    const b = bs(form.baustelleId)
    if (b?.lat == null) return setWetterInfo('Für diese Baustelle ist noch kein Standort hinterlegt (Baustellen → Bearbeiten → Standort).')
    setWetterInfo('Wetter wird geladen …')
    try {
      const w = await wetterFuerTag(b.lat, b.lon, form.datum)
      setForm(x => ({ ...x, temperatur: w.temperatur, wetterDetail: w.text, ...(w.wetter ? { wetter: w.wetter } : {}) }))
      setWetterInfo('')
    } catch (e) {
      setWetterInfo(e.message)
    }
  }

  const ausZeiten = () => {
    const ids = [...new Set(daten.zeiten.filter(z => z.datum === form.datum && z.baustelleId === form.baustelleId).map(z => z.mitarbeiterId))]
    const gestempelt = daten.stempel.filter(s => s.baustelleId === form.baustelleId).map(s => s.mitarbeiterId)
    const geplant = daten.plan.filter(p => p.datum === form.datum && p.baustelleId === form.baustelleId).map(p => p.mitarbeiterId)
    setForm({ ...form, anwesend: [...new Set([...form.anwesend, ...ids, ...geplant, ...(form.datum === heute() ? gestempelt : [])])] })
  }

  const umschalten = (feld, id) => {
    if (feld === 'sw') {
      const l = form.schlechtwetter.mitarbeiter
      return setForm({ ...form, schlechtwetter: { ...form.schlechtwetter, mitarbeiter: l.includes(id) ? l.filter(x => x !== id) : [...l, id] } })
    }
    setForm({ ...form, anwesend: form.anwesend.includes(id) ? form.anwesend.filter(x => x !== id) : [...form.anwesend, id] })
  }

  const speichern = e => {
    e.preventDefault()
    if (!form.baustelleId) return alert('Bitte eine Baustelle wählen.')
    const sw = form.schlechtwetter
    if (sw?.stunden && !sw.mitarbeiter.length) return alert('Bitte die vom Schlechtwetter betroffenen Mitarbeiter anhaken.')
    form.id ? upd(setDaten, 'tagebuch', form.id, form) : add(setDaten, 'tagebuch', form)
    setForm(null)
  }

  const druck = x => {
    const b = bs(x.baustelleId)
    const teil = (titel, text) => (text ? `<h2>${titel}</h2><p>${absatz(text)}</p>` : '')
    const sw = x.schlechtwetter?.stunden
      ? `<h2>Schlechtwetter</h2><p>${esc(x.schlechtwetter.grund)}: ${esc(x.schlechtwetter.stunden)} Ausfallstunden für ${x.schlechtwetter.mitarbeiter.map(id => esc(name(id))).join(', ')}</p>`
      : ''
    drucken(`Bautagebuch ${fmtDatum(x.datum)}`, `
      <table class="k">
        <tr><td>Baustelle</td><td>${esc(b?.name ?? '–')}<br>${esc(b?.adresse ?? '')}</td></tr>
        <tr><td>Datum</td><td>${esc(fmtDatum(x.datum))}</td></tr>
        <tr><td>Wetter</td><td>${esc(x.wetter)}${x.temperatur ? `, ${esc(x.temperatur)} °C` : ''}${x.wetterDetail ? `<br><small>${esc(x.wetterDetail)}</small>` : ''}</td></tr>
        <tr><td>Anwesend</td><td>${x.anwesend.map(id => esc(name(id))).join(', ') || '–'}</td></tr>
      </table>
      ${teil('Ausgeführte Leistungen', x.leistungen)}
      ${teil('Lieferungen und Material', x.lieferungen)}
      ${teil('Behinderungen, Störungen, Anordnungen', x.behinderungen)}
      ${sw}
      ${teil('Besucher und Übernahmen', x.besucher)}
      <div class="sig"><div>Datum, Unterschrift Bauleitung</div><div>Datum, Unterschrift Auftraggeber</div></div>`, daten.firma)
  }

  // Behinderungsanzeige ------------------------------------------------------
  const anzeigeAus = x => {
    const b = bs(x.baustelleId)
    setAnzeige({
      baustelleId: x.baustelleId, tagebuchId: x.id, datum: heute(), beginn: x.datum,
      empfaenger: [b?.kunde, b?.ansprechpartner].filter(Boolean).join(', '),
      ursache: x.behinderungen, auswirkung: '', massnahmen: '', fristAntwort: plusTage(heute(), 7),
    })
    setForm(null)
    window.scrollTo(0, 0)
  }
  const anzeigeSpeichern = e => {
    e.preventDefault()
    anzeige.id ? upd(setDaten, 'behinderungen', anzeige.id, anzeige) : add(setDaten, 'behinderungen', anzeige)
    setAnzeige(null)
  }
  const anzeigeDrucken = a => {
    const b = bs(a.baustelleId)
    drucken('Anzeige einer Behinderung', `
      <p>An: ${esc(a.empfaenger)}<br>Datum: ${esc(fmtDatum(a.datum))}</p>
      <p><b>Bauvorhaben: ${esc(b?.name ?? '')}, ${esc(b?.adresse ?? '')}</b></p>
      <p>Sehr geehrte Damen und Herren,</p>
      <p>wir zeigen Ihnen hiermit an, dass wir bei der Ausführung der beauftragten Leistungen seit ${esc(fmtDatum(a.beginn))} behindert sind.</p>
      <h2>Ursache der Behinderung</h2><p>${absatz(a.ursache) || '–'}</p>
      <h2>Voraussichtliche Auswirkungen</h2><p>${absatz(a.auswirkung) || 'Die Auswirkungen auf Bauablauf, Termine und Kosten können derzeit noch nicht abschließend beurteilt werden.'}</p>
      ${a.massnahmen ? `<h2>Von uns getroffene oder vorgeschlagene Maßnahmen</h2><p>${absatz(a.massnahmen)}</p>` : ''}
      <p>Wir ersuchen Sie, die Ursache bis ${esc(fmtDatum(a.fristAntwort))} zu beseitigen bzw. uns mitzuteilen, wie weiter vorzugehen ist.
      Wir behalten uns vor, eine Anpassung der Leistungsfrist und des Entgelts (Mehrkostenforderung) im Sinne der ÖNORM B 2110 geltend zu machen,
      sobald die Auswirkungen feststehen.</p>
      <p>Mit freundlichen Grüßen</p>
      <div class="sig"><div>${esc(daten.firma)}</div><div style="border:0"></div></div>`, daten.firma)
    if (!a.versendetAm) upd(setDaten, 'behinderungen', a.id, { versendetAm: heute() })
  }

  const liste = daten.tagebuch
    .filter(x => filterBs === 'alle' || x.baustelleId === filterBs)
    .sort((a, b) => b.datum.localeCompare(a.datum))
  const anzeigen = daten.behinderungen
    .filter(x => filterBs === 'alle' || x.baustelleId === filterBs)
    .sort((a, b) => b.datum.localeCompare(a.datum))
  const sw = form?.schlechtwetter || { grund: '', stunden: '', mitarbeiter: [] }

  return (
    <>
      <Kopf titel="Bautagebuch">
        <BaustellenAuswahl daten={daten} value={filterBs} onChange={setFilterBs} alle label="Baustelle filtern" />
        {!form && !anzeige && <button className="primaer" onClick={neu}>{t('Neuer Tagesbericht')}</button>}
      </Kopf>

      {anzeige && (
        <Formular
          titel="Behinderung anzeigen"
          onSubmit={anzeigeSpeichern}
          onAbbrechen={() => setAnzeige(null)}
          kannLoeschen={!!anzeige.id}
          onLoeschen={() => { del(setDaten, 'behinderungen', anzeige.id); setAnzeige(null) }}
        >
          <p className="fussnote breit">Behinderungen sollten dem Auftraggeber unverzüglich und schriftlich mitgeteilt werden, sonst können Ansprüche auf mehr Zeit und Geld verloren gehen. Das Schreiben ist eine Vorlage und ersetzt keine Rechtsberatung.</p>
          <Feld label="Baustelle" breit><BaustellenAuswahl daten={daten} value={anzeige.baustelleId} onChange={v => setAnzeige({ ...anzeige, baustelleId: v })} /></Feld>
          <Feld label="Empfänger (Auftraggeber)" breit><input value={anzeige.empfaenger} onChange={e => setAnzeige({ ...anzeige, empfaenger: e.target.value })} /></Feld>
          <Feld label="Behindert seit"><input type="date" value={anzeige.beginn} onChange={e => setAnzeige({ ...anzeige, beginn: e.target.value })} /></Feld>
          <Feld label="Antwort erbeten bis"><input type="date" value={anzeige.fristAntwort} onChange={e => setAnzeige({ ...anzeige, fristAntwort: e.target.value })} /></Feld>
          <TextFeld label="Ursache" value={anzeige.ursache} onChange={v => setAnzeige(a => ({ ...a, ursache: v }))} placeholder="z. B. Vorleistung Elektriker fehlt, Pläne nicht freigegeben" />
          <TextFeld label="Voraussichtliche Auswirkungen" value={anzeige.auswirkung} onChange={v => setAnzeige(a => ({ ...a, auswirkung: v }))} placeholder="z. B. Stillstand Kolonne, Verschiebung Betonage um ca. 3 Tage" />
          <TextFeld label="Maßnahmen" value={anzeige.massnahmen} onChange={v => setAnzeige(a => ({ ...a, massnahmen: v }))} rows={2} />
        </Formular>
      )}

      {form && (
        <Formular
          titel={form.id ? 'Tagesbericht bearbeiten' : 'Neuer Tagesbericht'}
          onSubmit={speichern}
          onAbbrechen={() => setForm(null)}
          kannLoeschen={!!form.id}
          onLoeschen={() => { if (confirm('Tagesbericht löschen?')) { del(setDaten, 'tagebuch', form.id); setForm(null) } }}
          extra={form.behinderungen?.trim() && form.id ? <button type="button" onClick={() => anzeigeAus(form)}>Behinderung anzeigen</button> : null}
        >
          <Feld label="Baustelle" breit>
            <BaustellenAuswahl daten={daten} value={form.baustelleId} onChange={v => setForm({ ...form, baustelleId: v })} />
          </Feld>
          <Feld label="Datum"><input type="date" required value={form.datum} onChange={f('datum')} /></Feld>
          <Feld label="Wetter">
            <select value={form.wetter} onChange={f('wetter')}>{WETTER.map(w => <option key={w}>{w}</option>)}</select>
          </Feld>
          <Feld label="Temperatur (°C)"><input value={form.temperatur} onChange={f('temperatur')} /></Feld>
          <div className="feld breit">
            <div className="knopfreihe eng">
              <button type="button" className="klein" onClick={wetterHolen}>Wetter automatisch eintragen</button>
              {wetterInfo && <span className="leise">{wetterInfo}</span>}
            </div>
            {form.wetterDetail && <span className="leise">{form.wetterDetail}</span>}
          </div>
          <fieldset className="feld breit anwesend">
            <legend>Anwesend</legend>
            <div className="chips">
              {daten.mitarbeiter.map(m => (
                <label key={m.id} className={'chip' + (form.anwesend.includes(m.id) ? ' an' : '')}>
                  <input type="checkbox" checked={form.anwesend.includes(m.id)} onChange={() => umschalten('a', m.id)} />
                  {m.name}
                </label>
              ))}
            </div>
            <button type="button" className="klein" onClick={ausZeiten}>Aus Zeiterfassung und Plantafel übernehmen</button>
          </fieldset>
          <TextFeld label="Ausgeführte Leistungen" value={form.leistungen} onChange={v => setForm(x => ({ ...x, leistungen: v }))} rows={4} />
          <TextFeld label="Lieferungen und Material" value={form.lieferungen} onChange={v => setForm(x => ({ ...x, lieferungen: v }))} rows={2} />
          <TextFeld label="Behinderungen, Störungen, Anordnungen" value={form.behinderungen} onChange={v => setForm(x => ({ ...x, behinderungen: v }))} rows={2} />
          <TextFeld label="Besucher und Übernahmen" value={form.besucher} onChange={v => setForm(x => ({ ...x, besucher: v }))} rows={2} />

          <fieldset className="feld breit schlechtwetter">
            <legend>Schlechtwetter (Ausfallstunden für die BUAK)</legend>
            <div className="raster">
              <Feld label="Grund">
                <select value={sw.grund} onChange={e => setForm({ ...form, schlechtwetter: { ...sw, grund: e.target.value } })}>
                  <option value="">Kein Ausfall</option>
                  {SW_GRUND.map(g => <option key={g}>{g}</option>)}
                </select>
              </Feld>
              <Feld label="Ausfallstunden je Person">
                <input inputMode="decimal" value={sw.stunden} disabled={!sw.grund} onChange={e => setForm({ ...form, schlechtwetter: { ...sw, stunden: e.target.value } })} />
              </Feld>
            </div>
            {sw.grund && (
              <div className="chips">
                {daten.mitarbeiter.filter(m => m.aktiv !== false).map(m => (
                  <label key={m.id} className={'chip' + (sw.mitarbeiter.includes(m.id) ? ' an' : '')}>
                    <input type="checkbox" checked={sw.mitarbeiter.includes(m.id)} onChange={() => umschalten('sw', m.id)} />
                    {m.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        </Formular>
      )}

      {anzeigen.length > 0 && (
        <section className="block">
          <Kopf titel="Behinderungsanzeigen" />
          <ul className="liste">
            {anzeigen.map(a => (
              <li key={a.id} className="zeile">
                <span className={'marke' + (a.versendetAm ? '' : ' dringend')}>{a.versendetAm ? `gedruckt ${fmtDatum(a.versendetAm)}` : 'noch nicht verschickt'}</span>
                <strong>{bs(a.baustelleId)?.name ?? '–'}</strong>
                <span className="leise">seit {fmtDatum(a.beginn)}: {(a.ursache || '').slice(0, 80)}</span>
                <span className="rechts knopfreihe eng">
                  <button className="klein" onClick={() => { setAnzeige({ ...a }); setForm(null) }}>{t('Bearbeiten')}</button>
                  <button className="klein" onClick={() => anzeigeDrucken(a)}>Drucken / PDF</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="block">
        {liste.length === 0 ? (
          <Leer titel="Noch keine Tagesberichte" text="Ein Bericht pro Tag und Baustelle hilft bei Nachträgen, Behinderungen, Schlechtwetter und Streitfällen." />
        ) : (
          <div className="karten">
            {liste.map(x => (
              <article key={x.id} className="bericht">
                <div className="baustelle-kopf">
                  <h3>{bs(x.baustelleId)?.name ?? '–'}</h3>
                  <span className="leise">{fmtDatum(x.datum)}</span>
                </div>
                <p className="leise">
                  {x.wetter}{x.temperatur ? `, ${x.temperatur} °C` : ''}, {x.anwesend.length} anwesend
                </p>
                {x.schlechtwetter?.stunden && <span className="marke">Schlechtwetter: {x.schlechtwetter.grund}, {x.schlechtwetter.stunden} h</span>}
                {x.leistungen && <p className="vorschau">{x.leistungen}</p>}
                {x.behinderungen && <p className="vorschau warnung">Behinderung: {x.behinderungen}</p>}
                <div className="knopfreihe">
                  <button className="klein" onClick={() => { setForm({ schlechtwetter: { grund: '', stunden: '', mitarbeiter: [] }, wetterDetail: '', ...x }); setAnzeige(null) }}>{t('Bearbeiten')}</button>
                  <button className="klein" onClick={() => druck(x)}>Drucken / PDF</button>
                  {x.behinderungen && !daten.behinderungen.some(a => a.tagebuchId === x.id) && (
                    <button className="klein" onClick={() => anzeigeAus(x)}>Behinderung anzeigen</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
