// Run: node src/lib/journal.test.mjs
// What a posted moment may contain (functions/api/journal/moments).
import assert from 'node:assert/strict'
import { validate } from '../../functions/api/journal/moments/index.js'

const key = '0b4baa1f-49d3-48f2-9ad7-72b11df74f6b.jpg'
const ok = { day: '2026-10-15', time: '07:50', text: ' Fushimi Inari ', place: { name: 'Kyoto', lat: 34.97, lon: 135.77 }, photos: [{ key, w: 1600, h: 1067 }] }

const { value } = validate(ok)
assert.equal(value.text, 'Fushimi Inari', 'text trimmed')
assert.deepEqual(value.photos, [{ key, w: 1600, h: 1067 }])
assert.ok(validate({ ...ok, text: '' }).value, 'photo only is fine')
assert.ok(validate({ ...ok, photos: [] }).value, 'text only is fine')
assert.equal(validate({ ...ok, place: { name: 'x' } }).value.lat, null, 'no coordinates: no pin')

const bad = {
  'nothing to show': { ...ok, text: '', photos: [] },
  'bad day': { ...ok, day: '15/10' },
  'bad time': { ...ok, time: '7u50' },
  'half a coordinate': { ...ok, place: { lat: 34 } },
  'lat out of range': { ...ok, place: { lat: 95, lon: 1 } },
  'photo key outside the bucket': { ...ok, photos: [{ key: '../secret.jpg', w: 1, h: 1 }] },
  'photo without size': { ...ok, photos: [{ key }] },
}
for (const [why, body] of Object.entries(bad)) assert.ok(validate(body).error, why)

console.log('journal ok')
