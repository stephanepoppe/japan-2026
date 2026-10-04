// Open-Meteo: free, no key, CORS-enabled. One request covers every location.
const API = 'https://api.open-meteo.com/v1/forecast'
const KEY = 'weather.v1'
const TTL = 3 * 60 * 60 * 1000          // 3h, same policy as the FX rate

// WMO weather codes, collapsed to what a traveller actually distinguishes.
const WMO = [
  [[0], '☀', 'Clear'],
  [[1], '🌤', 'Mostly clear'],
  [[2], '⛅', 'Partly cloudy'],
  [[3], '☁', 'Overcast'],
  [[45, 48], '🌫', 'Fog'],
  [[51, 53, 55, 56, 57], '🌦', 'Drizzle'],
  [[61, 63, 80, 81], '🌧', 'Rain'],
  [[65, 82], '🌧', 'Heavy rain'],
  [[66, 67], '🌧', 'Freezing rain'],
  [[71, 73, 75, 77, 85, 86], '❄', 'Snow'],
  [[95, 96, 99], '⛈', 'Thunderstorms'],
]

export function describe(code) {
  const hit = WMO.find(([codes]) => codes.includes(code))
  return hit ? { icon: hit[1], label: hit[2] } : { icon: '', label: '' }
}

/** Key a location consistently on both sides of the request. */
export const locKey = (lat, lon) => `${lat.toFixed(2)},${lon.toFixed(2)}`

/**
 * What to wear, from numbers alone — no model, no network, no key (Q3a).
 * Bands first, then the two things that actually catch people out: a cold morning
 * under a warm afternoon, and rain you didn't plan for.
 */
export function whatToWear({ tmax, tmin, rain }) {
  if (tmax == null) return null
  const base =
    tmax >= 28 ? 'Hot — t-shirt weather'
    : tmax >= 23 ? 'Warm — short sleeves are fine'
    : tmax >= 18 ? 'Mild — take a light layer'
    : tmax >= 13 ? 'Cool — you’ll want a jacket'
    : tmax >= 8 ? 'Cold — proper coat'
    : 'Very cold — coat, hat, the lot'

  const parts = [base]
  if (tmin != null && tmax - tmin >= 9 && tmin < 15) {
    parts.push(`chilly first thing and after dark (${Math.round(tmin)}°)`)
  }
  if (rain != null) {
    if (rain >= 60) parts.push('take an umbrella')
    else if (rain >= 30) parts.push('maybe an umbrella')
  }
  return parts.join(', ') + '.'
}

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') } catch { return null }
}

/**
 * Forecast for several places at once, keyed by locKey then by ISO date.
 * Returns cached data immediately when fresh, and on any failure — a stale forecast
 * beats a blank panel.
 */
export async function getForecast(locations) {
  const wanted = locations.map(([lat, lon]) => locKey(lat, lon)).sort().join('|')
  const cached = read()
  if (cached && cached.wanted === wanted && Date.now() - cached.at < TTL) return cached.data
  if (!locations.length) return {}

  const q = new URLSearchParams({
    latitude: locations.map(l => l[0]).join(','),
    longitude: locations.map(l => l[1]).join(','),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
    timezone: 'Asia/Tokyo',
    forecast_days: '16',
  })

  try {
    const r = await fetch(`${API}?${q}`)
    if (!r.ok) throw new Error(`weather ${r.status}`)
    const body = await r.json()
    const list = Array.isArray(body) ? body : [body]

    const data = {}
    list.forEach((loc, i) => {
      const [lat, lon] = locations[i]
      const d = loc.daily
      const byDay = {}
      d.time.forEach((iso, j) => {
        byDay[iso] = {
          code: d.weather_code[j],
          tmax: d.temperature_2m_max[j],
          tmin: d.temperature_2m_min[j],
          rain: d.precipitation_probability_max[j],
          sunrise: d.sunrise[j]?.slice(11, 16),
          sunset: d.sunset[j]?.slice(11, 16),
        }
      })
      data[locKey(lat, lon)] = byDay
    })

    localStorage.setItem(KEY, JSON.stringify({ wanted, at: Date.now(), data }))
    return data
  } catch {
    return cached?.data ?? {}      // stale is better than nothing
  }
}
