import { json } from '../../items/index.js'
import { isOwner } from '../index.js'

// POST /api/journal/photos (raw JPEG body) -> { key }. Owners only.
// The journal shrinks photos to JPEG on the phone first, which also drops their EXIF (GPS included).
// ponytail: a photo whose moment is never posted stays in R2; sweep unreferenced keys if that ever adds up.
const MAX = 15 * 1024 * 1024

export async function onRequestPost({ request, env }) {
  if (!isOwner(request)) return json({ error: 'owners only' }, 403)
  if (request.headers.get('content-type') !== 'image/jpeg') return json({ error: 'send image/jpeg' }, 415)
  const body = await request.arrayBuffer()
  if (!body.byteLength || body.byteLength > MAX) return json({ error: 'photo must be under 15 MB' }, 413)
  const key = `${crypto.randomUUID()}.jpg`
  await env.PHOTOS.put(key, body, { httpMetadata: { contentType: 'image/jpeg' } })
  return json({ key }, 201)
}
