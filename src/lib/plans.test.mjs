// Run: node src/lib/plans.test.mjs
// Bundles the real modules (JSON import and all) with Vite's esbuild instead of copying logic.
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const { outputFiles: [out] } = await build({
  stdin: {
    contents: `export * from './functions/api/_ai.js'; export { directionsUrl, roundPosition } from './src/lib/plans.js'`,
    resolveDir: process.cwd(),
  },
  bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent',
})
const m = await import('data:text/javascript;base64,' + Buffer.from(out.text).toString('base64'))

// Which days get an AI plan (Q19): only nights with somewhere to stay.
assert.equal(m.stayFor('2026-10-06'), null, 'in the air: no plan')
assert.equal(m.stayFor('2026-10-07').city, 'Tokyo', 'arrival day plans for the destination')
assert.equal(m.stayFor('2026-10-11').city, 'Hakone', 'travel day: the new stay, not the old one')
assert.equal(m.stayFor('2026-10-22'), null, 'gap night before the flight home')

// Areas are split over every night of a stay (Q22).
assert.deepEqual(m.nightsOf(m.stayFor('2026-10-14')), ['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'])

// Weather from the phone is reduced to plain numbers before it reaches a prompt.
assert.equal(m.weatherLine({ tmin: 14.6, tmax: 22.2, rain: 'x', label: 'Rain' }), '15–22°C, Rain, 0% chance of rain')
assert.equal(m.weatherLine(null), 'No forecast yet.')

// Every schema object must forbid extra keys and require all of them (structured outputs).
const strict = s => s.type !== 'object' || (s.additionalProperties === false
  && s.required.length === Object.keys(s.properties).length
  && Object.values(s.properties).every(p => strict(p.items ?? p)))
for (const s of [m.AREAS, m.PLAN, m.SURPRISE]) assert.ok(strict(s))

// Maps: transit directions, from the phone's position when there is no origin.
assert.equal(m.directionsUrl('Café Bach, Tokyo'),
  'https://www.google.com/maps/dir/?api=1&travelmode=transit&destination=Caf%C3%A9%20Bach%2C%20Tokyo')
assert.ok(m.directionsUrl('A', 'B').endsWith('&origin=B'))

// GPS is rounded to ~100 m before it leaves the phone (Q16).
assert.deepEqual(m.roundPosition({ latitude: 35.712345, longitude: 139.796789 }), { lat: 35.712, lon: 139.797 })

console.log('plans ok')
