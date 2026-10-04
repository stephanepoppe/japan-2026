import raw from '../../data/bookings.json'

export const BOOKINGS = (raw.bookings ?? []).slice().sort(
  (a, b) => (a.start ?? '9999').localeCompare(b.start ?? '9999')
)

const dayOf = s => (s ?? '').slice(0, 10)

/** Trip span, derived from the data rather than hardcoded. */
export function tripRange() {
  const days = BOOKINGS.flatMap(b => [dayOf(b.start), dayOf(b.end)]).filter(Boolean).sort()
  return { first: days[0], last: days[days.length - 1] }
}

/** Every date from first to last, as YYYY-MM-DD. */
export function tripDays() {
  const { first, last } = tripRange()
  if (!first) return []
  const out = []
  for (const d = new Date(first + 'T00:00:00Z'); ; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10)
    out.push(iso)
    if (iso >= last) break
  }
  return out
}

/** What's relevant on a given day: anything starting, ending, or spanning it. */
export function forDay(iso) {
  return BOOKINGS.filter(b => {
    const s = dayOf(b.start), e = dayOf(b.end)
    if (s === iso || e === iso) return true
    return s && e && s < iso && iso < e
  }).map(b => ({
    ...b,
    role: dayOf(b.start) === iso ? 'start' : dayOf(b.end) === iso ? 'end' : 'during',
  }))
}

export function today() {
  return new Date().toISOString().slice(0, 10)
}

/** Where to point the "manage booking" button (Q14: email link first, then constructed). */
export function bookingLink(b) {
  if (b.url) return b.url
  if (b.confirmation && b.pin) {
    return `https://secure.booking.com/mybooking.html?bn=${encodeURIComponent(b.confirmation)}`
      + `&pincode=${encodeURIComponent(b.pin)}`
  }
  if (/airbnb/i.test(b.source_subject ?? '') || /airbnb/i.test(b.notes ?? '')) {
    return 'https://www.airbnb.com/trips'
  }
  return null
}

/** Japanese address wins: far more reliable in Google Maps inside Japan. */
export function mapsLink(b) {
  const q = b.address || [b.name, b.city].filter(Boolean).join(', ')
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null
}

const DAY = s => (s ?? '').slice(0, 10)
const TIME = s => (s && s.length > 10 ? s.slice(11, 16) : null)

/** Bookings with no usable date — they'd otherwise vanish from a calendar entirely. */
export function undated() {
  return BOOKINGS.filter(b => !DAY(b.start))
}

/**
 * One chronological column for a day: timed things in order, untimed first.
 * A stay only produces a timed entry on the days it actually starts or ends —
 * the nights in between are a header, not an event (Q3).
 */
export function dayEntries(iso, items = []) {
  const out = []

  for (const b of BOOKINGS) {
    const s = DAY(b.start), e = DAY(b.end)
    if (b.kind === 'stay') {
      if (s === iso) out.push({ type: 'booking', at: TIME(b.start), role: 'start', b })
      if (e === iso) out.push({ type: 'booking', at: TIME(b.end), role: 'end', b })
    } else if (s === iso) {
      out.push({ type: 'booking', at: TIME(b.start), role: 'start', b })
    }
  }

  for (const i of items.filter(i => i.day === iso)) {
    out.push({ type: 'item', at: i.time || null, item: i })
  }

  return out.sort((x, y) => (x.at ?? '').localeCompare(y.at ?? ''))
}

/** Stays covering this day, with which night it is — shown as a header line. */
export function staysOn(iso) {
  return BOOKINGS.filter(b => {
    const s = DAY(b.start), e = DAY(b.end)
    return b.kind === 'stay' && s && e && s <= iso && iso < e
  }).map(b => {
    const s = new Date(DAY(b.start) + 'T00:00:00Z')
    const e = new Date(DAY(b.end) + 'T00:00:00Z')
    const here = new Date(iso + 'T00:00:00Z')
    return {
      b,
      night: Math.round((here - s) / 864e5) + 1,
      nights: Math.round((e - s) / 864e5),
    }
  })
}

/** Which days carry something, for the grid dots. */
export function dayMarks(items = []) {
  const marks = {}
  const bump = (d, kind) => {
    if (!d) return
    marks[d] ??= new Set()
    marks[d].add(kind)
  }
  for (const b of BOOKINGS) {
    const s = DAY(b.start), e = DAY(b.end)
    bump(s, b.kind)
    if (b.kind === 'stay' && e) bump(e, b.kind)
  }
  for (const i of items) bump(i.day, 'item')
  return marks
}
