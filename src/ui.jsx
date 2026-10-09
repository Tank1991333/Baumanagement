import { useEffect, useRef, useState } from 'react'
import { bildKomprimieren } from './store'

export function Feld({ label, children, breit }) {
  return (
    <label className={'feld' + (breit ? ' breit' : '')}>
      <span>{label}</span>
      {children}
    </label>
  )
}

export function Kopf({ titel, children }) {
  return (
    <div className="kopf">
      <h2>{titel}</h2>
      {children && <div className="kopf-aktionen">{children}</div>}
    </div>
  )
}

export function Leer({ titel, text, children }) {
  return (
    <div className="leer">
      <strong>{titel}</strong>
      {text && <p>{text}</p>}
      {children}
    </div>
  )
}

export function Formular({ titel, onSubmit, onAbbrechen, kannLoeschen, onLoeschen, children, extra }) {
  return (
    <form className="formular" onSubmit={onSubmit}>
      <h3>{titel}</h3>
      <div className="raster">{children}</div>
      <div className="knopfreihe">
        <button type="submit" className="primaer">Speichern</button>
        <button type="button" onClick={onAbbrechen}>Abbrechen</button>
        {extra}
        {kannLoeschen && (
          <button type="button" className="gefahr rechts" onClick={onLoeschen}>Löschen</button>
        )}
      </div>
    </form>
  )
}

export function BaustellenAuswahl({ daten, value, onChange, alle, label = 'Baustelle', nurOffen }) {
  const liste = nurOffen ? daten.baustellen.filter(b => b.status !== 'abgeschlossen' || b.id === value) : daten.baustellen
  return (
    <select value={value} onChange={e => onChange(e.target.value)} aria-label={label}>
      {alle && <option value="alle">Alle Baustellen</option>}
      {liste.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
    </select>
  )
}

export function Signatur({ label, wert, onChange }) {
  const ref = useRef(null)
  const aktiv = useRef(false)

  useEffect(() => {
    const c = ref.current
    const r = c.getBoundingClientRect()
    c.width = Math.max(1, r.width * 2)
    c.height = Math.max(1, r.height * 2)
    const ctx = c.getContext('2d')
    ctx.scale(2, 2)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111'
    if (wert) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, r.width, r.height)
      img.src = wert
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pos = e => {
    const r = ref.current.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }
  const start = e => {
    aktiv.current = true
    ref.current.setPointerCapture?.(e.pointerId)
    const ctx = ref.current.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(...pos(e))
  }
  const ziehen = e => {
    if (!aktiv.current) return
    const ctx = ref.current.getContext('2d')
    ctx.lineTo(...pos(e))
    ctx.stroke()
  }
  const ende = () => {
    if (!aktiv.current) return
    aktiv.current = false
    onChange(ref.current.toDataURL('image/png'))
  }
  const leeren = () => {
    const c = ref.current
    c.getContext('2d').clearRect(0, 0, c.width, c.height)
    onChange('')
  }

  return (
    <div className="feld breit">
      <span>{label}</span>
      <canvas ref={ref} className="signatur" onPointerDown={start} onPointerMove={ziehen} onPointerUp={ende} onPointerCancel={ende} />
      <div className="knopfreihe eng">
        <span className="leise">{wert ? 'Unterschrieben' : 'Mit dem Finger unterschreiben'}</span>
        <button type="button" className="klein rechts" onClick={leeren}>Unterschrift löschen</button>
      </div>
    </div>
  )
}

export function FotoAuswahl({ fotos, onChange, label = 'Fotos' }) {
  const [laedt, setLaedt] = useState(false)
  const neu = async e => {
    const dateien = [...(e.target.files || [])]
    e.target.value = ''
    if (!dateien.length) return
    setLaedt(true)
    try {
      const bilder = await Promise.all(dateien.map(d => bildKomprimieren(d)))
      onChange([...fotos, ...bilder])
    } catch {
      alert('Ein Foto konnte nicht gelesen werden. Versuche ein JPG oder PNG.')
    } finally {
      setLaedt(false)
    }
  }
  return (
    <div className="feld breit">
      <span>{label}</span>
      {fotos.length > 0 && (
        <div className="fotoraster">
          {fotos.map((f, i) => (
            <figure key={i} className="fotokachel">
              <img src={f} alt={`Foto ${i + 1}`} />
              <button type="button" className="klein" onClick={() => onChange(fotos.filter((_, j) => j !== i))}>Entfernen</button>
            </figure>
          ))}
        </div>
      )}
      <label className="knopf">
        {laedt ? 'Fotos werden verkleinert …' : 'Foto aufnehmen oder auswählen'}
        <input type="file" accept="image/*" multiple hidden onChange={neu} />
      </label>
    </div>
  )
}

export function Zeilen({ zeilen, spalten, onChange, neu }) {
  const setze = (i, k, v) => onChange(zeilen.map((z, j) => (j === i ? { ...z, [k]: v } : z)))
  return (
    <div className="zeilen">
      {zeilen.map((z, i) => (
        <div key={i} className="zeilen-reihe">
          {spalten.map(s => (
            <input
              key={s.key}
              className={'z-' + s.key}
              placeholder={s.label}
              aria-label={s.label}
              inputMode={s.zahl ? 'decimal' : undefined}
              value={z[s.key] ?? ''}
              onChange={e => setze(i, s.key, e.target.value)}
            />
          ))}
          <button type="button" className="klein" aria-label="Zeile entfernen" onClick={() => onChange(zeilen.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="klein" onClick={() => onChange([...zeilen, { ...neu }])}>Zeile hinzufügen</button>
    </div>
  )
}
