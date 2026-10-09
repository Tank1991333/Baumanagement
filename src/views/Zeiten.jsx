import { useEffect, useState } from 'react'
import {
  add, upd, del, uid, heute, lokalDatum, uhrzeit, stunden, pauseNachAZG, fmtStd, fmtDatum, csv, herunterladen,
  stundenkonto, zahl, entfernungM, abwesendAm, feiertag,
} from '../store'
import { aktuellerStandort } from '../wetter'
import { Feld, Kopf, Leer, Formular } from '../ui.jsx'
import { t } from '../i18n'

const ortText = (ort, bs) => {
  if (!ort) return ''
  const m = entfernungM(ort, bs)
  return m == null ? ' · Standort gespeichert' : m < 300 ? ' · auf der Baustelle' : ` · ${m >= 1000 ? (m / 1000).toFixed(1) + ' km' : m + ' m'} entfernt`
}

export default function Zeiten({ daten, setDaten, rechte, ich }) {
  const [monat, setMonat] = useState(heute().slice(0, 7))
  const [form, setForm] = useState(null)
  const [wahl, setWahl] = useState({})
  const [laedt, setLaedt] = useState('')
  const [, tick] = useState(0)
  const chef = rechte.alleZeiten
  const gps = daten.einstellungen.gpsStempeln

  useEffect(() => {
    const i = setInterval(() => tick(x => x + 1), 30000)
    return () => clearInterval(i)
  }, [])

  const team = daten.mitarbeiter.filter(m => m.aktiv !== false && (chef || m.id === ich?.id))
  const offeneBs = daten.baustellen.filter(b => b.status !== 'abgeschlossen')
  const name = id => daten.mitarbeiter.find(m => m.id === id)?.name ?? 'Unbekannt'
  const bsObj = id => daten.baustellen.find(b => b.id === id)
  const bs = id => bsObj(id)?.name ?? '–'
  const f = k => e => setForm({ ...form, [k]: e.target.value })
  const geplant = maId => daten.plan.find(p => p.id === `${heute()}_${maId}`)?.baustelleId
  const vorschlag = maId => wahl[maId] || geplant(maId) || offeneBs[0]?.id || ''

  const ort = async () => {
    if (!gps) return null
    try { return await aktuellerStandort(8000) } catch { return { fehler: true } }
  }

  const einstempeln = async maId => {
    const baustelleId = vorschlag(maId)
    if (!baustelleId) return alert('Lege zuerst eine Baustelle an.')
    setLaedt(maId)
    const startOrt = await ort()
    setLaedt('')
    setDaten(d => ({
      ...d,
      stempel: [...d.stempel.filter(s => s.id !== maId), { id: maId, mitarbeiterId: maId, baustelleId, start: new Date().toISOString(), startOrt }],
    }))
  }

  const ausstempeln = async maId => {
    setLaedt(maId)
    const endeOrt = await ort()
    setLaedt('')
    setDaten(d => {
      const s = d.stempel.find(x => x.id === maId)
      if (!s) return d
      const start = new Date(s.start)
      const ende = new Date()
      const brutto = (ende - start) / 3600000
      const pause = pauseNachAZG(brutto)
      const eintrag = {
        id: uid(), datum: lokalDatum(start), mitarbeiterId: maId, baustelleId: s.baustelleId,
        von: uhrzeit(start), bis: uhrzeit(ende), pause, taetigkeit: '',
        stunden: Math.max(0, Math.round((brutto - pause / 60) * 100) / 100),
        ...(s.startOrt ? { startOrt: s.startOrt } : {}), ...(endeOrt ? { endeOrt } : {}),
      }
      return { ...d, stempel: d.stempel.filter(x => x.id !== maId), zeiten: [eintrag, ...d.zeiten] }
    })
  }

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

  const sichtbar = z => chef || z.mitarbeiterId === ich?.id
  const imMonat = daten.zeiten
    .filter(z => z.datum.startsWith(monat) && sichtbar(z))
    .sort((a, b) => b.datum.localeCompare(a.datum) || (a.von || '').localeCompare(b.von || ''))
  const tage = [...new Set(imMonat.map(z => z.datum))]
  const proKopf = Object.entries(
    imMonat.reduce((acc, z) => ({ ...acc, [z.mitarbeiterId]: (acc[z.mitarbeiterId] || 0) + z.stunden }), {})
  ).sort((a, b) => b[1] - a[1])

  const komma = x => (Math.round(x * 100) / 100).toFixed(2).replace('.', ',')
  const exportieren = () => {
    const zeilen = [['Datum', 'Mitarbeiter', 'Baustelle', 'Von', 'Bis', 'Pause (Min.)', 'Stunden', 'Tätigkeit']]
    ;[...imMonat].reverse().forEach(z => zeilen.push([z.datum, name(z.mitarbeiterId), bs(z.baustelleId), z.von, z.bis, z.pause, komma(z.stunden), z.taetigkeit]))
    herunterladen(`Stunden_${monat}.csv`, csv(zeilen))
  }

  const lohnExport = () => {
    const proTag = {}
    imMonat.forEach(z => {
      const k = z.mitarbeiterId + '|' + z.datum
      proTag[k] = (proTag[k] || 0) + z.stunden
    })
    const zeilen = [['Personalnummer', 'Name', 'Datum', 'Stunden', 'Abwesenheit', 'Schlechtwetter (h)']]
    const maIds = [...new Set([...imMonat.map(z => z.mitarbeiterId), ...daten.mitarbeiter.filter(m => m.aktiv !== false).map(m => m.id)])]
    const [j, mo] = monat.split('-').map(Number)
    const tageImMonat = new Date(j, mo, 0).getDate()
    maIds.forEach(maId => {
      const m = daten.mitarbeiter.find(x => x.id === maId)
      for (let d = 1; d <= tageImMonat; d++) {
        const datum = `${monat}-${String(d).padStart(2, '0')}`
        const h = proTag[maId + '|' + datum] || 0
        const a = abwesendAm(daten, maId, datum)
        const sw = daten.tagebuch.filter(x => x.datum === datum && (x.schlechtwetter?.mitarbeiter || []).includes(maId)).reduce((s, x) => s + zahl(x.schlechtwetter.stunden), 0)
        if (h || a || sw) zeilen.push([m?.personalnummer ?? '', m?.name ?? '', datum.split('-').reverse().join('.'), komma(h), a?.art ?? '', sw ? komma(sw) : ''])
      }
    })
    herunterladen(`Lohn_${monat}.csv`, csv(zeilen))
  }

  const schlechtwetterExport = () => {
    const zeilen = [['Datum', 'Baustelle', 'Grund', 'Personalnummer', 'Name', 'Ausfallstunden', 'Wetterdaten']]
    daten.tagebuch
      .filter(x => x.datum.startsWith(monat) && x.schlechtwetter?.stunden)
      .sort((a, b) => a.datum.localeCompare(b.datum))
      .forEach(x =>
        (x.schlechtwetter.mitarbeiter || []).forEach(maId => {
          const m = daten.mitarbeiter.find(y => y.id === maId)
          zeilen.push([x.datum.split('-').reverse().join('.'), bs(x.baustelleId), x.schlechtwetter.grund, m?.personalnummer ?? '', m?.name ?? '', komma(zahl(x.schlechtwetter.stunden)), x.wetterDetail || `${x.wetter} ${x.temperatur ? x.temperatur + ' °C' : ''}`])
        })
      )
    if (zeilen.length === 1) return alert('In diesem Monat ist kein Schlechtwetter im Bautagebuch erfasst.')
    herunterladen(`Schlechtwetter_BUAK_${monat}.csv`, csv(zeilen))
  }

  const kontoListe = (chef ? daten.mitarbeiter.filter(m => m.aktiv !== false) : ich ? [ich] : [])
    .map(m => ({ m, k: stundenkonto(daten, m.id) }))
    .filter(x => x.k)

  return (
    <>
      <section className="block erster">
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
              const abw = abwesendAm(daten, m.id, heute())
              return (
                <li key={m.id} className={'zeile' + (s ? ' an' : '')}>
                  <div className="stempel-name">
                    <strong>{m.name}</strong>
                    <span className="leise">
                      {s
                        ? `${bs(s.baustelleId)}, ${t('seit')} ${uhrzeit(s.start)} (${fmtStd(laufend)})${ortText(s.startOrt?.fehler ? null : s.startOrt, bsObj(s.baustelleId))}`
                        : abw ? `${t(abw.art)}` : m.rolle}
                    </span>
                  </div>
                  {s ? (
                    <button className="gefahr" disabled={laedt === m.id} onClick={() => ausstempeln(m.id)}>{laedt === m.id ? '…' : t('Ausstempeln')}</button>
                  ) : (
                    <div className="stempel-aktion">
                      <select value={vorschlag(m.id)} onChange={e => setWahl({ ...wahl, [m.id]: e.target.value })} aria-label={'Baustelle für ' + m.name}>
                        {offeneBs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                      <button className="primaer" disabled={laedt === m.id} onClick={() => einstempeln(m.id)}>{laedt === m.id ? '…' : t('Einstempeln')}</button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className="fussnote">
          Vorausgewählt ist die Baustelle aus der Plantafel. Beim Ausstempeln werden nach § 11 AZG bei mehr als 6 Stunden 30 Minuten Pause abgezogen.
          {gps && ' Beim Ein- und Ausstempeln wird der Standort gespeichert.'}
          {feiertag(heute()) && ` Heute ist ${feiertag(heute())}.`}
        </p>
      </section>

      <section className="block">
        <Kopf titel={chef ? 'Stundenkonto' : 'Mein Stundenkonto'} />
        {kontoListe.length === 0 ? (
          <Leer titel="Kein Stundenkonto" text="Das Konto erscheint, sobald ein Mitarbeiter zugeordnet ist." />
        ) : (
          <ul className="liste">
            {kontoListe.map(({ m, k }) => (
              <li key={m.id} className="zeile">
                <div className="stempel-name">
                  <strong>{m.name}</strong>
                  <span className="leise">
                    seit {fmtDatum(k.start)}: Soll {fmtStd(k.soll)}, gearbeitet {fmtStd(k.ist)}
                    {k.gutschrift ? `, Abwesenheit ${fmtStd(k.gutschrift)}` : ''}
                    {k.schlechtwetter ? `, Schlechtwetter ${fmtStd(k.schlechtwetter)}` : ''}
                  </span>
                </div>
                <b className={'saldo ' + (k.saldo < 0 ? 'minus' : 'plus')}>{k.saldo > 0 ? '+' : ''}{fmtStd(k.saldo)}</b>
              </li>
            ))}
          </ul>
        )}
        <p className="fussnote">Soll aus den Wochenstunden (Bau-KV: 39 h), ohne Wochenenden und österreichische Feiertage. Urlaub, Krankenstand und Schulung gelten als erfüllt, Zeitausgleich baut Guthaben ab. Start und Anfangssaldo stellt der Chef unter Team ein.</p>
      </section>

      <section className="block">
        <Kopf titel={chef ? 'Stundenzettel' : 'Meine Stunden'}>
          <input type="month" value={monat} onChange={e => setMonat(e.target.value)} aria-label="Monat" />
          {!form && team.length > 0 && <button className="primaer" onClick={neu}>{t('Zeit nachtragen')}</button>}
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
              {proKopf.map(([id, h]) => <div key={id}><span>{name(id)}</span><b>{fmtStd(h)}</b></div>)}
            </div>
            {chef && (
              <div className="knopfreihe unten">
                <button onClick={exportieren}>Stundenliste als CSV</button>
                {rechte.chef && <button onClick={lohnExport}>Export für Lohnverrechnung</button>}
                {rechte.chef && <button onClick={schlechtwetterExport}>Schlechtwetter für BUAK</button>}
              </div>
            )}
            {tage.map(tg => (
              <div key={tg} className="tag">
                <h3>{fmtDatum(tg)}{feiertag(tg) ? ` · ${feiertag(tg)}` : ''}</h3>
                <ul className="liste">
                  {imMonat.filter(z => z.datum === tg).map(z => (
                    <li key={z.id}>
                      <button className="zeile zeilenknopf" onClick={() => setForm({ ...z })}>
                        <strong>{name(z.mitarbeiterId)}</strong>
                        <span className="leise">
                          {bs(z.baustelleId)}{z.taetigkeit ? `, ${z.taetigkeit}` : ''}
                          {chef && z.startOrt && !z.startOrt.fehler ? ortText(z.startOrt, bsObj(z.baustelleId)) : ''}
                        </span>
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
