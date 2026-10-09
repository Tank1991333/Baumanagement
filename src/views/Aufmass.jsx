import { useState } from 'react'
import { add, upd, del, heute, fmtDatum, zahl, esc, drucken, csv, herunterladen } from '../store'
import { Feld, Kopf, Leer, Formular, BaustellenAuswahl } from '../ui.jsx'

const EINHEITEN = ['m', 'm²', 'm³', 'Stk.', 'kg', 't', 'lfm', 'h', 'Pausch.']
const LEER_ZEILE = { text: '', anzahl: '1', laenge: '', breite: '', hoehe: '' }
const fmt = x => (Math.round(x * 1000) / 1000).toLocaleString('de-AT', { maximumFractionDigits: 3 })

// Menge je Zeile: Anzahl × Länge × Breite × Höhe, leere Maße zählen als 1. Negative Anzahl = Abzug.
export const zeilenMenge = z => {
  const masse = [z.laenge, z.breite, z.hoehe].filter(v => String(v ?? '').trim() !== '').map(zahl)
  return zahl(z.anzahl || 1) * masse.reduce((p, v) => p * v, 1)
}
const summe = a => (a.zeilen || []).reduce((s, z) => s + zeilenMenge(z), 0)

export default function Aufmass({ daten, setDaten }) {
  const [form, setForm] = useState(null)
  const [filterBs, setFilterBs] = useState('alle')
  const bs = id => daten.baustellen.find(b => b.id === id)

  const neu = () =>
    setForm({
      baustelleId: filterBs !== 'alle' ? filterBs : daten.baustellen.find(b => b.status === 'laufend')?.id ?? daten.baustellen[0]?.id ?? '',
      datum: heute(), position: '', bezeichnung: '', einheit: 'm²', zeilen: [{ ...LEER_ZEILE }], notiz: '',
    })

  const speichern = e => {
    e.preventDefault()
    if (!form.bezeichnung.trim()) return alert('Bitte eine Bezeichnung eingeben.')
    form.id ? upd(setDaten, 'aufmass', form.id, form) : add(setDaten, 'aufmass', form)
    setForm(null)
  }

  const setzeZeile = (i, k, v) => setForm(x => ({ ...x, zeilen: x.zeilen.map((z, j) => (j === i ? { ...z, [k]: v } : z)) }))

  const liste = daten.aufmass
    .filter(a => filterBs === 'alle' || a.baustelleId === filterBs)
    .sort((a, b) => (a.position || '').localeCompare(b.position || '', 'de', { numeric: true }) || b.datum.localeCompare(a.datum))

  const blatt = () => {
    const b = bs(filterBs)
    drucken(`Aufmaß ${b?.name ?? ''}`, liste.map(a => `
      <h2>${esc(a.position ? a.position + ' ' : '')}${esc(a.bezeichnung)} <small>(${esc(fmtDatum(a.datum))})</small></h2>
      <table><tr><th>Beschreibung</th><th>Anz.</th><th>L</th><th>B</th><th>H</th><th>Menge</th></tr>
      ${(a.zeilen || []).map(z => `<tr><td>${esc(z.text)}</td><td>${esc(z.anzahl)}</td><td>${esc(z.laenge)}</td><td>${esc(z.breite)}</td><td>${esc(z.hoehe)}</td><td>${fmt(zeilenMenge(z))}</td></tr>`).join('')}
      <tr><th colspan="5">Summe</th><th>${fmt(summe(a))} ${esc(a.einheit)}</th></tr></table>`).join('') +
      '<div class="sig"><div>Auftragnehmer</div><div>Auftraggeber / Örtliche Bauaufsicht</div></div>', daten.firma)
  }

  const exportCsv = () => {
    const z = [['Baustelle', 'Datum', 'Position', 'Bezeichnung', 'Menge', 'Einheit']]
    liste.forEach(a => z.push([bs(a.baustelleId)?.name ?? '', a.datum, a.position, a.bezeichnung, fmt(summe(a)), a.einheit]))
    herunterladen(`Aufmass_${heute()}.csv`, csv(z))
  }

  return (
    <>
      <Kopf titel="Aufmaß">
        <BaustellenAuswahl daten={daten} value={filterBs} onChange={setFilterBs} alle label="Baustelle filtern" />
        {filterBs !== 'alle' && liste.length > 0 && <button className="klein" onClick={blatt}>Aufmaßblatt drucken</button>}
        {liste.length > 0 && <button className="klein" onClick={exportCsv}>CSV</button>}
        {!form && daten.baustellen.length > 0 && <button className="primaer" onClick={neu}>Neues Aufmaß</button>}
      </Kopf>

      {form && (
        <Formular
          titel={form.id ? 'Aufmaß bearbeiten' : 'Neues Aufmaß'}
          onSubmit={speichern}
          onAbbrechen={() => setForm(null)}
          kannLoeschen={!!form.id}
          onLoeschen={() => { if (confirm('Aufmaß löschen?')) { del(setDaten, 'aufmass', form.id); setForm(null) } }}
        >
          <Feld label="Baustelle" breit><BaustellenAuswahl daten={daten} value={form.baustelleId} onChange={v => setForm({ ...form, baustelleId: v })} /></Feld>
          <Feld label="Datum"><input type="date" value={form.datum} onChange={e => setForm({ ...form, datum: e.target.value })} /></Feld>
          <Feld label="LV-Position"><input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} placeholder="z. B. 03.02.01" /></Feld>
          <Feld label="Bezeichnung *" breit><input value={form.bezeichnung} onChange={e => setForm({ ...form, bezeichnung: e.target.value })} placeholder="z. B. Innenputz Wände EG" /></Feld>
          <Feld label="Einheit">
            <select value={form.einheit} onChange={e => setForm({ ...form, einheit: e.target.value })}>{EINHEITEN.map(x => <option key={x}>{x}</option>)}</select>
          </Feld>
          <div className="feld breit">
            <span>Maße (leere Felder zählen als 1, negative Anzahl für Abzüge wie Fenster)</span>
            <div className="aufmass-zeilen">
              {form.zeilen.map((z, i) => (
                <div key={i} className="aufmass-zeile">
                  <input className="am-text" placeholder="Beschreibung" aria-label="Beschreibung" value={z.text} onChange={e => setzeZeile(i, 'text', e.target.value)} />
                  {['anzahl', 'laenge', 'breite', 'hoehe'].map(k => (
                    <input key={k} inputMode="decimal" placeholder={{ anzahl: 'Anz.', laenge: 'L', breite: 'B', hoehe: 'H' }[k]} aria-label={k} value={z[k]} onChange={e => setzeZeile(i, k, e.target.value)} />
                  ))}
                  <output className="am-menge">{fmt(zeilenMenge(z))}</output>
                  <button type="button" className="klein" aria-label="Zeile entfernen" onClick={() => setForm(x => ({ ...x, zeilen: x.zeilen.filter((_, j) => j !== i) }))}>✕</button>
                </div>
              ))}
              <button type="button" className="klein" onClick={() => setForm(x => ({ ...x, zeilen: [...x.zeilen, { ...LEER_ZEILE }] }))}>Zeile hinzufügen</button>
            </div>
          </div>
          <Feld label="Ergibt"><output>{fmt(summe(form))} {form.einheit}</output></Feld>
        </Formular>
      )}

      {liste.length === 0 ? (
        <Leer titel="Noch kein Aufmaß" text="Mengen direkt vor Ort erfassen: Länge, Breite, Höhe, Abzüge. Daraus entsteht das Aufmaßblatt für die Abrechnung." />
      ) : (
        <ul className="liste">
          {liste.map(a => (
            <li key={a.id}>
              <button className="zeile zeilenknopf" onClick={() => setForm({ ...a })}>
                {a.position && <span className="marke">{a.position}</span>}
                <strong>{a.bezeichnung}</strong>
                <span className="leise">{filterBs === 'alle' ? `${bs(a.baustelleId)?.name ?? '–'}, ` : ''}{fmtDatum(a.datum)}</span>
                <span className="rechts zahl">{fmt(summe(a))} {a.einheit}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
