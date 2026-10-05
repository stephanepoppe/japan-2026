import { json } from '../../items/index.js'
import { isOwner } from '../index.js'

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
