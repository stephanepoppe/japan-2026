// Offline-first store for the shared D1 collections (day items, links).
// The phone's copy in localStorage is what the screens show; every change lands there
// first and goes into one ordered outbox that drains whenever the network allows.
// Two phones offline on a plane each keep their own copy and merge on landing:
// edits send only changed fields (per-field last-sync-wins), deletes beat edits.
import { useCallback, useEffect, useState } from 'react'

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

const OUTBOX = 'outbox'
const cacheKey = coll => `${coll}.cache`
const isTemp = id => String(id).startsWith('pending-')
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const listeners = new Set()
const emit = () => listeners.forEach(f => f())
export const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn) }

const outbox = () => read(OUTBOX, [])
const setOutbox = q => { write(OUTBOX, q); emit() }
const cache = coll => read(cacheKey(coll), [])
const setCache = (coll, list) => { write(cacheKey(coll), list); emit() }

let inflight = null          // key of the op being sent right now
let busy = false
let rejected = []            // titles of changes the server refused (Q7b)

export const status = () => ({ waiting: outbox().length, busy, rejected })
export const dismissRejected = () => { rejected = []; emit() }

// Adds queued by the previous version of the app (one queue per endpoint).
for (const coll of ['items', 'links']) {
  const old = read(`${coll}.queue`, null)
  if (!old) continue
  write(OUTBOX, [...outbox(), ...old.map(body => ({ k: uid(), coll, op: 'add', id: `pending-${uid()}`, body }))])
  try { localStorage.removeItem(`${coll}.queue`) } catch {}
}

// ---- changes: apply locally, queue for the server ---------------------------------

export function add(coll, body) {
  const id = `pending-${uid()}`
  setCache(coll, [...cache(coll), { ...body, id }])
  setOutbox([...outbox(), { k: uid(), coll, op: 'add', id, body }])
  flush()
}

export function update(coll, id, changes) {
  setCache(coll, cache(coll).map(r => (r.id === id ? { ...r, ...changes } : r)))
  const q = outbox()
  const queuedAdd = q.find(o => o.op === 'add' && o.id === id && o.k !== inflight)
  if (queuedAdd) queuedAdd.body = { ...queuedAdd.body, ...changes }   // never sent: fold in
  else q.push({ k: uid(), coll, op: 'patch', id, body: changes })
  setOutbox(q)
  flush()
}

export function remove(coll, id) {
  setCache(coll, cache(coll).filter(r => r.id !== id))
  const q = outbox()
  const sending = q.some(o => o.id === id && o.k === inflight)
  if (isTemp(id) && !sending) setOutbox(q.filter(o => o.id !== id))  // server never saw it
  else setOutbox([...q, { k: uid(), coll, op: 'delete', id }])
  flush()
}

// ---- draining the outbox ----------------------------------------------------------

const request = ({ coll, op, id, body }) => {
  const url = op === 'add' ? `/api/${coll}` : `/api/${coll}/${encodeURIComponent(id)}`
  const method = { add: 'POST', patch: 'PATCH', delete: 'DELETE' }[op]
  return fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
}

let running = null
/** Sends queued changes in order. Resolves true when the outbox is empty. */
export const flush = () => (running ??= drain().finally(() => { running = null; busy = false; emit() }))

async function drain() {
  busy = true; emit()
  for (let op; (op = outbox()[0]);) {
    inflight = op.k
    let r
    try { r = await request(op) } catch { return false }   // offline (or Access bounced us)
    finally { inflight = null }
    if (r.status >= 500) return false                       // try again later, keep order

    let q = outbox().filter(o => o.k !== op.k)
    if (r.ok && op.op === 'add') {
      const row = await r.json().catch(() => null)
      if (row?.id) {
        // Later ops on the temp id (queued while this was in flight) follow it.
        q = q.map(o => (o.id === op.id ? { ...o, id: row.id } : o))
        write(cacheKey(op.coll), cache(op.coll).map(x => (x.id === op.id ? { ...x, id: row.id } : x)))
      }
    } else if (!r.ok && !(r.status === 404 && op.op !== 'add')) {
      // 404 on edit/delete = someone deleted it: delete wins, drop quietly (Q3).
      const title = op.body?.title ?? cache(op.coll).find(x => x.id === op.id)?.title ?? 'a change'
      rejected = [...rejected, title]
    }
    setOutbox(q)
  }
  return true
}

/** Flush, then take the server's list — but only if nothing local is still waiting. */
export async function reload(coll) {
  await running                                  // a send that started offline may still be failing
  if (!(await flush())) return
  try {
    const r = await fetch(`/api/${coll}`)
    if (!r.ok) return
    const list = await r.json()
    if (!outbox().length) setCache(coll, list)   // a change made mid-fetch wins
  } catch {}
}

// ---- React -------------------------------------------------------------------------

export function useStore(get) {
  const [v, setV] = useState(get)
  useEffect(() => subscribe(() => setV(get())), [get])
  return v
}

/** One shared collection: local list (unsynced rows flagged `pending`) + changes. */
export function useCollection(coll) {
  const snapshot = useCallback(() => {
    const waiting = new Set(outbox().map(o => o.id))
    return cache(coll).map(r => (waiting.has(r.id) ? { ...r, pending: true } : r))
  }, [coll])
  const list = useStore(snapshot)

  useEffect(() => {
    const go = () => reload(coll)
    go()
    addEventListener('online', go)
    return () => removeEventListener('online', go)
  }, [coll])

  return {
    list,
    add: useCallback(body => add(coll, body), [coll]),
    update: useCallback((id, ch) => update(coll, id, ch), [coll]),
    remove: useCallback(id => remove(coll, id), [coll]),
  }
}
