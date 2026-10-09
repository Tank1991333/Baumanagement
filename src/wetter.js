// Wetter: GeoSphere Austria (offene Daten, CC BY 4.0, auch gewerblich frei nutzbar)
// Adresssuche: OpenStreetMap Nominatim (© OpenStreetMap-Mitwirkende)

export async function koordinatenAusAdresse(adresse) {
  const r = await fetch(
    'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=at&q=' + encodeURIComponent(adresse),
    { headers: { 'Accept-Language': 'de' } }
  )
  if (!r.ok) throw new Error('Adresssuche gerade nicht erreichbar.')
  const j = await r.json()
  if (!j.length) throw new Error('Adresse nicht gefunden. Tipp: auf der Baustelle „Standort übernehmen“ tippen.')
  return { lat: +(+j[0].lat).toFixed(5), lon: +(+j[0].lon).toFixed(5) }
}

export function aktuellerStandort(timeout = 10000) {
  return new Promise((ok, fail) => {
    if (!navigator.geolocation) return fail(new Error('Dieses Gerät kann keinen Standort ermitteln.'))
    navigator.geolocation.getCurrentPosition(
      p => ok({ lat: +p.coords.latitude.toFixed(5), lon: +p.coords.longitude.toFixed(5), genau: Math.round(p.coords.accuracy) }),
      e => fail(new Error(e.code === 1 ? 'Der Standortzugriff wurde nicht erlaubt.' : 'Der Standort konnte nicht ermittelt werden.')),
      { enableHighAccuracy: true, timeout, maximumAge: 60000 }
    )
  })
}

const rund = x => Math.round(x * 10) / 10

export async function wetterFuerTag(lat, lon, datum) {
  const url =
    'https://dataset.api.hub.geosphere.at/v1/timeseries/historical/inca-v1-1h-1km' +
    `?parameters=T2M,RR,UU,VV&start=${datum}T06:00&end=${datum}T18:00&lat_lon=${lat},${lon}&output_format=geojson`
  let r
  try {
    r = await fetch(url)
  } catch {
    throw new Error('Wetterdienst nicht erreichbar. Bitte Wetter von Hand eintragen.')
  }
  if (!r.ok) throw new Error('Für diesen Tag gibt es noch keine Wetterdaten. Bitte von Hand eintragen.')
  const j = await r.json()
  const p = j.features?.[0]?.properties?.parameters
  const reihe = k => (p?.[k]?.data || []).map(v => (v == null ? null : +v))
  const t = reihe('T2M').filter(v => v != null)
  if (!t.length) throw new Error('Für diesen Tag liegen noch keine Wetterdaten vor (meist einige Stunden Verzögerung).')
  const rr = reihe('RR').filter(v => v != null).reduce((s, v) => s + v, 0)
  const uu = reihe('UU'), vv = reihe('VV')
  const wind = Math.max(0, ...uu.map((u, i) => (u != null && vv[i] != null ? Math.hypot(u, vv[i]) : 0))) * 3.6
  const tmin = Math.min(...t), tmax = Math.max(...t)
  const wetter =
    rr >= 10 ? 'Starkregen' : rr >= 0.5 ? (tmax <= 1 ? 'Schnee' : 'Regen') : wind >= 60 ? 'Wind / Sturm'
      : tmax >= 32.5 ? 'Hitze' : tmin < 0 ? 'Frost' : null
  return {
    wetter,
    temperatur: `${rund(tmin)} bis ${rund(tmax)}`,
    text: `${rund(tmin)} bis ${rund(tmax)} °C, Niederschlag ${rr.toFixed(1)} mm, Wind bis ${Math.round(wind)} km/h (6 bis 18 Uhr, Datenquelle: GeoSphere Austria)`,
  }
}
