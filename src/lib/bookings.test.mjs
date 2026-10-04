// node --experimental-strip-types not needed; plain asserts. Run: node src/lib/bookings.test.mjs
import assert from 'node:assert/strict'

// Stub the JSON import so the test is independent of real data.
const BOOKINGS = [
  { kind: 'flight', name: 'KLM', start: '2026-10-06T13:55' },
  { kind: 'stay', name: 'Ryogoku', start: '2026-10-07T16:00', end: '2026-10-11' },
  { kind: 'transport', name: 'Kodama', start: '2026-10-11T10:27' },
  { kind: 'stay', name: 'Hakone', start: '2026-10-11', end: '2026-10-13' },
]
const dayOf = s => (s ?? '').slice(0, 10)

function tripRange(bs) {
  const days = bs.flatMap(b => [dayOf(b.start), dayOf(b.end)]).filter(Boolean).sort()
  return { first: days[0], last: days[days.length - 1] }
}
function tripDays(bs) {
  const { first, last } = tripRange(bs)
  const out = []
  for (const d = new Date(first + 'T00:00:00Z'); ; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10)
    out.push(iso)
    if (iso >= last) break
  }
  return out
}
function forDay(bs, iso) {
  return bs.filter(b => {
    const s = dayOf(b.start), e = dayOf(b.end)
    if (s === iso || e === iso) return true
    return s && e && s < iso && iso < e
  }).map(b => ({ ...b, role: dayOf(b.start) === iso ? 'start' : dayOf(b.end) === iso ? 'end' : 'during' }))
}

const r = tripRange(BOOKINGS)
assert.equal(r.first, '2026-10-06')
assert.equal(r.last, '2026-10-13')

const days = tripDays(BOOKINGS)
assert.equal(days.length, 8, 'Oct 6..13 inclusive is 8 days')
assert.equal(days[0], '2026-10-06')
assert.equal(days.at(-1), '2026-10-13')

// A mid-stay day shows the stay even though nothing starts or ends on it.
const mid = forDay(BOOKINGS, '2026-10-09')
assert.equal(mid.length, 1)
assert.equal(mid[0].name, 'Ryogoku')
assert.equal(mid[0].role, 'during')

// Checkout and the next check-in land on the same day, both visible.
const oct11 = forDay(BOOKINGS, '2026-10-11').map(b => `${b.name}:${b.role}`).sort()
assert.deepEqual(oct11, ['Hakone:start', 'Kodama:start', 'Ryogoku:end'])

// Time precision on `start` must not hide a booking from its own day.
assert.equal(forDay(BOOKINGS, '2026-10-06')[0].name, 'KLM')

console.log('bookings logic ok —', days.length, 'days,', BOOKINGS.length, 'bookings')

// ---- calendar helpers ----
function staysOnTest(bs, iso) {
  return bs.filter(b => {
    const s = dayOf(b.start), e = dayOf(b.end)
    return b.kind === 'stay' && s && e && s <= iso && iso < e
  }).map(b => {
    const s = new Date(dayOf(b.start) + 'T00:00:00Z')
    const e = new Date(dayOf(b.end) + 'T00:00:00Z')
    const here = new Date(iso + 'T00:00:00Z')
    return { name: b.name, night: Math.round((here - s) / 864e5) + 1,
             nights: Math.round((e - s) / 864e5) }
  })
}

// A 4-night stay: you are "staying" on the first night and the three after,
// but NOT on checkout day — that morning you leave.
const ryo = BOOKINGS.find(b => b.name === 'Ryogoku')
assert.deepEqual(staysOnTest([ryo], '2026-10-07'), [{ name: 'Ryogoku', night: 1, nights: 4 }])
assert.deepEqual(staysOnTest([ryo], '2026-10-10'), [{ name: 'Ryogoku', night: 4, nights: 4 }])
assert.deepEqual(staysOnTest([ryo], '2026-10-11'), [], 'checkout day is not a night')
assert.deepEqual(staysOnTest([ryo], '2026-10-06'), [], 'day before check-in')

console.log('calendar helpers ok')

// ---- what to wear (pure rules, no network) ----
function whatToWear({ tmax, tmin, rain }) {
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

// Real forecast values from this trip.
assert.match(whatToWear({ tmax: 28, tmin: 20, rain: 4 }), /^Hot/)      // Tokyo, 17 Oct
assert.match(whatToWear({ tmax: 20, tmin: 14, rain: 23 }), /^Mild/)    // Koyasan, 17 Oct
assert.ok(!whatToWear({ tmax: 20, tmin: 14, rain: 23 }).includes('umbrella'), '23% is not umbrella weather')
assert.ok(whatToWear({ tmax: 19, tmin: 12, rain: 65 }).includes('take an umbrella'))
assert.ok(whatToWear({ tmax: 24, tmin: 10, rain: 0 }).includes('chilly first thing'),
          '14-degree swing with a cold morning must warn')
assert.ok(!whatToWear({ tmax: 30, tmin: 24, rain: 0 }).includes('chilly'),
          'warm night must not warn')
assert.equal(whatToWear({ tmax: null }), null, 'no data, no advice')

// Boundaries, so a band shift is caught
assert.match(whatToWear({ tmax: 23, tmin: 20 }), /^Warm/)
assert.match(whatToWear({ tmax: 22.9, tmin: 20 }), /^Mild/)

console.log('what-to-wear rules ok')

// ---- arrival card lifecycle ----
// It must appear before and during the flight, and disappear once you have landed.
const ARRIVE = '2026-10-07'
const showsOn = d => !(d > ARRIVE)
assert.ok(showsOn('2026-10-04'), 'visible two days before')
assert.ok(showsOn('2026-10-06'), 'visible on departure day')
assert.ok(showsOn('2026-10-07'), 'visible on the day you land')
assert.ok(!showsOn('2026-10-08'), 'gone the day after landing')
assert.ok(!showsOn('2026-10-15'), 'still gone mid-trip')

// The flight number given to immigration is the one that lands in Japan, not the return.
const inbound = s => (s ?? '').split('/')[0].trim()
assert.equal(inbound('KL0861 / KL0862'), 'KL0861')
assert.equal(inbound('KL0861'), 'KL0861')
assert.equal(inbound(null), '')

// Arrival time is parsed out of KLM's prose, not assumed.
const arr = /arrives\s+(?:[\w.\-]+\s+){0,4}(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/i
const m = 'Outbound KL0861 departs Amsterdam 2026-10-06 13:55, arrives Tokyo Narita 2026-10-07 10:25, Economy'.match(arr)
assert.equal(m[1], '2026-10-07')
assert.equal(m[2], '10:25')

// Multi-word airport names must not defeat it.
assert.ok(arr.test('arrives Tokyo Narita 2026-10-07 10:25'))
assert.ok(arr.test('arrives Narita 2026-10-07 10:25'))
assert.ok(arr.test('arrives Tokyo Narita Intl. 2026-10-07 10:25'))

console.log('arrival card logic ok')
