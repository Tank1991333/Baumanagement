import { useEffect, useState } from 'react'

const KEY = 'bauapp-daten-v1'

export const SAMMLUNGEN = [
  'baustellen', 'mitarbeiter', 'zeiten', 'tagebuch', 'maengel', 'stempel',
  'fotos', 'regie', 'plan', 'bestellungen', 'geraete', 'abnahmen',
  'behinderungen', 'aufmass', 'dokumente', 'abwesenheiten', 'unterweisungen',
]

export const leer = { firma: '', einstellungen: { gpsStempeln: false }, ...Object.fromEntries(SAMMLUNGEN.map(s => [s, []])) }
export const neuLeer = () => JSON.parse(JSON.stringify(leer))

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36)

export function lokalDatum(d = new Date()) {
  const x = new Date(d)
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset())
  return x.toISOString().slice(0, 10)
}
export const heute = () => lokalDatum(new Date())
export const plusTage = (datum, n) => {
  const d = new Date(datum + 'T12:00')
  d.setDate(d.getDate() + n)
  return lokalDatum(d)
}
export const uhrzeit = d => new Date(d).toTimeString().slice(0, 5)

export function wochenStart(datum = heute()) {
  const d = new Date(datum + 'T12:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return lokalDatum(d)
}

export const fmtDatum = s =>
  s ? new Date(s + 'T00:00').toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
export const fmtKurz = s => (s ? new Date(s + 'T00:00').toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit' }) : '')
export const fmtStd = h => (Math.round((h || 0) * 100) / 100).toLocaleString('de-AT') + ' h'
export const fmtEuro = x => (Number(x) || 0).toLocaleString('de-AT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
export const zahl = x => Number(String(x ?? '').replace(',', '.')) || 0

export function stunden(von, bis, pauseMin = 0) {
  if (!von || !bis) return 0
  const [vh, vm] = von.split(':').map(Number)
  const [bh, bm] = bis.split(':').map(Number)
  let min = bh * 60 + bm - (vh * 60 + vm)
  if (min < 0) min += 24 * 60
  return Math.max(0, Math.round(((min - (Number(pauseMin) || 0)) / 60) * 100) / 100)
}

// Ruhepause nach § 11 AZG (Österreich): bei mehr als 6 Stunden Arbeitszeit mindestens 30 Minuten
export const pauseNachAZG = bruttoStd => (bruttoStd > 6 ? 30 : 0)

const zwei = n => String(n).padStart(2, '0')
function ostersonntag(j) {
  const a = j % 19, b = Math.floor(j / 100), c = j % 100, d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const n = h + l - 7 * m + 114
  return `${j}-${zwei(Math.floor(n / 31))}-${zwei((n % 31) + 1)}`
}
const feiertagCache = {}
// Gesetzliche Feiertage in Österreich
export function feiertage(j) {
  if (feiertagCache[j]) return feiertagCache[j]
  const f = {}
  ;[['01-01', 'Neujahr'], ['01-06', 'Heilige Drei Könige'], ['05-01', 'Staatsfeiertag'], ['08-15', 'Mariä Himmelfahrt'],
    ['10-26', 'Nationalfeiertag'], ['11-01', 'Allerheiligen'], ['12-08', 'Mariä Empfängnis'], ['12-25', 'Christtag'],
    ['12-26', 'Stefanitag']].forEach(([d, n]) => (f[`${j}-${d}`] = n))
  const o = ostersonntag(j)
  f[plusTage(o, 1)] = 'Ostermontag'
  f[plusTage(o, 39)] = 'Christi Himmelfahrt'
  f[plusTage(o, 50)] = 'Pfingstmontag'
  f[plusTage(o, 60)] = 'Fronleichnam'
  return (feiertagCache[j] = f)
}
export const feiertag = d => (d ? feiertage(+d.slice(0, 4))[d] : undefined)
export const istArbeitstag = d => {
  const w = new Date(d + 'T12:00').getDay()
  return w !== 0 && w !== 6 && !feiertag(d)
}

export const ABWESENHEIT = ['Urlaub', 'Krankenstand', 'Zeitausgleich', 'Schulung', 'Sonstiges']
export const abwesendAm = (d, maId, datum) =>
  d.abwesenheiten.find(a => a.mitarbeiterId === maId && a.von <= datum && datum <= (a.bis || a.von))

export function schlechtwetterStunden(d, maId, von, bis) {
  return d.tagebuch
    .filter(t => t.datum >= von && t.datum <= bis && t.schlechtwetter?.stunden && (t.schlechtwetter.mitarbeiter || []).includes(maId))
    .reduce((s, t) => s + zahl(t.schlechtwetter.stunden), 0)
}

// Stundenkonto: Soll aus Wochenstunden (Bau-KV: 39 h), Urlaub/Krankenstand/Schulung gelten als erfüllt,
// Schlechtwetterstunden werden gutgeschrieben, Zeitausgleich baut Guthaben ab.
// Standard: bis gestern, damit der laufende Tag das Konto nicht ins Minus zieht
export function stundenkonto(d, maId, bis = plusTage(heute(), -1)) {
  const m = d.mitarbeiter.find(x => x.id === maId)
  if (!m) return null
  const erste = d.zeiten.filter(z => z.mitarbeiterId === maId).reduce((min, z) => (z.datum < min ? z.datum : min), bis)
  const start = m.kontoStart || erste
  const tagesSoll = (zahl(m.wochenstunden) || 39) / 5
  let soll = 0, gutschrift = 0
  for (let t = start; t <= bis; t = plusTage(t, 1)) {
    if (!istArbeitstag(t)) continue
    soll += tagesSoll
    const a = abwesendAm(d, maId, t)
    if (a && a.art !== 'Zeitausgleich') gutschrift += tagesSoll
  }
  const ist = d.zeiten.filter(z => z.mitarbeiterId === maId && z.datum >= start && z.datum <= bis).reduce((s, z) => s + z.stunden, 0)
  const sw = schlechtwetterStunden(d, maId, start, bis)
  return { start, soll, ist, gutschrift, schlechtwetter: sw, saldo: zahl(m.startSaldo) + ist + gutschrift + sw - soll }
}

export function entfernungM(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null
  const r = 6371000, rad = x => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return Math.round(2 * r * Math.asin(Math.sqrt(h)))
}

export const zufall = (n = 24) => {
  const z = new Uint8Array(n)
  crypto.getRandomValues(z)
  return [...z].map(x => 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]).join('')
}

export const add = (set, key, item) => set(d => ({ ...d, [key]: [{ ...item, id: uid() }, ...d[key]] }))
export const upd = (set, key, id, patch) =>
  set(d => ({ ...d, [key]: d[key].map(x => (x.id === id ? { ...x, ...patch } : x)) }))
export const del = (set, key, id) => set(d => ({ ...d, [key]: d[key].filter(x => x.id !== id) }))

export function migrieren(roh) {
  const x = { ...neuLeer(), ...roh }
  if (x.stempel && !Array.isArray(x.stempel)) {
    x.stempel = Object.entries(x.stempel).map(([id, s]) => ({ id, mitarbeiterId: id, ...s }))
  }
  for (const s of SAMMLUNGEN) if (!Array.isArray(x[s])) x[s] = []
  x.einstellungen = { ...leer.einstellungen, ...(x.einstellungen || {}) }
  x.maengel = x.maengel.map(m => {
    if (Array.isArray(m.fotos)) return m
    const { foto, ...rest } = m
    return { ...rest, fotos: foto ? [foto] : [] }
  })
  return x
}

function laden() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? migrieren(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function useDaten() {
  const [daten, setDaten] = useState(() => laden() ?? beispielDaten())
  const [fehler, setFehler] = useState('')
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(daten))
      setFehler('')
    } catch {
      setFehler('Der Speicher auf diesem Gerät ist voll. Lösche alte Fotos oder sichere die Daten unter Team.')
    }
  }, [daten])
  return [daten, setDaten, fehler]
}

