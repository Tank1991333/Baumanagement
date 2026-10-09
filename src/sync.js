// Gemeinsame Daten über Supabase (kostenloser Tarif). Ohne Zugangsdaten läuft die App rein lokal.
import { SAMMLUNGEN, neuLeer } from './store'

const BASIS = import.meta.env.VITE_SUPABASE_URL
const SCHLUESSEL = import.meta.env.VITE_SUPABASE_ANON_KEY
export const syncVerfuegbar = !!(BASIS && SCHLUESSEL)

const SK = 'bauapp-sitzung', STK = 'bauapp-syncstand', CK = 'bauapp-cursor'

const lese = k => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } }
const schreibe = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)) } catch { /* voll */ } }

let sitzung = lese(SK)
export const holeSitzung = () => sitzung

function fehlerText(j, status) {
  const m = j.error_description || j.msg || j.message || j.error || `Serverfehler ${status}`
  if (/invalid login/i.test(m)) return 'E-Mail oder Passwort ist falsch.'
  if (/already registered|already exists/i.test(m)) return 'Für diese E-Mail gibt es schon ein Konto. Bitte anmelden.'
  if (/not confirmed/i.test(m)) return 'Bitte bestätige zuerst den Link in deinem E-Mail-Postfach.'
  if (/password/i.test(m) && /characters|at least/i.test(m)) return 'Das Passwort muss mindestens 6 Zeichen haben.'
  if (/Code ungültig/i.test(m)) return 'Dieser Firmen-Code ist ungültig.'
  if (/Kein Zugriff/i.test(m)) return 'Kein Zugriff mehr auf diese Firma.'
  return m
}

