// AI day plans: the server makes and stores them (shared by both phones); the phone keeps
// a copy so a plan that loaded once still shows with no signal.
import { useCallback, useEffect, useRef, useState } from 'react'
import { staysOn } from './bookings'
import { describe } from './weather'

const KEY = 'plans.v1'
const readAll = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {} } catch { return {} } }
const keep = (day, plan) => { try { localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [day]: plan })) } catch {} }

/** Where you sleep that night: the start point for the first stop. null = no AI plan that day. */
export function stayAddress(day) {
  const b = staysOn(day)[0]?.b
  return b ? (b.address_ja || b.address || b.name) : null
}

/** Google Maps transit directions. No origin = from wherever the phone is. */
export const directionsUrl = (destination, origin) =>
  `https://www.google.com/maps/dir/?api=1&travelmode=transit&destination=${encodeURIComponent(destination)}`
  + (origin ? `&origin=${encodeURIComponent(origin)}` : '')

/** The forecast as the server wants it: numbers plus a word for the sky. */
export const weatherPayload = w => (w ? { ...w, label: describe(w.code).label } : null)

/** ~100 m: plenty to suggest from, no more precise than that. */
export const roundPosition = ({ latitude, longitude }) =>
  ({ lat: Math.round(latitude * 1000) / 1000, lon: Math.round(longitude * 1000) / 1000 })

async function call(url, init) {
  const r = await fetch(url, init)
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(body.error || 'Something went wrong. Try again.'), { status: r.status })
  return body
}

/**
 * The plan for one day. `auto` makes one when none exists (Today); otherwise the screen
 * offers a button (Calendar), so browsing the month doesn't generate 18 plans.
 * Mount it with key={day}: one hook instance per day, so a late answer can't land on another day.
 */
export function usePlan(day, weather, { auto }) {
  const eligible = Boolean(stayAddress(day))
  const [plan, setPlan] = useState(() => readAll()[day] ?? null)
  const [busy, setBusy] = useState(null)        // null | 'first' | 'new' | 'rethink'
  const [error, setError] = useState(null)
  const latest = useRef(weather)                 // the forecast can land after the first render
  latest.current = weather

  const generate = useCallback(async mode => {
    setBusy(mode); setError(null)
    try {
      const p = await call(`/api/plans/${day}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode, weather: weatherPayload(latest.current) }),
      })
      keep(day, p); setPlan(p)
    } catch (e) {
      setError(navigator.onLine === false ? 'You’re offline. Plans need a connection to make.' : e.message)
    } finally {
      setBusy(null)
    }
  }, [day])

  useEffect(() => {
    if (!eligible) return
    let gone = false
    call(`/api/plans/${day}`)
      .then(p => { if (!gone) { keep(day, p); setPlan(p) } })
      .catch(e => { if (!gone && e.status === 404 && auto) generate('first') })   // offline: keep the copy
    return () => { gone = true }
  }, [day, eligible, auto, generate])

  return { eligible, plan, busy, error, generate }
}

export async function surprise({ day, time, position, weather }) {
  return call('/api/surprise', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ day, time, ...(position ?? {}), weather: weatherPayload(weather) }),
  })
}
