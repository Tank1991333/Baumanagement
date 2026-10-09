import { useState } from 'react'
import { uid, heute, fmtDatum, bildKomprimieren, upd, del, esc, drucken } from '../store'
import { Kopf, Leer, BaustellenAuswahl } from '../ui.jsx'
import Dokumente from './Dokumente.jsx'
import { t } from '../i18n'

const BEREICHE = ['Allgemein', 'Erdarbeiten', 'Fundament', 'Rohbau', 'Dach', 'Fassade', 'Innenausbau', 'Haustechnik', 'Außenanlagen', 'Schaden / Mangel']

export default function Fotos(props) {
  return (
    <>
      <FotoBereich {...props} />
      <section className="block">
        <Dokumente {...props} />
      </section>
    </>
  )
}

function FotoBereich({ daten, setDaten }) {
  const [filterBs, setFilterBs] = useState(() => daten.baustellen.find(b => b.status === 'laufend')?.id ?? 'alle')
  const [bereich, setBereich] = useState('Allgemein')
  const [notiz, setNotiz] = useState('')
  const [laedt, setLaedt] = useState(false)
  const [gross, setGross] = useState(null)
  const bs = id => daten.baustellen.find(b => b.id === id)?.name ?? '–'

  const hochladen = async e => {
    const dateien = [...(e.target.files || [])]
    e.target.value = ''
    if (!dateien.length) return
    if (filterBs === 'alle') return alert('Bitte zuerst oben eine Baustelle wählen.')
    setLaedt(true)
    try {
      const bilder = await Promise.all(dateien.map(d => bildKomprimieren(d)))
      const neu = bilder.map(bild => ({ id: uid(), baustelleId: filterBs, datum: heute(), zeit: new Date().toTimeString().slice(0, 5), bereich, notiz, bild }))
      setDaten(d => ({ ...d, fotos: [...neu, ...d.fotos] }))
      setNotiz('')
    } catch {
      alert('Ein Foto konnte nicht gelesen werden.')
    } finally {
      setLaedt(false)
    }
  }

  const liste = daten.fotos
    .filter(x => filterBs === 'alle' || x.baustelleId === filterBs)
    .sort((a, b) => b.datum.localeCompare(a.datum) || (b.zeit || '').localeCompare(a.zeit || ''))
  const tage = [...new Set(liste.map(x => x.datum))]

  const doku = () =>
    drucken(`Fotodokumentation ${bs(filterBs)}`, tage.map(t => `<h2>${esc(fmtDatum(t))}</h2><div class="fotos">${liste
      .filter(x => x.datum === t)
      .map(x => `<figure style="display:inline-block;width:31%;margin:1%;vertical-align:top"><img src="${x.bild}" style="width:100%"><figcaption style="font-size:9pt">${esc(x.bereich)}${x.notiz ? ': ' + esc(x.notiz) : ''}</figcaption></figure>`)
      .join('')}</div>`).join(''), daten.firma)

  return (
    <>
      <Kopf titel="Fotodokumentation">
        <BaustellenAuswahl daten={daten} value={filterBs} onChange={setFilterBs} alle label="Baustelle wählen" />
        {filterBs !== 'alle' && liste.length > 0 && <button className="klein" onClick={doku}>Als PDF drucken</button>}
      </Kopf>

      <div className="formular foto-neu">
        <div className="raster">
          <label className="feld">
            <span>Bauabschnitt</span>
            <select value={bereich} onChange={e => setBereich(e.target.value)}>{BEREICHE.map(b => <option key={b}>{b}</option>)}</select>
          </label>
          <label className="feld">
            <span>Notiz zu den nächsten Fotos</span>
            <input value={notiz} onChange={e => setNotiz(e.target.value)} placeholder="z. B. Abdichtung vor Verfüllung" />
          </label>
        </div>
        <div className="knopfreihe">
          <label className={'knopf primaer' + (filterBs === 'alle' ? ' gesperrt' : '')}>
            {laedt ? '…' : t('Fotos aufnehmen oder auswählen')}
            <input type="file" accept="image/*" multiple hidden onChange={hochladen} disabled={filterBs === 'alle'} />
          </label>
          {filterBs === 'alle' && <span className="leise">Wähle oben eine Baustelle.</span>}
        </div>
      </div>

      {liste.length === 0 ? (
        <Leer titel="Noch keine Fotos" text="Fotos mit Datum und Bauabschnitt beweisen später, was wann wie eingebaut wurde, etwa vor dem Verfüllen oder Verputzen." />
      ) : (
        tage.map(t => (
          <div key={t} className="tag">
            <h3>{fmtDatum(t)}</h3>
            <div className="galerie">
              {liste.filter(x => x.datum === t).map(x => (
                <button key={x.id} className="galerie-bild" onClick={() => setGross(x)}>
                  <img src={x.bild} alt={`${x.bereich} ${x.notiz}`} loading="lazy" />
                  <span>{x.fuerKunde ? '👁 ' : ''}{x.bereich}{filterBs === 'alle' ? `, ${bs(x.baustelleId)}` : ''}</span>
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      {gross && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Foto" onClick={() => setGross(null)}>
          <div className="overlay-inhalt" onClick={e => e.stopPropagation()}>
            <img src={gross.bild} alt={gross.notiz || gross.bereich} />
            <p className="leise">{bs(gross.baustelleId)}, {fmtDatum(gross.datum)} {gross.zeit}, {gross.bereich}</p>
            <input
              value={gross.notiz}
              placeholder="Notiz"
              aria-label="Notiz"
              onChange={e => { const v = e.target.value; setGross({ ...gross, notiz: v }); upd(setDaten, 'fotos', gross.id, { notiz: v }) }}
            />
            <label className="recht">
              <input
                type="checkbox"
                checked={!!gross.fuerKunde}
                onChange={e => { const v = e.target.checked; setGross({ ...gross, fuerKunde: v }); upd(setDaten, 'fotos', gross.id, { fuerKunde: v }) }}
              />
              <span><b>Für den Bauherrn sichtbar</b><span className="leise">erscheint im Bauherren-Link dieser Baustelle</span></span>
            </label>
            <div className="knopfreihe">
              <a className="knopf" href={gross.bild} download={`foto_${gross.datum}.jpg`}>Herunterladen</a>
              <button onClick={() => setGross(null)}>Schließen</button>
              <button className="gefahr rechts" onClick={() => { if (confirm('Foto löschen?')) { del(setDaten, 'fotos', gross.id); setGross(null) } }}>Löschen</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
