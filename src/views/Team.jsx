import { useEffect, useState } from 'react'
import { add, upd, del, neuLeer, migrieren, heute, fmtDatum, herunterladen } from '../store'
import { syncVerfuegbar, registrieren, anmelden, abmelden, firmaLaden, firmaAnlegen, firmaBeitreten, mitgliederLaden, mitgliedAendern, mitgliedEntfernen } from '../sync'
import { Feld, Kopf, Leer, Formular } from '../ui.jsx'
import Unterweisungen from './Unterweisungen.jsx'
import { t, SPRACHEN } from '../i18n'

const ROLLEN = ['Bauleiter', 'Polier', 'Vorarbeiter', 'Facharbeiter', 'Helfer', 'Lehrling', 'Büro']
const NEU = { name: '', rolle: 'Facharbeiter', telefon: '', personalnummer: '', stundensatz: '', unterweisung: '', aktiv: true, wochenstunden: '39', kontoStart: '', startSaldo: '' }

function Konto({ daten, setDaten, konto, setKonto, sync, jetztSync }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [firmenname, setFirmenname] = useState(daten.firma)
  const [code, setCode] = useState('')
  const [laedt, setLaedt] = useState(false)
  const [meldung, setMeldung] = useState('')

  const los = async fn => {
    setLaedt(true)
    setMeldung('')
    try { await fn() } catch (e) { setMeldung(e.message) } finally { setLaedt(false) }
  }

  if (!syncVerfuegbar)
    return (
      <Leer
        titel="Gemeinsame Daten sind noch nicht eingerichtet"
        text="Im Moment speichert die App nur auf diesem Gerät. Mit einem kostenlosen Supabase-Konto arbeiten alle auf denselben Daten. Die Anleitung steht in der README-Datei."
      />
    )

  const verbinden = async holen => {
    const s = await holen()
    if (!s.firma) return setKonto({ ...s })
    if (!confirm('Daten, die bisher nur auf diesem Gerät liegen, in die Firma übernehmen?\n\nOK = übernehmen, Abbrechen = verwerfen (z. B. Beispieldaten).')) setDaten({ ...neuLeer(), firma: s.firma.name || '' })
    setKonto({ ...s })
  }

  if (!konto)
    return (
      <form className="formular" onSubmit={e => { e.preventDefault(); los(async () => { await anmelden(email, pw); await verbinden(firmaLaden) }) }}>
        <h3>{t('Anmelden')}</h3>
        <div className="raster">
          <Feld label="E-Mail"><input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></Feld>
          <Feld label="Passwort"><input type="password" autoComplete="current-password" required minLength={6} value={pw} onChange={e => setPw(e.target.value)} /></Feld>
        </div>
        {meldung && <p className="meldung" role="alert">{meldung}</p>}
        <div className="knopfreihe">
          <button type="submit" className="primaer" disabled={laedt}>{t('Anmelden')}</button>
          <button type="button" disabled={laedt} onClick={() => {
            if (!email || pw.length < 6) return setMeldung('E-Mail und ein Passwort mit mindestens 6 Zeichen eingeben.')
            los(async () => {
              const s = await registrieren(email, pw)
              if (!s) return setMeldung('Konto erstellt. Bitte den Link in der E-Mail bestätigen und dann anmelden.')
              setKonto({ ...s })
            })
          }}>{t('Konto erstellen')}</button>
        </div>
      </form>
    )

  if (!konto.firma)
    return (
      <div className="formular">
        <h3>Angemeldet als {konto.email}</h3>
        <div className="raster">
          <div className="feld">
            <span>Neue Firma anlegen (Chef)</span>
            <input value={firmenname} onChange={e => setFirmenname(e.target.value)} placeholder="Firmenname" />
            <button className="primaer" disabled={laedt || !firmenname.trim()} onClick={() => los(() => verbinden(() => firmaAnlegen(firmenname.trim())))}>Firma anlegen</button>
          </div>
          <div className="feld">
            <span>Einer Firma beitreten (Code vom Chef)</span>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="8-stelliger Code" autoCapitalize="none" />
            <button disabled={laedt || !code.trim()} onClick={() => los(() => verbinden(() => firmaBeitreten(code)))}>Beitreten</button>
          </div>
        </div>
        {meldung && <p className="meldung" role="alert">{meldung}</p>}
        <div className="knopfreihe"><button className="klein" onClick={() => { abmelden(); setKonto(null) }}>Abmelden</button></div>
      </div>
    )

  const f = konto.firma
  return (
    <div className="formular">
      <h3>{f.name}</h3>
      <dl className="fakten">
        <dt>Angemeldet</dt><dd>{konto.email}</dd>
        <dt>Rolle</dt><dd>{f.rolle === 'chef' ? 'Chef / Büro' : 'Mitarbeiter'}</dd>
        <dt>Abgleich</dt><dd>{sync.zustand === 'fehler' ? sync.text : sync.zeit ? `zuletzt ${sync.zeit.toLocaleTimeString('de-AT')}` : '…'}</dd>
        {f.code_team && (<><dt>Code für Mitarbeiter</dt><dd><code>{f.code_team}</code></dd></>)}
        {f.code_chef && (<><dt>Code für Büro/Chefs</dt><dd><code>{f.code_chef}</code></dd></>)}
      </dl>
      {f.code_team && (
        <p className="fussnote">
          Mitarbeiter öffnen die App, erstellen ein Konto und treten mit dem Mitarbeiter-Code bei. Danach ordnest du sie unter „Wer sieht was“ ihrem Namen zu und legst fest, was sie dürfen.
        </p>
      )}
      <div className="knopfreihe">
        <button onClick={jetztSync}>Jetzt abgleichen</button>
        <button className="rechts" onClick={() => {
          if (!confirm('Abmelden? Die Firmendaten werden von diesem Gerät entfernt und bleiben in der Cloud.')) return
          abmelden()
          setDaten(neuLeer())
          setKonto(null)
        }}>Abmelden</button>
      </div>
    </div>
  )
}

