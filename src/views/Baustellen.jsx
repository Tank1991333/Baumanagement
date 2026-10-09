import { useState } from 'react'
import { add, upd, del, fmtStd, fmtDatum, fmtEuro, zahl, zufall } from '../store'
import { koordinatenAusAdresse, aktuellerStandort } from '../wetter'
import { syncVerfuegbar } from '../sync'
import { Feld, Kopf, Leer, Formular } from '../ui.jsx'

const NEU = { name: '', adresse: '', kunde: '', ansprechpartner: '', telefon: '', start: '', ende: '', status: 'laufend', notiz: '', angebot: '', sollStunden: '', lat: null, lon: null, fortschritt: '', kundenInfo: '', kundenFreigabe: false, kundenToken: '' }
const STATUS = { geplant: 'Geplant', laufend: 'Laufend', abgeschlossen: 'Abgeschlossen' }

function nachkalkulation(d, b) {
  const zeiten = d.zeiten.filter(z => z.baustelleId === b.id)
  const satz = id => zahl(d.mitarbeiter.find(m => m.id === id)?.stundensatz)
  const std = zeiten.reduce((s, z) => s + z.stunden, 0)
  const lohn = zeiten.reduce((s, z) => s + z.stunden * satz(z.mitarbeiterId), 0)
  const ohneSatz = zeiten.filter(z => !satz(z.mitarbeiterId)).reduce((s, z) => s + z.stunden, 0)
  const material = d.bestellungen.filter(x => x.baustelleId === b.id).reduce((s, x) => s + zahl(x.preis), 0)
  const regie = d.regie.filter(x => x.baustelleId === b.id).reduce((s, x) => s + (x.arbeit || []).reduce((a, r) => a + zahl(r.stunden), 0), 0)
  return { std, lohn, ohneSatz, material, regie, kosten: lohn + material, angebot: zahl(b.angebot), soll: zahl(b.sollStunden) }
}

function Balken({ ist, soll }) {
  if (!soll) return null
  const p = Math.min(100, (ist / soll) * 100)
  return (
    <div className="balken" role="img" aria-label={`${Math.round((ist / soll) * 100)} Prozent verbraucht`}>
      <div className={ist > soll ? 'drueber' : ist > soll * 0.85 ? 'knapp' : ''} style={{ width: p + '%' }} />
    </div>
  )
}

