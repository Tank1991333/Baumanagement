import { useEffect, useState } from 'react'
import { add, upd, del, uid, heute, lokalDatum, uhrzeit, stunden, pauseNachArbZG, fmtStd, fmtDatum, csv, herunterladen } from '../store'
import { Feld, Kopf, Leer, Formular } from '../ui.jsx'

export default function Zeiten({ daten, setDaten, rechte, ich }) {
  const [monat, setMonat] = useState(heute().slice(0, 7))
  const [form, setForm] = useState(null)
  const [wahl, setWahl] = useState({})
  const [, tick] = useState(0)
  const chef = rechte.alleZeiten

  useEffect(() => {
    const t = setInterval(() => tick(x => x + 1), 30000)
    return () => clearInterval(t)
  }, [])

  const team = daten.mitarbeiter.filter(m => m.aktiv !== false && (chef || m.id === ich?.id))
  const offeneBs = daten.baustellen.filter(b => b.status !== 'abgeschlossen')
  const name = id => daten.mitarbeiter.find(m => m.id === id)?.name ?? 'Unbekannt'
  const bs = id => daten.baustellen.find(b => b.id === id)?.name ?? '–'
  const f = k => e => setForm({ ...form, [k]: e.target.value })
  const geplant = maId => daten.plan.find(p => p.id === `${heute()}_${maId}`)?.baustelleId
  const vorschlag = maId => wahl[maId] || geplant(maId) || offeneBs[0]?.id || ''

  const einstempeln = maId => {
    const baustelleId = vorschlag(maId)
    if (!baustelleId) return alert('Lege zuerst eine Baustelle an.')
    setDaten(d => ({
      ...d,
      stempel: [...d.stempel.filter(s => s.id !== maId), { id: maId, mitarbeiterId: maId, baustelleId, start: new Date().toISOString() }],
    }))
  }

  const ausstempeln = maId =>
    setDaten(d => {
      const s = d.stempel.find(x => x.id === maId)
      if (!s) return d
      const start = new Date(s.start)
      const ende = new Date()
      const brutto = (ende - start) / 3600000
      const pause = pauseNachArbZG(brutto)
      const eintrag = {
        id: uid(),
        datum: lokalDatum(start),
        mitarbeiterId: maId,
        baustelleId: s.baustelleId,
        von: uhrzeit(start),
        bis: uhrzeit(ende),
        pause,
        taetigkeit: '',
        stunden: Math.max(0, Math.round((brutto - pause / 60) * 100) / 100),
      }
      return { ...d, stempel: d.stempel.filter(x => x.id !== maId), zeiten: [eintrag, ...d.zeiten] }
    })

  const neu = () => {
    const maId = chef ? team[0]?.id ?? '' : ich?.id ?? ''
    setForm({ datum: heute(), mitarbeiterId: maId, baustelleId: geplant(maId) || offeneBs[0]?.id || '', von: '07:00', bis: '16:00', pause: 30, taetigkeit: '' })
  }

  const speichern = e => {
    e.preventDefault()
    if (!form.mitarbeiterId || !form.baustelleId) return alert('Bitte Mitarbeiter und Baustelle wählen.')
    const eintrag = { ...form, pause: Number(form.pause) || 0, stunden: stunden(form.von, form.bis, form.pause) }
    form.id ? upd(setDaten, 'zeiten', form.id, eintrag) : add(setDaten, 'zeiten', eintrag)
    setForm(null)
  }

  const imMonat = daten.zeiten
    .filter(z => z.datum.startsWith(monat) && (chef || z.mitarbeiterId === ich?.id))
    .sort((a, b) => b.datum.localeCompare(a.datum) || (a.von || '').localeCompare(b.von || ''))
  const tage = [...new Set(imMonat.map(z => z.datum))]
  const proKopf = Object.entries(
    imMonat.reduce((acc, z) => ({ ...acc, [z.mitarbeiterId]: (acc[z.mitarbeiterId] || 0) + z.stunden }), {})
  ).sort((a, b) => b[1] - a[1])

  const exportieren = () => {
    const zeilen = [['Datum', 'Mitarbeiter', 'Baustelle', 'Von', 'Bis', 'Pause (Min.)', 'Stunden', 'Tätigkeit']]
    ;[...imMonat].reverse().forEach(z =>
      zeilen.push([z.datum, name(z.mitarbeiterId), bs(z.baustelleId), z.von, z.bis, z.pause, z.stunden.toFixed(2).replace('.', ','), z.taetigkeit])
    )
    herunterladen(`Stunden_${monat}.csv`, csv(zeilen))
  }

  const lohnExport = () => {
    const proTag = {}
    imMonat.forEach(z => {
      const k = z.mitarbeiterId + '|' + z.datum
      proTag[k] = (proTag[k] || 0) + z.stunden
    })
    const zeilen = [['Personalnummer', 'Name', 'Datum', 'Stunden']]
    Object.entries(proTag)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([k, h]) => {
        const [maId, datum] = k.split('|')
        const m = daten.mitarbeiter.find(x => x.id === maId)
        zeilen.push([m?.personalnummer ?? '', m?.name ?? '', datum.split('-').reverse().join('.'), h.toFixed(2).replace('.', ',')])
      })
    zeilen.push([])
    zeilen.push(['Personalnummer', 'Name', 'Monat', 'Summe Stunden'])
    proKopf.forEach(([id, h]) => {
      const m = daten.mitarbeiter.find(x => x.id === id)
      zeilen.push([m?.personalnummer ?? '', m?.name ?? '', monat, h.toFixed(2).replace('.', ',')])
    })
    herunterladen(`Lohn_${monat}.csv`, csv(zeilen))
  }

  return (
    <>
      <section className="block">
        <Kopf titel="Stempeluhr" />
        {team.length === 0 ? (
          <Leer
            titel={chef ? 'Noch keine Mitarbeiter' : 'Dein Konto ist keinem Mitarbeiter zugeordnet'}
            text={chef ? 'Lege dein Team unter „Team“ an.' : 'Der Chef ordnet dein Konto unter Team → Wer sieht was deinem Namen zu.'}
          />
        ) : (
          <ul className="liste stempel">
            {team.map(m => {
              const s = daten.stempel.find(x => x.id === m.id)
              const laufend = s ? (Date.now() - new Date(s.start)) / 3600000 : 0
              return (
                <li key={m.id} className={'zeile' + (s ? ' an' : '')}>
                  <div className="stempel-name">
                    <strong>{m.name}</strong>
                    <span className="leise">
                      {s ? `${bs(s.baustelleId)}, seit ${uhrzeit(s.start)} Uhr (${fmtStd(laufend)})` : m.rolle}
                    </span>
                  </div>
                  {s ? (
                    <button className="gefahr" onClick={() => ausstempeln(m.id)}>Ausstempeln</button>
                  ) : (
                    <div className="stempel-aktion">
                      <select value={vorschlag(m.id)} onChange={e => setWahl({ ...wahl, [m.id]: e.target.value })} aria-label={'Baustelle für ' + m.name}>
                        {offeneBs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                      <button className="primaer" onClick={() => einstempeln(m.id)}>Einstempeln</button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className="fussnote">Vorausgewählt ist die Baustelle aus der Plantafel. Beim Ausstempeln wird die gesetzliche Pause abgezogen: über 6 Stunden 30 Minuten, über 9 Stunden 45 Minuten.</p>
      </section>

      <section className="block">
        <Kopf titel={chef ? 'Stundenzettel' : 'Meine Stunden'}>
          <input type="month" value={monat} onChange={e => setMonat(e.target.value)} aria-label="Monat" />
          {!form && team.length > 0 && <button className="primaer" onClick={neu}>Zeit nachtragen</button>}
        </Kopf>

        {form && (
          <Formular
            titel={form.id ? 'Eintrag bearbeiten' : 'Zeit nachtragen'}
            onSubmit={speichern}
            onAbbrechen={() => setForm(null)}
            kannLoeschen={!!form.id}
            onLoeschen={() => { del(setDaten, 'zeiten', form.id); setForm(null) }}
          >
            <Feld label="Datum"><input type="date" required value={form.datum} onChange={f('datum')} /></Feld>
            <Feld label="Mitarbeiter">
              <select value={form.mitarbeiterId} onChange={f('mitarbeiterId')} disabled={!chef}>
                {daten.mitarbeiter.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Feld>
            <Feld label="Baustelle" breit>
              <select value={form.baustelleId} onChange={f('baustelleId')}>
                {daten.baustellen.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Feld>
            <Feld label="Von"><input type="time" required value={form.von} onChange={f('von')} /></Feld>
            <Feld label="Bis"><input type="time" required value={form.bis} onChange={f('bis')} /></Feld>
            <Feld label="Pause (Min.)"><input type="number" min="0" step="5" value={form.pause} onChange={f('pause')} /></Feld>
            <Feld label="Ergibt"><output>{fmtStd(stunden(form.von, form.bis, form.pause))}</output></Feld>
            <Feld label="Tätigkeit" breit><input value={form.taetigkeit} onChange={f('taetigkeit')} placeholder="z. B. Schalung Bodenplatte" /></Feld>
          </Formular>
        )}

        {imMonat.length === 0 ? (
          <Leer titel="Keine Zeiten in diesem Monat" />
        ) : (
          <>
            <div className="summen">
              {proKopf.map(([id, h]) => (
                <div key={id}><span>{name(id)}</span><b>{fmtStd(h)}</b></div>
              ))}
            </div>
            {chef && (
              <div className="knopfreihe unten">
                <button onClick={exportieren}>Stundenliste als CSV</button>
                {rechte.chef && <button onClick={lohnExport}>Export für Lohnbüro</button>}
              </div>
            )}
            {tage.map(t => (
              <div key={t} className="tag">
                <h3>{fmtDatum(t)}</h3>
                <ul className="liste">
                  {imMonat.filter(z => z.datum === t).map(z => (
                    <li key={z.id}>
                      <button className="zeile zeilenknopf" onClick={() => setForm({ ...z })}>
                        <strong>{name(z.mitarbeiterId)}</strong>
                        <span className="leise">{bs(z.baustelleId)}{z.taetigkeit ? `, ${z.taetigkeit}` : ''}</span>
                        <span className="rechts zahl">{z.von}–{z.bis}, {fmtStd(z.stunden)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}
      </section>
    </>
  )
}