const RECHTE = [
  ['kosten', 'Kosten und Preise sehen', 'Stundensätze, Auftragssummen, Materialpreise, Nachkalkulation'],
  ['alleZeiten', 'Zeiten aller Mitarbeiter', 'sehen, nachtragen, korrigieren und für alle stempeln'],
  ['planen', 'Plantafel bearbeiten', 'alle Mitarbeiter auf Baustellen einteilen'],
  ['stammdaten', 'Baustellen und Geräte verwalten', 'anlegen, bearbeiten und löschen'],
]
const VORLAGEN = {
  Mitarbeiter: {},
  Polier: { alleZeiten: true, planen: true },
  Bauleiter: { alleZeiten: true, planen: true, stammdaten: true, kosten: true },
}

function Rechte({ daten, konto, jetztSync }) {
  const [liste, setListe] = useState(null)
  const [fehler, setFehler] = useState('')
  const [entwurf, setEntwurf] = useState(null)
  const [laedt, setLaedt] = useState(false)
  const name = id => daten.mitarbeiter.find(m => m.id === id)?.name

  const laden = async () => {
    try {
      setListe(await mitgliederLaden())
      setFehler('')
    } catch (e) {
      setFehler(e.message)
    }
  }
  useEffect(() => {
    laden()
    const an = () => laden()
    window.addEventListener('focus', an)
    return () => window.removeEventListener('focus', an)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const aktion = async fn => {
    setLaedt(true)
    try {
      await fn()
      setEntwurf(null)
      await laden()
      jetztSync()
    } catch (e) {
      setFehler(e.message)
    } finally {
      setLaedt(false)
    }
  }

  const speichern = () => {
    const doppelt = entwurf.mitarbeiter_id && liste.find(m => m.user_id !== entwurf.user_id && m.mitarbeiter_id === entwurf.mitarbeiter_id)
    if (doppelt && !confirm(`${name(entwurf.mitarbeiter_id)} ist schon dem Konto ${doppelt.email} zugeordnet. Trotzdem speichern?`)) return
    if (entwurf.user_id === konto.userId && entwurf.rolle !== 'chef' && !confirm('Du nimmst dir selbst die Chef-Rolle. Danach kannst du Rechte nicht mehr ändern. Fortfahren?')) return
    aktion(() => mitgliedAendern(entwurf.user_id, entwurf.rolle, entwurf.rechte, entwurf.mitarbeiter_id))
  }

  const zusammenfassung = m =>
    m.rolle === 'chef'
      ? 'Chef / Büro: sieht und darf alles'
      : RECHTE.filter(([k]) => m.rechte?.[k]).map(([, t]) => t).join(', ') || 'Nur eigene Zeiten und eigener Einsatzplan, keine Kosten'

  if (!liste) return fehler ? <p className="meldung">{fehler}</p> : <p className="leise">Wird geladen …</p>

  return (
    <>
      {fehler && <p className="meldung" role="alert">{fehler}</p>}
      <ul className="liste">
        {liste.map(m =>
          entwurf?.user_id === m.user_id ? (
            <li key={m.user_id} className="rechte-edit">
              <strong>{m.email}{m.user_id === konto.userId ? ' (du)' : ''}</strong>
              <div className="raster">
                <Feld label="Rolle">
                  <select value={entwurf.rolle} onChange={e => setEntwurf({ ...entwurf, rolle: e.target.value })}>
                    <option value="team">Mitarbeiter</option>
                    <option value="chef">Chef / Büro</option>
                  </select>
                </Feld>
                <Feld label="Ist im Team">
                  <select value={entwurf.mitarbeiter_id || ''} onChange={e => setEntwurf({ ...entwurf, mitarbeiter_id: e.target.value })}>
                    <option value="">Niemandem zugeordnet</option>
                    {daten.mitarbeiter.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </Feld>
              </div>
              {entwurf.rolle === 'team' && (
                <>
                  <div className="knopfreihe eng vorlagen">
                    <span className="leise">Vorlage:</span>
                    {Object.entries(VORLAGEN).map(([n, r]) => (
                      <button key={n} type="button" className="klein" onClick={() => setEntwurf({ ...entwurf, rechte: { ...r } })}>{n}</button>
                    ))}
                  </div>
                  <div className="rechte-liste">
                    {RECHTE.map(([k, titel, info]) => (
                      <label key={k} className="recht">
                        <input
                          type="checkbox"
                          checked={!!entwurf.rechte?.[k]}
                          onChange={e => setEntwurf({ ...entwurf, rechte: { ...entwurf.rechte, [k]: e.target.checked } })}
                        />
                        <span><b>{titel}</b><span className="leise">{info}</span></span>
                      </label>
                    ))}
                  </div>
                  <p className="fussnote">Ohne Haken sieht die Person nur ihre eigenen Zeiten und ihren Einsatzplan, aber Baustellen, Mängel, Bautagebuch, Regieberichte, Fotos und Material wie alle anderen.</p>
                </>
              )}
              <div className="knopfreihe">
                <button className="primaer" disabled={laedt} onClick={speichern}>Speichern</button>
                <button disabled={laedt} onClick={() => setEntwurf(null)}>Abbrechen</button>
                {m.user_id !== konto.userId && (
                  <button
                    className="gefahr rechts"
                    disabled={laedt}
                    onClick={() => confirm(`${m.email} aus der Firma entfernen? Die Person verliert sofort den Zugriff.`) && aktion(() => mitgliedEntfernen(m.user_id))}
                  >
                    Aus Firma entfernen
                  </button>
                )}
              </div>
            </li>
          ) : (
            <li key={m.user_id} className="zeile">
              <div className="stempel-name">
                <strong>{m.email}{m.user_id === konto.userId ? ' (du)' : ''}</strong>
                <span className="leise">
                  {m.mitarbeiter_id ? name(m.mitarbeiter_id) ?? 'Mitarbeiter gelöscht' : 'Noch keinem Mitarbeiter zugeordnet'}
                </span>
                <span className="leise">{zusammenfassung(m)}</span>
              </div>
              <button className="klein" onClick={() => setEntwurf({ ...m, rechte: { ...(m.rechte || {}) } })}>Ändern</button>
            </li>
          )
        )}
      </ul>
      <div className="knopfreihe">
        <button className="klein" onClick={laden}>Liste aktualisieren</button>
      </div>
      <p className="fussnote">
        Die Rechte prüft der Server. Kosten und fremde Stundenzettel werden gar nicht erst auf die Handys von Personen ohne dieses Recht übertragen. Änderungen wirken beim nächsten Abgleich, spätestens nach 20 Sekunden.
      </p>
    </>
  )
}

export default function Team(props) {
  const { daten, setDaten, rechte, konto, thema, setThema } = props
  const [form, setForm] = useState(null)
  const f = k => e => setForm({ ...form, [k]: e.target.value })
  const chef = rechte.chef

  const speichern = e => {
    e.preventDefault()
    if (!form.name.trim()) return
    form.id ? upd(setDaten, 'mitarbeiter', form.id, form) : add(setDaten, 'mitarbeiter', form)
    setForm(null)
  }

  const sichern = () => herunterladen(`bau-app-sicherung_${heute()}.json`, JSON.stringify(daten), 'application/json')

  const einspielen = e => {
    const datei = e.target.files?.[0]
    e.target.value = ''
    if (!datei) return
    const r = new FileReader()
    r.onload = () => {
      try {
        const neu = JSON.parse(r.result)
        if (!Array.isArray(neu.baustellen) || !Array.isArray(neu.mitarbeiter)) throw new Error()
        if (confirm('Alle aktuellen Daten durch die Sicherung ersetzen?')) setDaten(migrieren(neu))
      } catch {
        alert('Diese Datei ist keine gültige Sicherung der Bau-App.')
      }
    }
    r.readAsText(datei)
  }

  return (
    <>
      {chef && (
        <>
          <Kopf titel="Team">
            {!form && <button className="primaer" onClick={() => setForm({ ...NEU })}>Mitarbeiter hinzufügen</button>}
          </Kopf>

          {form && (
            <Formular
              titel={form.id ? 'Mitarbeiter bearbeiten' : 'Mitarbeiter hinzufügen'}
              onSubmit={speichern}
              onAbbrechen={() => setForm(null)}
              kannLoeschen={!!form.id}
              onLoeschen={() => {
                if (confirm(`${form.name} löschen? Tipp: „Ausgeschieden“ behält die Stunden-Historie lesbar.`)) {
                  del(setDaten, 'mitarbeiter', form.id)
                  setForm(null)
                }
              }}
            >
              <Feld label="Name *"><input required value={form.name} onChange={f('name')} /></Feld>
              <Feld label="Funktion">
                <select value={form.rolle} onChange={f('rolle')}>{ROLLEN.map(r => <option key={r}>{r}</option>)}</select>
              </Feld>
              <Feld label="Telefon"><input type="tel" value={form.telefon} onChange={f('telefon')} /></Feld>
              <Feld label="Personalnummer"><input value={form.personalnummer ?? ''} onChange={f('personalnummer')} /></Feld>
              <Feld label="Kostensatz €/h (Nachkalkulation)"><input inputMode="decimal" value={form.stundensatz ?? ''} onChange={f('stundensatz')} /></Feld>
              <Feld label="Letzte Sicherheitsunterweisung"><input type="date" value={form.unterweisung ?? ''} onChange={f('unterweisung')} /></Feld>
              <Feld label="Wochenstunden (Bau-KV 39)"><input inputMode="decimal" value={form.wochenstunden ?? ''} onChange={f('wochenstunden')} /></Feld>
              <Feld label="Stundenkonto ab"><input type="date" value={form.kontoStart ?? ''} onChange={f('kontoStart')} /></Feld>
              <Feld label="Anfangssaldo (h, z. B. -4 oder 12,5)"><input inputMode="decimal" value={form.startSaldo ?? ''} onChange={f('startSaldo')} /></Feld>
              <Feld label="Status">
                <select value={form.aktiv === false ? 'nein' : 'ja'} onChange={e => setForm({ ...form, aktiv: e.target.value === 'ja' })}>
                  <option value="ja">Aktiv</option><option value="nein">Ausgeschieden</option>
                </select>
              </Feld>
            </Formular>
          )}

          {daten.mitarbeiter.length === 0 ? (
            <Leer titel="Noch keine Mitarbeiter" text="Ohne Team keine Stempeluhr: Lege zuerst deine Leute an." />
          ) : (
            <ul className="liste">
              {daten.mitarbeiter.map(m => (
                <li key={m.id} className={'zeile' + (m.aktiv === false ? ' inaktiv' : '')}>
                  <div className="stempel-name">
                    <strong>{m.name}{m.personalnummer ? ` (${m.personalnummer})` : ''}</strong>
                    <span className="leise">
                      {m.rolle}{m.aktiv === false ? ', ausgeschieden' : ''}
                      {m.aktiv !== false && `, Unterweisung ${m.unterweisung ? fmtDatum(m.unterweisung) : 'fehlt'}`}
                    </span>
                  </div>
                  {m.telefon && <a className="rechts" href={'tel:' + m.telefon.replace(/\s/g, '')}>{m.telefon}</a>}
                  <button className={'klein' + (m.telefon ? '' : ' rechts')} onClick={() => setForm({ ...NEU, ...m })}>Bearbeiten</button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {chef && (
        <section className="block">
          <Kopf titel="Wer sieht was" />
          {syncVerfuegbar && konto?.firma ? (
            <Rechte {...props} />
          ) : (
            <Leer
              titel="Rechte gibt es mit gemeinsamen Daten"
              text="Solange die App nur auf einem Gerät läuft, sieht jeder, der das Gerät hat, alles. Sobald die Firma über ein Konto verbunden ist, legst du hier pro Person fest, was sie sehen und ändern darf."
            />
          )}
        </section>
      )}

      {chef && (
        <section className="block">
          <Unterweisungen {...props} />
        </section>
      )}

      <section className={'block' + (chef ? '' : ' erster')}>
        <Kopf titel="Firma und Konto" />
        <Konto {...props} />
      </section>

      <section className="block einstellungen">
        <Kopf titel="Einstellungen" />
        <div className="raster">
          {chef && (
            <Feld label="Firmenname (im Kopf und auf Berichten)">
              <input value={daten.firma} onChange={e => setDaten(d => ({ ...d, firma: e.target.value }))} />
            </Feld>
          )}
          <Feld label="Sprache">
            <select value={props.sprache} onChange={e => props.setSprache(e.target.value)}>
              {SPRACHEN.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
          </Feld>
          <Feld label="Darstellung">
            <select value={thema} onChange={e => setThema(e.target.value)}>
              <option value="auto">Wie das Gerät</option>
              <option value="light">Hell</option>
              <option value="dark">Dunkel</option>
            </select>
          </Feld>
        </div>
        {chef && (
          <label className="recht gps">
            <input type="checkbox" checked={!!daten.einstellungen.gpsStempeln} onChange={e => {
              const an = e.target.checked
              if (an && !confirm('Standort beim Stempeln speichern?\n\nIn Österreich ist das eine Kontrollmaßnahme: Mit Betriebsrat braucht es eine Betriebsvereinbarung, ohne Betriebsrat die Zustimmung jedes Mitarbeiters. Informiere dein Team vorher.')) return
              setDaten(d => ({ ...d, einstellungen: { ...d.einstellungen, gpsStempeln: an } }))
            }} />
            <span><b>Standort beim Ein- und Ausstempeln speichern</b><span className="leise">zeigt, ob jemand auf der Baustelle gestempelt hat. Nur einmal pro Stempelvorgang, keine laufende Ortung.</span></span>
          </label>
        )}
        {chef && (
          <>
            <p className="fussnote">Eine Datensicherung enthält alles inklusive Fotos. Ohne Cloud-Konto liegen die Daten nur auf diesem Gerät, also regelmäßig sichern.</p>
            <div className="knopfreihe">
              <button onClick={sichern}>Datensicherung herunterladen</button>
              <label className="knopf">
                Sicherung einspielen
                <input type="file" accept="application/json,.json" onChange={einspielen} hidden />
              </label>
              <button className="gefahr rechts" onClick={() => {
                if (confirm('Wirklich alle Daten löschen? Mit Cloud-Konto werden sie auch für alle anderen gelöscht.'))
                  setDaten({ ...neuLeer(), firma: daten.firma })
              }}>Alle Daten löschen</button>
            </div>
          </>
        )}
      </section>
    </>
  )
}
