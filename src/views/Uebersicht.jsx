import { useMemo, useState } from 'react'
import { heute, wochenStart, fmtStd, uhrzeit, erinnerungen, feiertag, abwesendAm } from '../store'
import { t } from '../i18n'
import { Kopf, Leer } from '../ui.jsx'

function suchen(d, q) {
  const s = q.trim().toLowerCase()
  if (s.length < 2) return []
  const passt = (...felder) => felder.some(f => String(f ?? '').toLowerCase().includes(s))
  const bs = id => d.baustellen.find(b => b.id === id)?.name ?? ''
  const r = []
  d.baustellen.forEach(b => passt(b.name, b.adresse, b.kunde, b.notiz) && r.push({ id: b.id, art: 'Baustelle', text: b.name, ziel: 'baustellen' }))
  d.maengel.forEach(m => passt(m.titel, m.beschreibung) && r.push({ id: m.id, art: m.typ, text: m.titel, info: bs(m.baustelleId), ziel: 'maengel' }))
  d.tagebuch.forEach(t => passt(t.leistungen, t.behinderungen, t.lieferungen, t.besucher) && r.push({ id: t.id, art: 'Bautagebuch', text: `${bs(t.baustelleId)}, ${t.datum}`, ziel: 'tagebuch' }))
  d.regie.forEach(x => passt(x.beschreibung, x.auftraggeber) && r.push({ id: x.id, art: 'Regiebericht', text: x.beschreibung.slice(0, 60), info: bs(x.baustelleId), ziel: 'regie' }))
  d.bestellungen.forEach(x => passt(x.artikel, x.lieferant) && r.push({ id: x.id, art: 'Bestellung', text: x.artikel, info: bs(x.baustelleId), ziel: 'material' }))
  d.geraete.forEach(x => passt(x.name, x.inventarnr, x.notiz) && r.push({ id: x.id, art: 'Gerät', text: x.name, ziel: 'material' }))
  d.fotos.forEach(x => passt(x.notiz, x.bereich) && r.push({ id: x.id, art: 'Foto', text: x.notiz || x.bereich, info: bs(x.baustelleId), ziel: 'fotos' }))
  d.mitarbeiter.forEach(m => passt(m.name, m.rolle) && r.push({ id: m.id, art: 'Mitarbeiter', text: m.name, ziel: 'team' }))
  return r.slice(0, 40)
}