async function auth(pfad, body) {
  const r = await fetch(`${BASIS}/auth/v1/${pfad}`, {
    method: 'POST',
    headers: { apikey: SCHLUESSEL, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(fehlerText(j, r.status))
  return j
}

function merke(j, firma = null) {
  sitzung = {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
    email: j.user?.email ?? sitzung?.email,
    userId: j.user?.id ?? sitzung?.userId,
    firma,
  }
  schreibe(SK, sitzung)
  return sitzung
}

export async function registrieren(email, passwort) {
  const j = await auth('signup', { email, password: passwort })
  return j.access_token ? merke(j) : null
}
export const anmelden = async (email, passwort) => merke(await auth('token?grant_type=password', { email, password: passwort }))

export function abmelden() {
  sitzung = null
  schreibe(SK, null)
  schreibe(STK, null)
  schreibe(CK, null)
}

async function token() {
  if (!sitzung) throw new Error('Nicht angemeldet.')
  if (sitzung.expires_at - 60 < Date.now() / 1000) {
    try {
      merke(await auth('token?grant_type=refresh_token', { refresh_token: sitzung.refresh_token }), sitzung.firma)
    } catch {
      throw new Error('Anmeldung abgelaufen. Bitte ab- und wieder anmelden.')
    }
  }
  return sitzung.access_token
}

async function rest(pfad, { method = 'GET', body, prefer } = {}) {
  const r = await fetch(`${BASIS}/rest/v1/${pfad}`, {
    method,
    headers: {
      apikey: SCHLUESSEL,
      Authorization: `Bearer ${await token()}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await r.text()
  const j = text ? JSON.parse(text) : null
  if (!r.ok) throw new Error(fehlerText(j || {}, r.status))
  return j
}

export async function firmaLaden() {
  const f = await rest('rpc/meine_firma', { method: 'POST', body: {} })
  sitzung = { ...sitzung, firma: f || null }
  schreibe(SK, sitzung)
  return sitzung
}
export async function firmaAnlegen(name) {
  await rest('rpc/firma_anlegen', { method: 'POST', body: { p_name: name } })
  return firmaLaden()
}
export async function firmaBeitreten(code) {
  await rest('rpc/firma_beitreten', { method: 'POST', body: { p_code: code.trim().toLowerCase() } })
  return firmaLaden()
}

function eintraegeVon(daten) {
  const m = new Map()
  for (const s of SAMMLUNGEN) for (const x of daten[s]) m.set(`${s}:${x.id}`, { sammlung: s, id: x.id, obj: x })
  if (daten.firma) m.set('meta:firma', { sammlung: 'meta', id: 'firma', obj: { id: 'firma', name: daten.firma, ...daten.einstellungen } })
  return m
}

export const mitgliederLaden = () =>
  rest('rpc/mitglieder_liste', { method: 'POST', body: { p_firma: sitzung.firma.id } })
export const mitgliedAendern = (userId, rolle, rechte, mitarbeiterId) =>
  rest('rpc/mitglied_aendern', {
    method: 'POST',
    body: { p_firma: sitzung.firma.id, p_user: userId, p_rolle: rolle, p_rechte: rechte, p_mitarbeiter: mitarbeiterId || '' },
  })
export const mitgliedEntfernen = userId =>
  rest('rpc/mitglied_entfernen', { method: 'POST', body: { p_firma: sitzung.firma.id, p_user: userId } })

const signatur = f => (f ? JSON.stringify([f.id, f.rolle, f.rechte ?? {}, f.mitarbeiter_id ?? null]) : '')

function anwenden(d, zeilen, korrekturen, stand) {
  const jetzt = eintraegeVon(d)
  const erg = { ...d }
  const kopiert = new Set()
  let geaendert = false
  const setze = r => {
    const k = `${r.sammlung}:${r.id}`
    if (r.sammlung === 'meta') {
      if (!r.geloescht && r.daten?.name) {
        const { id, name, ...einstellungen } = r.daten
        erg.firma = name
        erg.einstellungen = { ...erg.einstellungen, ...einstellungen }
        stand[k] = JSON.stringify({ id: 'firma', name, ...erg.einstellungen })
        geaendert = true
      }
      return
    }
    if (!SAMMLUNGEN.includes(r.sammlung)) return
    if (!kopiert.has(r.sammlung)) {
      erg[r.sammlung] = [...erg[r.sammlung]]
      kopiert.add(r.sammlung)
    }
    const arr = erg[r.sammlung]
    const i = arr.findIndex(x => x.id === r.id)
    if (r.geloescht || !r.daten) {
      if (i >= 0) arr.splice(i, 1)
      delete stand[k]
    } else {
      if (i >= 0) arr[i] = r.daten
      else arr.unshift(r.daten)
      stand[k] = JSON.stringify(r.daten)
    }
    geaendert = true
  }
  for (const r of zeilen) {
    const k = `${r.sammlung}:${r.id}`
    const lokalJ = jetzt.has(k) ? JSON.stringify(jetzt.get(k).obj) : null
    if ((stand[k] ?? null) === lokalJ) setze(r) // lokal Geändertes gewinnt, bis es hochgeladen ist
  }
  for (const r of korrekturen) setze(r) // vom Server abgelehnte Änderungen zurücksetzen
  return geaendert ? erg : d
}

// Abgleich über geprüfte Datenbankfunktionen: Der Server entscheidet, was jemand sehen und ändern darf.
// Gibt true zurück, wenn sich Rolle, Rechte oder Zuordnung geändert haben.
export async function synchronisieren(holeDaten, setDaten) {
  const vorher = sitzung?.firma
  if (!vorher?.id) return false
  await firmaLaden()
  const firma = sitzung.firma
  if (!firma) {
    schreibe(STK, null)
    schreibe(CK, null)
    setDaten(neuLeer())
    return true
  }

  const kontoGeaendert = signatur(vorher) !== signatur(firma)
  let stand = lese(STK) || {}
  const cursorAlle = lese(CK) || {}
  if (kontoGeaendert) {
    // Rechte geändert: lokale Kopie verwerfen und neu laden, damit nichts Unerlaubtes liegen bleibt
    stand = {}
    delete cursorAlle[firma.id]
  }
  const korrekturen = []

  if (!kontoGeaendert) {
    const lokal = eintraegeVon(holeDaten())
    const offen = []
    for (const [k, e] of lokal) {
      const j = JSON.stringify(e.obj)
      if (stand[k] !== j) offen.push({ k, j, row: { sammlung: e.sammlung, id: e.id, daten: e.obj, geloescht: false } })
    }
    for (const k of Object.keys(stand)) {
      if (lokal.has(k)) continue
      const i = k.indexOf(':')
      offen.push({ k, j: null, row: { sammlung: k.slice(0, i), id: k.slice(i + 1), daten: null, geloescht: true } })
    }
    let paket = [], groesse = 0
    const senden = async () => {
      if (!paket.length) return
      const abgelehnt = await rest('rpc/abgleich_senden', {
        method: 'POST',
        body: { p_firma: firma.id, p_zeilen: paket.map(p => p.row) },
      })
      for (const p of paket) p.j === null ? delete stand[p.k] : (stand[p.k] = p.j)
      if (Array.isArray(abgelehnt)) korrekturen.push(...abgelehnt)
      schreibe(STK, stand)
      paket = []
      groesse = 0
    }
    for (const p of offen) {
      paket.push(p)
      groesse += p.j?.length || 100
      if (paket.length >= 40 || groesse > 700000) await senden()
    }
    await senden()
  }

  let cursor = cursorAlle[firma.id] || '1970-01-01T00:00:00Z'
  const neu = []
  for (;;) {
    const teil = await rest('rpc/abgleich_holen', {
      method: 'POST',
      body: { p_firma: firma.id, p_seit: cursor, p_limit: 500 },
    })
    neu.push(...teil)
    if (teil.length) cursor = teil[teil.length - 1].geaendert
    if (teil.length < 500) break
  }

  const basis = kontoGeaendert ? { ...neuLeer(), firma: firma.name || '' } : holeDaten()
  const erg = anwenden(basis, neu, korrekturen, stand)
  if (erg !== holeDaten()) setDaten(erg)
  schreibe(STK, stand)
  cursorAlle[firma.id] = cursor
  schreibe(CK, cursorAlle)
  return kontoGeaendert
}

// Dateien (Pläne, Dokumente) im Supabase-Speicher, Ordner = Firma
const BUCKET = 'dokumente'
export async function dateiHochladen(datei) {
  const pfad = `${sitzung.firma.id}/${Date.now().toString(36)}-${datei.name.replace(/[^\w.\-]+/g, '_')}`
  const r = await fetch(`${BASIS}/storage/v1/object/${BUCKET}/${pfad}`, {
    method: 'POST',
    headers: { apikey: SCHLUESSEL, Authorization: `Bearer ${await token()}`, 'Content-Type': datei.type || 'application/octet-stream', 'x-upsert': 'false' },
    body: datei,
  })
  if (!r.ok) throw new Error(fehlerText(await r.json().catch(() => ({})), r.status))
  return pfad
}
export async function dateiLink(pfad) {
  const r = await fetch(`${BASIS}/storage/v1/object/sign/${BUCKET}/${pfad}`, {
    method: 'POST',
    headers: { apikey: SCHLUESSEL, Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 3600 }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(fehlerText(j, r.status))
  const url = j.signedURL || j.signedUrl
  return url.startsWith('http') ? url : `${BASIS}/storage/v1${url}`
}
export async function dateiLoeschen(pfad) {
  await fetch(`${BASIS}/storage/v1/object/${BUCKET}/${pfad}`, {
    method: 'DELETE',
    headers: { apikey: SCHLUESSEL, Authorization: `Bearer ${await token()}` },
  })
}

// Öffentliche Bauherren-Ansicht: ohne Login, nur mit dem geheimen Link
export async function kundenAnsicht(tokenWert) {
  const r = await fetch(`${BASIS}/rest/v1/rpc/kunden_ansicht`, {
    method: 'POST',
    headers: { apikey: SCHLUESSEL, Authorization: `Bearer ${SCHLUESSEL}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: tokenWert }),
  })
  const j = await r.json().catch(() => null)
  if (!r.ok) throw new Error(fehlerText(j || {}, r.status))
  return j
}
