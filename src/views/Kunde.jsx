import { useEffect, useState } from 'react'
import { kundenAnsicht, syncVerfuegbar } from '../sync'
import { fmtDatum } from '../store'

const STATUS = { geplant: 'In Planung', laufend: 'In Bau', abgeschlossen: 'Fertiggestellt' }

// Öffentliche Seite für Bauherren: nur lesen, keine Anmeldung, keine Kosten
export default function Kunde({ token }) {
  const [daten, setDaten] = useState(null)
  const [fehler, setFehler] = useState('')
  const [gross, setGross] = useState(null)

  useEffect(() => {
    if (!syncVerfuegbar) return setFehler('Diese Ansicht ist nur in der veröffentlichten App verfügbar.')
    kundenAnsicht(token)
      .then(d => (d ? setDaten(d) : setFehler('Dieser Link ist nicht (mehr) gültig.')))
      .catch(e => setFehler(e.message))
  }, [token])

  if (fehler || !daten)
    return (
      <div className="app">
        <header className="bauschild"><div className="bauschild-inhalt"><h1>Baufortschritt</h1></div></header>
        <main className="inhalt"><p className={fehler ? 'meldung' : 'leise'}>{fehler || 'Wird geladen …'}</p></main>
      </div>
    )

  const b = daten.baustelle
  const p = Math.max(0, Math.min(100, Number(b.fortschritt) || 0))
  const tage = [...new Set(daten.fotos.map(f => f.datum))]

  return (
    <div className="app">
      <header className="bauschild">
        <div className="bauschild-inhalt">
          <h1>{b.name}</h1>
          <p>{daten.firma}</p>
        </div>
      </header>
      <main className="inhalt kunde">
        <section className="kennzahlen">
          <div className="kz"><b>{STATUS[b.status] ?? b.status}</b><span>Status</span></div>
          {b.fortschritt !== '' && b.fortschritt != null && <div className="kz"><b>{p} %</b><span>Fortschritt</span></div>}
          {b.ende && <div className="kz"><b>{fmtDatum(b.ende)}</b><span>geplante Fertigstellung</span></div>}
        </section>
        {b.fortschritt !== '' && b.fortschritt != null && (
          <div className="balken gross" role="img" aria-label={`${p} Prozent fertig`}><div style={{ width: p + '%' }} /></div>
        )}
        {b.kundenInfo && (
          <section className="block">
            <h2>Aktuelles</h2>
            <p className="kunden-info">{b.kundenInfo}</p>
          </section>
        )}
        <section className="block">
          <h2>Fotos</h2>
          {daten.fotos.length === 0 ? (
            <p className="leise">Noch keine Fotos freigegeben.</p>
          ) : (
            tage.map(t => (
              <div key={t} className="tag">
                <h3>{fmtDatum(t)}</h3>
                <div className="galerie">
                  {daten.fotos.filter(f => f.datum === t).map((f, i) => (
                    <button key={i} className="galerie-bild" onClick={() => setGross(f)}>
                      <img src={f.bild} alt={f.notiz || f.bereich} loading="lazy" />
                      <span>{f.bereich}{f.notiz ? `: ${f.notiz}` : ''}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
        <p className="fussnote">Diese Seite zeigt nur, was die Baufirma freigegeben hat. Bei Fragen wenden Sie sich bitte direkt an {daten.firma}.</p>
      </main>
      {gross && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Foto" onClick={() => setGross(null)}>
          <div className="overlay-inhalt" onClick={e => e.stopPropagation()}>
            <img src={gross.bild} alt={gross.notiz || gross.bereich} />
            <p className="leise">{fmtDatum(gross.datum)}, {gross.bereich}{gross.notiz ? `: ${gross.notiz}` : ''}</p>
            <button onClick={() => setGross(null)}>Schließen</button>
          </div>
        </div>
      )}
    </div>
  )
}