export default function Uebersicht({ daten, gehe, rolle, rechte, ich }) {
  const [suche, setSuche] = useState('')
  const [erlaubnis, setErlaubnis] = useState(() => ('Notification' in window ? Notification.permission : 'nicht'))
  const h = heute()
  const ws = wochenStart()
  const name = id => daten.mitarbeiter.find(m => m.id === id)?.name ?? 'Unbekannt'
  const bs = id => daten.baustellen.find(b => b.id === id)?.name ?? '–'

  const meine = z => rechte.alleZeiten || z.mitarbeiterId === ich?.id
  const aktiv = daten.baustellen.filter(b => b.status === 'laufend')
  const stdHeute = daten.zeiten.filter(z => z.datum === h && meine(z)).reduce((s, z) => s + z.stunden, 0)
  const stdWoche = daten.zeiten.filter(z => z.datum >= ws && meine(z)).reduce((s, z) => s + z.stunden, 0)
  const offen = daten.maengel.filter(m => !m.erledigt)
  const liste = erinnerungen(daten, rolle)
  const mitBericht = new Set(daten.tagebuch.filter(t => t.datum === h).map(t => t.baustelleId))
  const ohneBericht = aktiv.filter(b => !mitBericht.has(b.id))
  const treffer = useMemo(() => suchen(daten, suche), [daten, suche])
  const meinPlan = ich ? daten.plan.find(p => p.id === `${h}_${ich.id}`) : null

  const erlauben = async () => {
    try { setErlaubnis(await Notification.requestPermission()) } catch { setErlaubnis('denied') }
  }

  return (
    <>
      <div className="suche">
        <input type="search" value={suche} onChange={e => setSuche(e.target.value)} placeholder="Suchen in Baustellen, Mängeln, Berichten, Material …" aria-label="Suchen" />
      </div>

      {suche.trim().length >= 2 ? (
        <section className="block">
          <Kopf titel={`${treffer.length} Treffer`} />
          {treffer.length ? (
            <ul className="liste">
              {treffer.map(t => (
                <li key={t.art + t.id}>
                  <button className="zeile zeilenknopf" onClick={() => gehe(t.ziel)}>
                    <span className="marke">{t.art}</span>
                    <strong>{t.text}</strong>
                    {t.info && <span className="leise">{t.info}</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Leer titel="Nichts gefunden" text="Versuche einen anderen Begriff." />
          )}
        </section>
      ) : (
        <>
          {feiertag(h) && <p className="einsatz">Heute ist {feiertag(h)}.</p>}
          {meinPlan && (
            <p className="einsatz">{t('Heute eingeplant')}: <strong>{bs(meinPlan.baustelleId)}</strong></p>
          )}

          <section className="kennzahlen">
            <button onClick={() => gehe('baustellen')}><b>{aktiv.length}</b><span>laufende Baustellen</span></button>
            <button onClick={() => gehe('zeiten')}><b>{fmtStd(stdHeute)}</b><span>{rechte.alleZeiten ? 'heute erfasst' : 'meine Stunden heute'}</span></button>
            <button onClick={() => gehe('zeiten')}><b>{fmtStd(stdWoche)}</b><span>{rechte.alleZeiten ? 'diese Woche' : 'meine Woche'}</span></button>
            <button onClick={() => gehe('maengel')}><b>{offen.length}</b><span>offene Mängel & Aufgaben</span></button>
          </section>

          <section className="block">
            <Kopf titel="Erinnerungen">
              {erlaubnis === 'default' && <button className="klein" onClick={erlauben}>Als Mitteilung aufs Handy</button>}
            </Kopf>
            {liste.length ? (
              <ul className="liste">
                {liste.map(e => (
                  <li key={e.id}>
                    <button className="zeile zeilenknopf" onClick={() => gehe(e.ziel)}>
                      {e.rot && <span className="marke dringend">überfällig</span>}
                      <strong>{e.text}</strong>
                      <span className="leise">{e.info}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Leer titel="Nichts fällig" text="Fristen, Lieferungen, Geräteprüfungen und Unterweisungen sind im grünen Bereich." />
            )}
          </section>

          <section className="block">
            <Kopf titel="Gerade auf der Baustelle" />
            {daten.stempel.length ? (
              <ul className="liste">
                {daten.stempel.map(s => (
                  <li key={s.id} className="zeile">
                    <span className="punkt-gruen" aria-hidden="true" />
                    <strong>{name(s.mitarbeiterId)}</strong>
                    <span className="leise">{bs(s.baustelleId)}, {t('seit')} {uhrzeit(s.start)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Leer titel="Niemand eingestempelt">
                <button onClick={() => gehe('zeiten')}>Zur Stempeluhr</button>
              </Leer>
            )}
          </section>

          {rechte.planen && daten.mitarbeiter.some(m => m.aktiv !== false && abwesendAm(daten, m.id, h)) && (
            <section className="block">
              <Kopf titel="Heute abwesend" />
              <ul className="liste">
                {daten.mitarbeiter.filter(m => m.aktiv !== false && abwesendAm(daten, m.id, h)).map(m => (
                  <li key={m.id} className="zeile">
                    <strong>{m.name}</strong>
                    <span className="leise">{t(abwesendAm(daten, m.id, h).art || 'Abwesend')}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {ohneBericht.length > 0 && (
            <section className="block">
              <Kopf titel="Heute noch kein Bautagebuch" />
              <ul className="liste">
                {ohneBericht.map(b => (
                  <li key={b.id} className="zeile">
                    <strong>{b.name}</strong>
                    <button className="klein rechts" onClick={() => gehe('tagebuch')}>Bericht schreiben</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  )
}