export default function Baustellen({ daten, setDaten, rechte, konto }) {
  const [form, setForm] = useState(null)
  const [filter, setFilter] = useState('laufend')
  const f = k => e => setForm({ ...form, [k]: e.target.value })
  const [ortInfo, setOrtInfo] = useState('')
  const cloud = syncVerfuegbar && !!konto?.firma

  const ortSetzen = async quelle => {
    setOrtInfo('Wird ermittelt …')
    try {
      const o = quelle === 'gps' ? await aktuellerStandort() : await koordinatenAusAdresse(form.adresse)
      setForm(x => ({ ...x, lat: o.lat, lon: o.lon }))
      setOrtInfo(quelle === 'gps' ? `Standort übernommen (± ${o.genau} m)` : 'Aus der Adresse gefunden')
    } catch (e) {
      setOrtInfo(e.message)
    }
  }

  const kundenLink = b => `${window.location.origin}${window.location.pathname}?bauherr=${b.kundenToken}`
  const teilen = async b => {
    const url = kundenLink(b)
    try {
      if (navigator.share) await navigator.share({ title: b.name, text: `Baufortschritt ${b.name}`, url })
      else {
        await navigator.clipboard.writeText(url)
        alert('Link kopiert:\n' + url)
      }
    } catch { /* abgebrochen */ }
  }

  const speichern = e => {
    e.preventDefault()
    if (!form.name.trim()) return
    form.id ? upd(setDaten, 'baustellen', form.id, form) : add(setDaten, 'baustellen', form)
    setForm(null)
  }
  const loeschen = () => {
    if (confirm(`Baustelle „${form.name}“ löschen? Erfasste Zeiten und Berichte bleiben erhalten.`)) {
      del(setDaten, 'baustellen', form.id)
      setForm(null)
    }
  }

  const liste = daten.baustellen.filter(b => filter === 'alle' || b.status === filter)
  const offen = id => daten.maengel.filter(m => m.baustelleId === id && !m.erledigt).length

  return (
    <>
      <Kopf titel="Baustellen">
        <select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Status filtern">
          <option value="laufend">Laufend</option>
          <option value="geplant">Geplant</option>
          <option value="abgeschlossen">Abgeschlossen</option>
          <option value="alle">Alle</option>
        </select>
        {!form && rechte.stammdaten && <button className="primaer" onClick={() => { setOrtInfo(''); setForm({ ...NEU }) }}>Neue Baustelle</button>}
      </Kopf>

      {form && (
        <Formular
          titel={form.id ? 'Baustelle bearbeiten' : 'Neue Baustelle'}
          onSubmit={speichern}
          onAbbrechen={() => setForm(null)}
          kannLoeschen={!!form.id}
          onLoeschen={loeschen}
        >
          <Feld label="Bezeichnung *" breit><input required value={form.name} onChange={f('name')} placeholder="z. B. EFH Müller, Anbau Garage" /></Feld>
          <Feld label="Adresse" breit><input value={form.adresse} onChange={f('adresse')} /></Feld>
          <Feld label="Bauherr / Kunde"><input value={form.kunde} onChange={f('kunde')} /></Feld>
          <Feld label="Ansprechpartner"><input value={form.ansprechpartner} onChange={f('ansprechpartner')} /></Feld>
          <Feld label="Telefon"><input type="tel" value={form.telefon} onChange={f('telefon')} /></Feld>
          <Feld label="Status">
            <select value={form.status} onChange={f('status')}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Feld>
          <Feld label="Baubeginn"><input type="date" value={form.start} onChange={f('start')} /></Feld>
          <Feld label="Fertigstellung geplant"><input type="date" value={form.ende} onChange={f('ende')} /></Feld>
          {rechte.kosten && <Feld label="Auftragssumme netto (€)"><input inputMode="decimal" value={form.angebot} onChange={f('angebot')} /></Feld>}
          <Feld label="Kalkulierte Stunden"><input inputMode="decimal" value={form.sollStunden} onChange={f('sollStunden')} /></Feld>
          <Feld label="Notizen" breit><textarea rows="3" value={form.notiz} onChange={f('notiz')} /></Feld>
          <fieldset className="feld breit schlechtwetter">
            <legend>Standort (für Wetter und Stempel-Kontrolle)</legend>
            <div className="knopfreihe eng">
              <button type="button" className="klein" onClick={() => ortSetzen('gps')}>Hier bin ich gerade</button>
              <button type="button" className="klein" disabled={!form.adresse} onClick={() => ortSetzen('adresse')}>Aus Adresse suchen</button>
              <span className="leise">{ortInfo || (form.lat != null ? `${form.lat}, ${form.lon}` : 'noch kein Standort')}</span>
            </div>
          </fieldset>
          {cloud && (
            <fieldset className="feld breit schlechtwetter">
              <legend>Bauherren-Link</legend>
              <label className="recht">
                <input
                  type="checkbox"
                  checked={!!form.kundenFreigabe}
                  onChange={e => setForm({ ...form, kundenFreigabe: e.target.checked, kundenToken: form.kundenToken || zufall(24) })}
                />
                <span><b>Bauherr darf den Fortschritt sehen</b><span className="leise">nur Status, Fortschritt, Info-Text und freigegebene Fotos, keine Kosten</span></span>
              </label>
              {form.kundenFreigabe && (
                <div className="raster">
                  <Feld label="Fortschritt (%)"><input inputMode="numeric" value={form.fortschritt} onChange={f('fortschritt')} /></Feld>
                  <Feld label="Info für den Bauherrn" breit><textarea rows="2" value={form.kundenInfo} onChange={f('kundenInfo')} placeholder="z. B. Nächste Woche: Dachstuhl, Kranaufstellung am Montag" /></Feld>
                </div>
              )}
            </fieldset>
          )}
        </Formular>
      )}

      {liste.length === 0 ? (
        <Leer titel="Keine Baustellen in dieser Ansicht" text="Lege eine Baustelle an, um Zeiten, Berichte und Mängel zuzuordnen." />
      ) : (
        <div className="karten">
          {liste.map(b => {
            const k = nachkalkulation(daten, b)
            return (
              <article key={b.id} className={'baustelle status-' + b.status}>
                <div className="baustelle-kopf">
                  <h3>{b.name}</h3>
                  <span className="marke">{STATUS[b.status]}</span>
                </div>
                {b.adresse && (
                  <a className="adresse" href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(b.adresse)} target="_blank" rel="noreferrer">
                    {b.adresse}
                  </a>
                )}
                <dl className="fakten">
                  {b.kunde && (<><dt>Kunde</dt><dd>{b.kunde}</dd></>)}
                  {b.ansprechpartner && (<><dt>Ansprechpartner</dt><dd>{b.ansprechpartner}</dd></>)}
                  {b.telefon && (<><dt>Telefon</dt><dd><a href={'tel:' + b.telefon.replace(/\s/g, '')}>{b.telefon}</a></dd></>)}
                  {(b.start || b.ende) && (<><dt>Zeitraum</dt><dd>{fmtDatum(b.start) || '?'} bis {fmtDatum(b.ende) || 'offen'}</dd></>)}
                  <dt>Offene Punkte</dt><dd>{offen(b.id)}</dd>
                </dl>
                {b.notiz && <p className="notiz">{b.notiz}</p>}

                <div className="nachkalk">
                  <div className="nk-zeile"><span>Stunden</span><b>{fmtStd(k.std)}{k.soll ? ` von ${fmtStd(k.soll)}` : ''}</b></div>
                  <Balken ist={k.std} soll={k.soll} />
                  {k.regie > 0 && <div className="nk-zeile"><span>davon als Regie gemeldet</span><b>{fmtStd(k.regie)}</b></div>}
                  {rechte.kosten && (
                    <>
                      <div className="nk-zeile"><span>Lohnkosten</span><b>{fmtEuro(k.lohn)}</b></div>
                      <div className="nk-zeile"><span>Material laut Bestellungen</span><b>{fmtEuro(k.material)}</b></div>
                      {k.angebot > 0 && (
                        <>
                          <div className="nk-zeile"><span>Auftragssumme</span><b>{fmtEuro(k.angebot)}</b></div>
                          <Balken ist={k.kosten} soll={k.angebot} />
                          <div className={'nk-zeile ' + (k.angebot - k.kosten < 0 ? 'minus' : '')}>
                            <span>Rest bis Auftragssumme</span><b>{fmtEuro(k.angebot - k.kosten)}</b>
                          </div>
                        </>
                      )}
                      {k.ohneSatz > 0 && <p className="fussnote">{fmtStd(k.ohneSatz)} ohne Stundensatz. Sätze unter Team eintragen.</p>}
                    </>
                  )}
                </div>
                <div className="knopfreihe eng">
                  {rechte.stammdaten && <button className="klein" onClick={() => { setOrtInfo(''); setForm({ ...NEU, ...b }); window.scrollTo(0, 0) }}>Bearbeiten</button>}
                  {cloud && b.kundenFreigabe && b.kundenToken && <button className="klein" onClick={() => teilen(b)}>Bauherren-Link teilen</button>}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
