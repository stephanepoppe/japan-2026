import { useEffect, useState } from 'react'
import { BOOKINGS } from './bookings'
import { getForecast, locKey } from './weather'

const DAY = s => (s ?? '').slice(0, 10)

/** Stays that carry coordinates, in date order — the trip's geography. */
const PLACES = BOOKINGS
  .filter(b => b.kind === 'stay' && b.lat != null && b.lon != null)
  .map(b => ({ from: DAY(b.start), to: DAY(b.end), city: b.city, lat: b.lat, lon: b.lon }))
  .sort((a, b) => a.from.localeCompare(b.from))

/**
 * Where you are on a given day. The stay covering it, or failing that the nearest
 * one in time — so the flight out and the flight home still get a sensible city
 * instead of a blank.
 */
export function placeOn(iso) {
  if (!PLACES.length) return null
  return (
    PLACES.find(p => p.from <= iso && iso < p.to) ??
    PLACES.reduce((best, p) => {
      const d = Math.min(Math.abs(Date.parse(p.from) - Date.parse(iso)),
                         Math.abs(Date.parse(p.to) - Date.parse(iso)))
      return !best || d < best.d ? { ...p, d } : best
    }, null)
  )
}

export function useWeather() {
  const [data, setData] = useState({})

  useEffect(() => {
    const locs = [...new Map(PLACES.map(p => [locKey(p.lat, p.lon), [p.lat, p.lon]])).values()]
    getForecast(locs).then(setData)
  }, [])

  /** Weather for a day, at the place you'll be that day. null beyond the horizon. */
  return (iso) => {
    const place = placeOn(iso)
    if (!place) return null
    const day = data[locKey(place.lat, place.lon)]?.[iso]
    return day ? { ...day, city: place.city } : null
  }
}
