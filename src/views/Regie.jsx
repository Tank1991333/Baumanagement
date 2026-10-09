import { useState } from 'react'
import { add, upd, del, heute, fmtDatum, fmtStd, zahl, esc, absatz, drucken, unterschriftHtml } from '../store'
import { Feld, Kopf, Leer, Formular, Signatur, Zeilen, BaustellenAuswahl } from '../ui.jsx'

const STATUS = { offen: 'Nicht unterschrieben', unterschrieben: 'Unterschrieben', abgerechnet: 'Abgerechnet' }

export default function Regie({ daten, setDaten, rechte }) {
  const [form, setForm] = useState(null)
  const [filterBs, setFilterBs] = useState('alle')
  const f = k => e => setForm({ ...form, [k]: e.target.value })
  const bsObj = id => daten.baustellen.find(b => b.id === id)
  const nr = r => 'R-' + String(r.nummer ?? '').padStart(3, '0')

  const neu = () => {
    const baustelleId = filterBs !== 'alle' ? filterBs : daten.baustellen.find(b => b.status === 'laufend')?.id ?? daten.baustellen[0]?.id ?? ''
    const nummer = daten.regie.reduce((m, r) => Math.max(m, r.nummer || 0), 0) + 1
    const amTag = daten.zeiten.filter(z => z.datum === heute() && z.baustelleId === baustelleId)
    setForm({
      nummer, baustelleId, datum: heute(), auftraggeber: bsObj(baustelleId)?.ansprechpartner || bsObj(baustelleId)?.kunde || '',
      anordnung: '', beschreibung: '',
      arbeit: amTag.length ? amTag.map(z => ({ name: daten.mitarbeiter.find(m => m.id === z.mitarbeiterId)?.name ?? '', stunden: '' })) : [{ name: '', stunden: '' }],
      material: [], geraete: [], unterschrift: '', unterschriftName: '', status: 'offen',
    })
  }

  const speichern = e => {
    e.preventDefault()
    if (!form.beschreibung.trim()) return alert('Bitte die ausgeführten Arbeiten beschreiben.')
    const status = form.status === 'abgerechnet' ? 'abgerechnet' : form.unterschrift ? 'unterschrieben' : 'offen'
    const x = { ...form, status }
    form.id ? upd(setDaten, 'regie', form.id, x) : add(setDaten, 'regie', x)
    setForm(null)
  }

  const summe = r => (r.arbeit || []).reduce((s, a) => s + zahl(a.stunden), 0)

  const druck = r => {
    const b = bsObj(r.baustelleId)
    const tabelle = (kopf, zeilen) =>
      zeilen.length ? `<table><tr>${kopf.map(k => `<th>${k}</th>`).join('')}</tr>${zeilen.map(z => `<tr>${z.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>` : '<p>–</p>'
    drucken(`Regiebericht ${nr(r)}`, `
      <table class="k">
        <tr><td>Bauvorhaben</td><td>${esc(b?.name ?? '–')}<br>${esc(b?.adresse ?? '')}</td></tr>
        <tr><td>Datum</td><td>${esc(fmtDatum(r.datum))}</td></tr>
        <tr><td>Angeordnet von</td><td>${esc(r.anordnung || r.auftraggeber || '')}</td></tr>
      </table>
      <h2>Ausgeführte Arbeiten (außerhalb des Hauptauftrags)</h2><p>${absatz(r.beschreibung)}</p>
      <h2>Arbeitskräfte</h2>${tabelle(['Name / Qualifikation', 'Stunden'], (r.arbeit || []).filter(a => a.name || a.stunden).map(a => [a.name, a.stunden]))}
      <p><b>Summe: ${esc(fmtStd(summe(r)))}</b></p>
      <h2>Material</h2>${tabelle(['Bezeichnung', 'Menge', 'Einheit'], (r.material || []).map(m => [m.bezeichnung, m.menge, m.einheit]))}
      <h2>Geräte und Maschinen</h2>${tabelle(['Gerät', 'Stunden'], (r.geraete || []).map(g => [g.bezeichnung, g.stunden]))}
      <p style="font-size:9pt;margin-top:18px">Mit der Unterschrift bestätigt der Auftraggeber Art und Umfang der ausgeführten Leistungen. Die Vergütung richtet sich nach dem Vertrag bzw. den vereinbarten Stundenlohnsätzen.</p>
      <div class="sig">${unterschriftHtml(r.unterschrift, 'Auftraggeber: ' + (r.unterschriftName || ''))}<div style="height:74px"></div></div>`, daten.firma)
  }

  const liste = daten.regie
    .filter(r => filterBs === 'alle' || r.baustelleId === filterBs)
    .sort((a, b) => b.datum.localeCompare(a.datum) || (b.nummer || 0) - (a.nummer || 0))

  return (
    <>
      <Kopf titel="Regieberichte">
        <BaustellenAuswahl daten={daten} value={filterBs} onChange={setFilterBs} alle label="Baustelle filtern" />
        {!form && daten.baustellen.length > 0 && <button className="primaer" onClick={neu}>Neuer Regiebericht</button>}
      </Kopf>

      {form && (
        <Formular
          titel={`${form.id ? 'Regiebericht bearbeiten' : 'Neuer Regiebericht'} ${nr(form)}`}
          onSubmit={speichern}
          onAbbrechen={() => setForm(null)}
          kannLoeschen={!!form.id && rechte.stammdaten}
          onLoeschen={() => { if (confirm('Regiebericht löschen?')) { del(setDaten, 'regie', form.id); setForm(null) } }}
        >
          <Feld label="Baustelle" breit>
            <BaustellenAuswahl daten={daten} value={form.baustelleId} onChange={v => setForm({ ...form, baustelleId: v })} />
          </Feld>
          <Feld label="Datum"><input type="date" value={form.datum} onChange={f('datum')} /></Feld>
          <Feld label="Angeordnet von"><input value={form.anordnung} onChange={f('anordnung')} placeholder="z. B. Bauherr, Architekt" /></Feld>
          <Feld label="Ausgeführte Arbeiten *" breit>
            <textarea rows="3" value={form.beschreibung} onChange={f('beschreibung')} placeholder="Was wurde zusätzlich gemacht, wo und warum?" />
          </Feld>
          <div className="feld breit">
            <span>Arbeitskräfte und Stunden</span>
            <Zeilen zeilen={form.arbeit} onChange={arbeit => setForm({ ...form, arbeit })} neu={{ name: '', stunden: '' }}
              spalten={[{ key: 'name', label: 'Name / Qualifikation' }, { key: 'stunden', label: 'Std.', zahl: true }]} />
          </div>
          <div className="feld breit">
            <span>Material</span>
            <Zeilen zeilen={form.material} onChange={material => setForm({ ...form, material })} neu={{ bezeichnung: '', menge: '', einheit: '' }}
              spalten={[{ key: 'bezeichnung', label: 'Bezeichnung' }, { key: 'menge', label: 'Menge', zahl: true }, { key: 'einheit', label: 'Einheit' }]} />
          </div>
          <div className="feld breit">
            <span>Geräte und Maschinen</span>
            <Zeilen zeilen={form.geraete} onChange={geraete => setForm({ ...form, geraete })} neu={{ bezeichnung: '', stunden: '' }}
              spalten={[{ key: 'bezeichnung', label: 'Gerät' }, { key: 'stunden', label: 'Std.', zahl: true }]} />
          </div>
          <Feld label="Name des Unterzeichners" breit><input value={form.unterschriftName} onChange={f('unterschriftName')} /></Feld>
          <Signatur label="Unterschrift Auftraggeber" wert={form.unterschrift} onChange={v => setForm(x => ({ ...x, unterschrift: v }))} />
          {rechte.kosten && (
            <Feld label="Abrechnung">
              <select value={form.status === 'abgerechnet' ? 'ja' : 'nein'} onChange={e => setForm({ ...form, status: e.target.value === 'ja' ? 'abgerechnet' : 'offen' })}>
                <option value="nein">Noch nicht abgerechnet</option>
                <option value="ja">Abgerechnet</option>
              </select>
            </Feld>
          )}
        </Formular>
      )}

      {liste.length === 0 ? (
        <Leer titel="Noch keine Regieberichte" text="Zusatzarbeiten sofort erfassen und vom Bauherrn auf dem Handy unterschreiben lassen, dann geht keine Stunde verloren." />
      ) : (
        <ul className="liste">
          {liste.map(r => (
            <li key={r.id} className="zeile">
              <span className={'marke' + (r.status === 'offen' ? ' dringend' : '')}>{STATUS[r.status]}</span>
              <strong>{nr(r)} {bsObj(r.baustelleId)?.name ?? '–'}</strong>
              <span className="leise">{fmtDatum(r.datum)}, {fmtStd(summe(r))}, {r.beschreibung.slice(0, 70)}</span>
              <span className="rechts knopfreihe eng">
                <button className="klein" onClick={() => setForm({ ...r })}>Bearbeiten</button>
                <button className="klein" onClick={() => druck(r)}>Drucken / PDF</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