export function csv(zeilen) {
  const zelle = f => {
    const s = String(f ?? '')
    return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  return '\uFEFF' + zeilen.map(z => z.map(zelle).join(';')).join('\r\n')
}

export function herunterladen(name, inhalt, typ = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([inhalt], { type: typ }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function bildKomprimieren(datei, max = 1200, qualitaet = 0.7) {
  return new Promise((ok, fail) => {
    const r = new FileReader()
    r.onerror = fail
    r.onload = () => {
      const img = new Image()
      img.onerror = fail
      img.onload = () => {
        const f = Math.min(1, max / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * f)
        c.height = Math.round(img.height * f)
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        ok(c.toDataURL('image/jpeg', qualitaet))
      }
      img.src = r.result
    }
    r.readAsDataURL(datei)
  })
}

export const esc = s =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
export const absatz = t => esc(t).replace(/\n/g, '<br>')

const DRUCK_CSS = `body{font:11pt/1.5 Arial,sans-serif;max-width:740px;margin:32px auto;color:#000;padding:0 16px}
.firma{margin:0;color:#444}h1{font-size:18pt;margin:2px 0 12px}h2{font-size:11pt;margin:18px 0 4px;border-bottom:1px solid #999}
table{border-collapse:collapse;width:100%;margin-top:8px}td,th{padding:4px 8px;border:1px solid #bbb;vertical-align:top;text-align:left}
th{background:#eee}.k td:first-child{width:30%;font-weight:bold}.sig{display:flex;gap:40px;margin-top:40px}
.sig div{flex:1;border-top:1px solid #000;padding-top:4px;font-size:9pt}.sig img{height:70px;display:block;margin-bottom:4px}
.fotos img{width:31%;margin:1%;vertical-align:top}`

export function drucken(titel, inhalt, firma) {
  const w = window.open('', '_blank')
  if (!w) return alert('Bitte Pop-ups für diese Seite erlauben, um zu drucken.')
  w.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(titel)}</title><style>${DRUCK_CSS}</style></head><body>
<p class="firma">${esc(firma)}</p><h1>${esc(titel)}</h1>${inhalt}<script>window.onload=()=>window.print()<\/script></body></html>`)
  w.document.close()
}

export const unterschriftHtml = (bild, text) =>
  `<div>${bild ? `<img src="${bild}" alt="">` : '<div style="height:74px"></div>'}${esc(text)}</div>`

export function erinnerungen(d, rolle = 'chef') {
  const h = heute()
  const in14 = plusTage(h, 14)
  const vorEinemJahr = plusTage(h, -365)
  const bs = id => d.baustellen.find(b => b.id === id)?.name ?? '–'
  const r = []
  d.maengel
    .filter(m => !m.erledigt && m.frist && m.frist <= h)
    .forEach(m => r.push({ id: 'm' + m.id, rot: m.frist < h, text: `${m.typ}: ${m.titel}`, info: `${bs(m.baustelleId)}, Frist ${fmtDatum(m.frist)}`, ziel: 'maengel' }))
  d.bestellungen
    .filter(b => b.status !== 'geliefert' && b.liefertermin && b.liefertermin <= h)
    .forEach(b => r.push({ id: 'b' + b.id, rot: b.liefertermin < h, text: `Lieferung: ${b.artikel}`, info: `${bs(b.baustelleId)}, erwartet ${fmtDatum(b.liefertermin)}`, ziel: 'material' }))
  d.geraete
    .filter(g => g.naechstePruefung && g.naechstePruefung <= in14)
    .forEach(g => r.push({ id: 'g' + g.id, rot: g.naechstePruefung < h, text: `Prüfung (AM-VO): ${g.name}`, info: `fällig ${fmtDatum(g.naechstePruefung)}`, ziel: 'material' }))
  if (rolle === 'chef')
    d.mitarbeiter
      .filter(m => m.aktiv !== false && (!m.unterweisung || m.unterweisung < vorEinemJahr))
      .forEach(m => r.push({ id: 'u' + m.id, rot: false, text: `Unterweisung (§ 14 ASchG): ${m.name}`, info: m.unterweisung ? `zuletzt ${fmtDatum(m.unterweisung)}` : 'noch nicht eingetragen', ziel: 'team' }))
  return r.sort((a, b) => Number(b.rot) - Number(a.rot))
}

function beispielDaten() {
  const b1 = uid(), b2 = uid(), m1 = uid(), m2 = uid(), m3 = uid()
  const h = heute()
  return {
    ...neuLeer(),
    firma: 'Musterbau GmbH',
    baustellen: [
      { id: b1, name: 'EFH Familie Huber', adresse: 'Petersgasse 40, 8010 Graz', kunde: 'Thomas Huber', ansprechpartner: 'Herr Huber', telefon: '0664 1234567', lat: 47.0625, lon: 15.4655, start: h, ende: '', status: 'laufend', notiz: 'Rohbau, Keller in WU-Beton', angebot: '186000', sollStunden: '1400' },
      { id: b2, name: 'Sanierung Volksschule', adresse: 'Hauptplatz 1, 8020 Graz', kunde: 'Stadt Graz', ansprechpartner: 'Frau Kaya, Hochbau', telefon: '0316 8720', start: '', ende: '', status: 'geplant', notiz: '', angebot: '', sollStunden: '' },
    ],
    mitarbeiter: [
      { id: m1, name: 'Josef Maier', rolle: 'Polier', telefon: '0676 1112223', wochenstunden: '39', stundensatz: '48', personalnummer: '101', email: '', unterweisung: plusTage(h, -100), aktiv: true },
      { id: m2, name: 'Ali Demir', rolle: 'Facharbeiter', telefon: '', wochenstunden: '39', stundensatz: '42', personalnummer: '102', email: '', unterweisung: '', aktiv: true },
      { id: m3, name: 'Lukas Weber', rolle: 'Lehrling', telefon: '', wochenstunden: '39', stundensatz: '22', personalnummer: '103', email: '', unterweisung: plusTage(h, -40), aktiv: true },
    ],
    zeiten: [
      { id: uid(), datum: plusTage(h, -1), mitarbeiterId: m1, baustelleId: b1, von: '07:00', bis: '16:30', pause: 45, taetigkeit: 'Schalung Bodenplatte', stunden: 8.75 },
      { id: uid(), datum: plusTage(h, -1), mitarbeiterId: m2, baustelleId: b1, von: '07:00', bis: '16:00', pause: 30, taetigkeit: 'Bewehrung', stunden: 8.5 },
    ],
    plan: [m1, m2, m3].map(m => ({ id: `${h}_${m}`, datum: h, mitarbeiterId: m, baustelleId: b1 })),
    abwesenheiten: [{ id: uid(), mitarbeiterId: m3, von: plusTage(h, 3), bis: plusTage(h, 4), art: 'Schulung', notiz: 'Berufsschule' }],
    maengel: [
      { id: uid(), typ: 'Aufgabe', titel: 'Bewehrungsabnahme Bodenplatte anmelden', beschreibung: 'Prüfstatiker anrufen, Termin vor dem Betonieren', baustelleId: b1, verantwortlichId: m1, frist: h, dringend: true, fotos: [], erledigt: false },
    ],
    bestellungen: [
      { id: uid(), baustelleId: b1, artikel: 'Transportbeton C30/37 WU', menge: '24', einheit: 'm³', lieferant: 'Betonwerk Mur', liefertermin: plusTage(h, 2), status: 'bestellt', preis: '3600' },
    ],
    geraete: [
      { id: uid(), name: 'Rüttelplatte 90 kg', inventarnr: 'G-014', standort: b1, naechstePruefung: plusTage(h, 10), notiz: '' },
      { id: uid(), name: 'Baustromverteiler', inventarnr: 'E-003', standort: 'lager', naechstePruefung: plusTage(h, 120), notiz: 'Elektro-Prüfung' },
    ],
  }
}
