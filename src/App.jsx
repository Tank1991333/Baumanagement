import { useCallback, useEffect, useRef, useState } from 'react'
import { useDaten, heute, fmtDatum, erinnerungen } from './store'
import { syncVerfuegbar, holeSitzung, synchronisieren } from './sync'
import Uebersicht from './views/Uebersicht.jsx'
import Baustellen from './views/Baustellen.jsx'
import Zeiten from './views/Zeiten.jsx'
import Plan from './views/Plan.jsx'
import Tagebuch from './views/Tagebuch.jsx'
import Maengel from './views/Maengel.jsx'
import Regie from './views/Regie.jsx'
import Fotos from './views/Fotos.jsx'
import Material from './views/Material.jsx'
import Team from './views/Team.jsx'

const BEREICHE = [
  ['uebersicht', 'Übersicht', Uebersicht],
  ['baustellen', 'Baustellen', Baustellen],
  ['zeiten', 'Zeiten', Zeiten],
  ['plan', 'Plantafel', Plan],
  ['tagebuch', 'Bautagebuch', Tagebuch],
  ['maengel', 'Mängel & Abnahme', Maengel],
  ['regie', 'Regieberichte', Regie],
  ['fotos', 'Fotos', Fotos],
  ['material', 'Material & Geräte', Material],
  ['team', 'Team', Team],
]

const THEMA_KEY = 'bauapp-thema'
const ALLE_RECHTE = { chef: true, kosten: true, alleZeiten: true, planen: true, stammdaten: true }
const KEINE_RECHTE = { chef: false, kosten: false, alleZeiten: false, planen: false, stammdaten: false }

export default function App() {
  const [daten, setDaten, speicherFehler] = useDaten()
  const [bereich, setBereich] = useState('uebersicht')
  const [konto, setKonto] = useState(holeSitzung())
  const [sync, setSync] = useState({ zustand: 'aus' })
  const [thema, setThemaState] = useState(() => localStorage.getItem(THEMA_KEY) || 'auto')

  const datenRef = useRef(daten)
  datenRef.current = daten
  const laeuft = useRef(false)

  const verbunden = syncVerfuegbar && !!konto?.firma
  const rechte = !verbunden || konto.firma.rolle === 'chef'
    ? ALLE_RECHTE
    : { ...KEINE_RECHTE, ...(konto.firma.rechte || {}), chef: false }
  const rolle = rechte.chef ? 'chef' : 'team'
  const ich = verbunden && konto.firma.mitarbeiter_id
    ? daten.mitarbeiter.find(m => m.id === konto.firma.mitarbeiter_id) ?? null
    : null

  const setThema = t => {
    setThemaState(t)
    try { localStorage.setItem(THEMA_KEY, t) } catch { /* egal */ }
  }
  useEffect(() => {
    if (thema === 'auto') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = thema
  }, [thema])

  const jetztSync = useCallback(async () => {
    if (!syncVerfuegbar || !holeSitzung()?.firma || laeuft.current) return
    if (!navigator.onLine) return setSync({ zustand: 'offline' })
    laeuft.current = true
    setSync(s => ({ ...s, zustand: 'laeuft' }))
    try {
      const kontoNeu = await synchronisieren(() => datenRef.current, setDaten)
      if (kontoNeu) setKonto(holeSitzung() ? { ...holeSitzung() } : null)
      setSync({ zustand: 'ok', zeit: new Date() })
    } catch (e) {
      setSync({ zustand: 'fehler', text: e.message })
    } finally {
      laeuft.current = false
    }
  }, [setDaten])

  useEffect(() => {
    if (!verbunden) return
    jetztSync()
    const t = setInterval(jetztSync, 20000)
    const an = () => jetztSync()
    window.addEventListener('online', an)
    window.addEventListener('focus', an)
    return () => {
      clearInterval(t)
      window.removeEventListener('online', an)
      window.removeEventListener('focus', an)
    }
  }, [verbunden, jetztSync])

  useEffect(() => {
    if (!verbunden) return
    const t = setTimeout(jetztSync, 1500)
    return () => clearTimeout(t)
  }, [daten, verbunden, jetztSync])

  // Einmal am Tag eine Mitteilung, wenn etwas fällig ist
  useEffect(() => {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return
      if (localStorage.getItem('bauapp-mitteilung') === heute()) return
      const n = erinnerungen(daten, rolle).length
      if (n) {
        new Notification(daten.firma || 'Bau-App', { body: `${n} ${n === 1 ? 'Punkt ist' : 'Punkte sind'} fällig.`, icon: '/icon.svg' })
        localStorage.setItem('bauapp-mitteilung', heute())
      }
    } catch { /* nicht unterstützt */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const Ansicht = BEREICHE.find(b => b[0] === bereich)[2]
  const gehe = id => {
    setBereich(id)
    window.scrollTo(0, 0)
  }

  const syncText = {
    laeuft: 'Wird abgeglichen …',
    ok: 'Abgeglichen',
    offline: 'Offline, Änderungen werden später übertragen',
    fehler: 'Abgleich fehlgeschlagen',
  }[sync.zustand]

  return (
    <div className="app">
      <header className="bauschild">
        <div className="bauschild-inhalt">
          <h1>{daten.firma || 'Bau-App'}</h1>
          <p>
            {fmtDatum(heute())}
            {verbunden && syncText && (
              <span className={'sync sync-' + sync.zustand}>{syncText}</span>
            )}
          </p>
        </div>
      </header>

      <nav className="navi" aria-label="Bereiche">
        {BEREICHE.map(([id, name]) => (
          <button
            key={id}
            className={id === bereich ? 'aktiv' : ''}
            aria-current={id === bereich ? 'page' : undefined}
            onClick={() => gehe(id)}
          >
            {name}
          </button>
        ))}
      </nav>

      {speicherFehler && <div className="hinweis-fehler" role="alert">{speicherFehler}</div>}

      <main className="inhalt">
        <Ansicht
          daten={daten}
          setDaten={setDaten}
          gehe={gehe}
          rolle={rolle}
          rechte={rechte}
          ich={ich}
          konto={konto}
          setKonto={setKonto}
          sync={sync}
          jetztSync={jetztSync}
          thema={thema}
          setThema={setThema}
        />
      </main>
    </div>
  )
}
