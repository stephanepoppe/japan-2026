import { json } from '../../items/index.js'
import { isOwner } from '../index.js'
import { validate } from './index.js'

// DELETE /api/journal/moments/:id -> the moment, its comments and its photos (owners only)
export async function onRequestDelete({ params, request, env }) {
  if (!isOwner(request)) return json({ error: 'owners only' }, 403)
  const id = String(params.id ?? '')
  const photos = await env.DB.prepare('SELECT photos FROM moments WHERE id = ?').bind(id).first('photos')
  if (photos === null) return json({ error: 'not found' }, 404)
  await env.DB.batch([
    env.DB.prepare('DELETE FROM comments WHERE moment_id = ?').bind(id),
    env.DB.prepare('DELETE FROM moments WHERE id = ?').bind(id),
  ])
  const keys = JSON.parse(photos).map(p => p.key)
  if (keys.length) await env.PHOTOS.delete(keys)
  return new Response(null, { status: 204 })
}

// PUT /api/journal/moments/:id -> replace its day, time, text, place and photos (owners only).
// Photos left out of the new list are deleted from the bucket.
export async function onRequestPut({ params, request, env }) {
  if (!isOwner(request)) return json({ error: 'owners only' }, 403)
  const id = String(params.id ?? '')
  let body
  try { body = await request.json() } catch { return json({ error: 'bad json' }, 400) }
  const { error, value: v } = validate(body)
  if (error) return json({ error }, 400)
  const before = await env.DB.prepare('SELECT photos FROM moments WHERE id = ?').bind(id).first('photos')
  if (before === null) return json({ error: 'not found' }, 404)

  await env.DB
    .prepare('UPDATE moments SET day = ?, time = ?, place_name = ?, lat = ?, lon = ?, text = ?, photos = ? WHERE id = ?')
    .bind(v.day, v.time, v.place_name, v.lat, v.lon, v.text, JSON.stringify(v.photos), id)
    .run()
  const kept = new Set(v.photos.map(p => p.key))
  const gone = JSON.parse(before).map(p => p.key).filter(k => !kept.has(k))
  if (gone.length) await env.PHOTOS.delete(gone)
  return json({ id, day: v.day })
}
