// Offline outbox: queue while offline, fold edits into unsent adds, merge on landing.
// Run: node src/lib/sync.test.mjs
import assert from 'node:assert/strict'

const store = new Map()
globalThis.localStorage = {
  getItem: k => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
}
globalThis.addEventListener = () => {}

// Fake server: rows by id; `online` toggles the network.
let online = false, n = 0
const rows = new Map([['srv1', { id: 'srv1', day: '2026-10-08', title: 'Sumo', time: '10:00' }]])
const sent = []
globalThis.fetch = async (url, { method = 'GET', body } = {}) => {
  if (!online) throw new TypeError('offline')
  const b = body && JSON.parse(body)
  const id = decodeURIComponent(url.split('/')[3] ?? '')
  sent.push(`${method} ${id}`)
  const res = (s, j) => ({ ok: s < 300, status: s, json: async () => j })
  if (method === 'GET') return res(200, [...rows.values()])
  if (method === 'POST') {
    if (b.title.length > 200) return res(400, {})
    const row = { ...b, id: `srv-new${++n}` }; rows.set(row.id, row); return res(201, row)
  }
  if (!rows.has(id)) return method === 'DELETE' ? res(204) : res(404, {})
  if (method === 'PATCH') { rows.set(id, { ...rows.get(id), ...b }); return res(200, rows.get(id)) }
  rows.delete(id); return res(204)
}

const s = await import('./sync.js')
const cache = () => JSON.parse(store.get('items.cache') ?? '[]')

// Start with the server copy cached (as if opened before boarding).
online = true; await s.reload('items'); online = false
assert.equal(cache().length, 1)

// On the plane: add, edit the new item, edit an existing one, add + delete another.
s.add('items', { day: '2026-10-09', title: 'Ramen' })
await s.flush()                                   // the send attempt fails offline
const tmp = cache().find(r => r.title === 'Ramen').id
s.update('items', tmp, { time: '19:00' })
s.update('items', 'srv1', { title: 'Sumo practice' })
s.add('items', { day: '2026-10-09', title: 'Nope' })
s.remove('items', cache().find(r => r.title === 'Nope').id)
s.add('items', { day: '2026-10-10', title: 'x'.repeat(201) })   // server will refuse
await s.flush()
assert.equal(s.status().waiting, 3, 'edit folded into add; add+delete cancelled')
assert.equal(cache().length, 3)

// Meanwhile the other phone changed the time of srv1 (a different field).
rows.set('srv1', { ...rows.get('srv1'), time: '11:00' })

// Landing.
online = true
await s.reload('items')
assert.equal(s.status().waiting, 0)
assert.deepEqual(s.status().rejected, ['x'.repeat(201)])
assert.deepEqual(rows.get('srv1'), { id: 'srv1', day: '2026-10-08', title: 'Sumo practice', time: '11:00' }, 'per-field merge')
assert.ok([...rows.values()].some(r => r.title === 'Ramen' && r.time === '19:00'))
assert.ok(!sent.some(x => x.includes('pending-')), 'temp ids never reach the server')
assert.equal(cache().length, 2, 'cache now mirrors the server')

// Edit vs delete: other phone deleted it, our offline edit is dropped quietly.
online = false
s.dismissRejected()
s.update('items', 'srv1', { title: 'gone?' })
rows.delete('srv1'); online = true
await s.reload('items')
assert.deepEqual(s.status().rejected, [])
assert.ok(!cache().some(r => r.id === 'srv1'))

console.log('sync ok')
