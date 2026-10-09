import { useState } from 'react'
import { heute, wochenStart, plusTage, fmtKurz } from '../store'
import { Kopf, Leer } from '../ui.jsx'

export default function Plan({ daten, setDaten, rechte, ich }) {
  const [woche, setWoche] = useState(wochenStart())
  const tage = [0, 1, 2, 3, 4, 5].map(i => plusTage(woche, i))
  const chef = rechte.planen
  const team = daten.mitarbeiter.filter(m => m.aktiv !== false)
  const offeneBs = daten.baustellen.filter(b => b.status !== 'abgeschlossen')
  const bs = id => daten.baustellen.find(b => b.id === id)?.name ?? ''
  const eintrag = (datum, maId) => daten.plan.find(p => p.id === `${datum}_${maId}`)
  const farbe = id => {
    const i = daten.baustellen.findIndex(b => b.id === id)
    return i < 0 ? '' : 'f' + (i % 6)
  }

  const setzen = (datum, mitarbeiterId, baustelleId) => {
    const id = `${datum}_${mitarbeiterId}`
    setDaten(d => ({
      ...d,
      plan: [...d.plan.filter(p => p.id !== id), ...(baustelleId ? [{ id, datum, mitarbeiterId, baustelleId }] : [])],
    }))
  }

  const vorwoche = () => {
    const alt = daten.plan.filter(p => p.datum >= plusTage(woche, -7) && p.datum < woche)
    if (!alt.length) return alert('In der Vorwoche ist nichts eingeplant.')
    if (!confirm('Einteilung der Vorwoche in diese Woche übernehmen? Vorhandene Einträge werden überschrieben.')) return
    const neu = alt.map(p => {
      const datum = plusTage(p.datum, 7)
      return { ...p, id: `${datum}_${p.mitarbeiterId}`, datum }
    })
    const ids = new Set(neu.map(p => p.id))
    setDaten(d => ({ ...d, plan: [...d.plan.filter(p => !ids.has(p.id)), ...neu] }))
  }

  const navi = (
    <>
      <button className="klein" onClick={() => setWoche(plusTage(woche, -7))} aria-label="Vorige Woche">‹</button>
      <button className="klein" onClick={() => setWoche(wochenStart())}>Diese Woche</button>
      <button className="klein" onClick={() => setWoche(plusTage(woche, 7))} aria-label="Nächste Woche">›</button>
    </>
  )

  if (!chef) {
    return (
      <>
        <Kopf titel="Mein Einsatzplan">{navi}</Kopf>
        {!ich ? (
          <Leer titel="Dein Konto ist keinem Mitarbeiter zugeordnet" text="Der Chef ordnet dein Konto unter Team → Wer sieht was deinem Namen zu." />
        ) : (
          <ul className="liste">
            {tage.map(t => {
              const p = eintrag(t, ich.id)
              return (
                <li key={t} className={'zeile' + (t === heute() ? ' heute' : '')}>
                  <strong className="tagname">{fmtKurz(t)}</strong>
                  <span className={p ? '' : 'leise'}>{p ? bs(p.baustelleId) : 'nicht eingeplant'}</span>
                </li>
              )
            })}
          </ul>
        )}
      </>
    )
  }

  return (
    <>
      <Kopf titel="Plantafel">
        {navi}
        <button className="klein" onClick={vorwoche}>Vorwoche übernehmen</button>
      </Kopf>
      {team.length === 0 || offeneBs.length === 0 ? (
        <Leer titel="Plantafel noch leer" text="Lege zuerst Mitarbeiter und Baustellen an." />
      ) : (
        <div className="tafel-rahmen">
          <table className="tafel">
            <thead>
              <tr>
                <th scope="col">Mitarbeiter</th>
                {tage.map(t => <th key={t} scope="col" className={t === heute() ? 'heute' : ''}>{fmtKurz(t)}</th>)}
              </tr>
            </thead>
            <tbody>
              {team.map(m => (
                <tr key={m.id}>
                  <th scope="row">{m.name}<span>{m.rolle}</span></th>
                  {tage.map(t => {
                    const p = eintrag(t, m.id)
                    return (
                      <td key={t} className={p ? farbe(p.baustelleId) : ''}>
                        <select value={p?.baustelleId ?? ''} onChange={e => setzen(t, m.id, e.target.value)} aria-label={`${m.name}, ${fmtKurz(t)}`}>
                          <option value="">frei</option>
                          {offeneBs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="fussnote">Jeder Mitarbeiter sieht seinen Plan in der App, und die Stempeluhr schlägt die eingeplante Baustelle vor.</p>
    </>
  )
}
