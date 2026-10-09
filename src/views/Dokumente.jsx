import { useState } from 'react'
import { uid, heute, fmtDatum, del } from '../store'
import { syncVerfuegbar, dateiHochladen, dateiLink, dateiLoeschen } from '../sync'
import { Kopf, Leer, BaustellenAuswahl } from '../ui.jsx'

const KATEGORIEN = ['Plan', 'Statik', 'Bescheid / Genehmigung', 'Vertrag / LV', 'Lieferschein', 'Sicherheit (SiGe-Plan)', 'Sonstiges']
const LOKAL_MAX = 2 * 1024 * 1024
const groesse = b => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB')

const alsDataUrl = datei =>
  new Promise((ok, fail) => {
    const r = new FileReader()
    r.onload = () => ok(r.result)
    r.onerror = fail
    r.readAsDataURL(datei)
  })

export default function Dokumente({ daten, setDaten, rechte, konto }) {
  const [filterBs, setFilterBs] = useState(() => daten.baustellen.find(b => b.status === 'laufend')?.id ?? 'alle')
  const [kategorie, setKategorie] = useState('Plan')
  const [laedt, setLaedt] = useState('')
  const cloud = syncVerfuegbar && !!konto?.firma
  const bs = id => daten.baustellen.find(b => b.id === id)?.name ?? 'Allgemein'

  const hochladen = async e => {
    const dateien = [...(e.target.files || [])]
    e.target.value = ''
    if (!dateien.length) return
    const neu = []
    try {
      for (const d of dateien) {
        setLaedt(`${d.name} wird hochgeladen …`)
        const eintrag = { id: uid(), baustelleId: filterBs === 'alle' ? '' : filterBs, name: d.name, kategorie, groesse: d.size, typ: d.type, datum: heute() }
        if (cloud) eintrag.pfad = await dateiHochladen(d)
        else {
          if (d.size > LOKAL_MAX) throw new Error(`„${d.name}“ ist zu groß. Ohne Cloud-Konto gehen nur Dateien bis 2 MB.`)
          eintrag.inhalt = await alsDataUrl(d)
        }
        neu.push(eintrag)
      }
    } catch (err) {
      alert(err.message || 'Hochladen fehlgeschlagen.')
    } finally {
      if (neu.length) setDaten(x => ({ ...x, dokumente: [...neu, ...x.dokumente] }))
      setLaedt('')
    }
  }

  const oeffnen = async d => {
    try {
      if (d.pfad) {
        const fenster = window.open('', '_blank')
        const url = await dateiLink(d.pfad)
        if (fenster) fenster.location = url
        else window.location.href = url
      } else if (d.inhalt) {
        const blob = await (await fetch(d.inhalt)).blob()
        window.open(URL.createObjectURL(blob), '_blank')
      }
    } catch (err) {
      alert(err.message || 'Datei konnte nicht geöffnet werden.')
    }
  }

  const loeschen = async d => {
    if (!confirm(`„${d.name}“ löschen?`)) return
    if (d.pfad) await dateiLoeschen(d.pfad).catch(() => {})
    del(setDaten, 'dokumente', d.id)
  }

  const liste = daten.dokumente
    .filter(d => filterBs === 'alle' || d.baustelleId === filterBs || !d.baustelleId)
    .sort((a, b) => a.kategorie.localeCompare(b.kategorie) || b.datum.localeCompare(a.datum))

  return (
    <>
      <Kopf titel="Pläne und Dokumente">
        <BaustellenAuswahl daten={daten} value={filterBs} onChange={setFilterBs} alle label="Baustelle wählen" />
      </Kopf>
      <div className="formular foto-neu">
        <div className="knopfreihe eng">
          <select value={kategorie} onChange={e => setKategorie(e.target.value)} aria-label="Art des Dokuments" style={{ width: 'auto' }}>
            {KATEGORIEN.map(k => <option key={k}>{k}</option>)}
          </select>
          <label className="knopf primaer">
            {laedt || 'Datei hochladen (PDF, Bild …)'}
            <input type="file" multiple hidden onChange={hochladen} accept=".pdf,image/*,.dwg,.dxf,.doc,.docx,.xls,.xlsx" />
          </label>
        </div>
        <p className="fussnote">
          {cloud
            ? 'Dateien liegen geschützt im Firmenspeicher (kostenlos bis 1 GB) und sind für alle in der Firma abrufbar.'
            : 'Ohne Cloud-Konto bleiben Dateien auf diesem Gerät, höchstens 2 MB pro Datei.'}
          {filterBs === 'alle' && ' Bei „Alle Baustellen“ hochgeladene Dateien gelten für alle Baustellen.'}
        </p>
      </div>
      {liste.length === 0 ? (
        <Leer titel="Noch keine Dokumente" text="Pläne, Statik, Bescheide und Leistungsverzeichnis immer dabei, auch ohne Ordner im Auto." />
      ) : (
        <ul className="liste">
          {liste.map(d => (
            <li key={d.id} className="zeile">
              <span className="marke">{d.kategorie}</span>
              <button className="linkknopf" onClick={() => oeffnen(d)}>{d.name}</button>
              <span className="leise">{filterBs === 'alle' ? `${bs(d.baustelleId)}, ` : ''}{fmtDatum(d.datum)}, {groesse(d.groesse || 0)}</span>
              {rechte.stammdaten && <button className="klein rechts" onClick={() => loeschen(d)}>Löschen</button>}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
