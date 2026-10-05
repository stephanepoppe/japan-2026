import { json } from '../../items/index.js'
import { isOwner } from '../index.js'

// POST /api/journal/moments -> post one (owners only). Photos are uploaded first, see ../photos.
export const PHOTO_KEY = /^[0-9a-f-]{36}\.jpg$/

const coord = (v, max) => (v === null || v === undefined || v === '' ? null
  : Number.isFinite(+v) && Math.abs(+v) <= max ? +v : NaN)

export function validate(body) {
  const day = String(body.day ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: 'day must be YYYY-MM-DD' }
  const time = String(body.time ?? '')
  if (!/^\d{2}:\d{2}$/.test(time)) return { error: 'time must be HH:MM' }
  const text = String(body.text ?? '').trim()
  if (text.length > 2000) return { error: 'text max 2000 chars' }
  const place_name = String(body.place?.name ?? '').trim().slice(0, 200) || null
  const lat = coord(body.place?.lat, 90), lon = coord(body.place?.lon, 180)
  if (Number.isNaN(lat) || Number.isNaN(lon) || (lat === null) !== (lon === null)) return { error: 'bad coordinates' }
  const photos = Array.isArray(body.photos) ? body.photos : []
  if (photos.length > 12) return { error: 'max 12 photos' }
  const ok = p => PHOTO_KEY.test(String(p?.key)) && Number.isInteger(p.w) && Number.isInteger(p.h) && p.w > 0 && p.h > 0
  if (!photos.every(ok)) return { error: 'bad photo' }
  if (!text && !photos.length) return { error: 'a moment needs text or a photo' }
  return { value: { day, time, text, place_name, lat, lon, photos: photos.map(({ key, w, h }) => ({ key, w, h })) } }
}

export async function onRequestPost({ request, env }) {
  if (!isOwner(request)) return json({ error: 'owners only' }, 403)
  let body
  try { body = await request.json() } catch { return json({ error: 'bad json' }, 400) }
  const { error, value: v } = validate(body)
  if (error) return json({ error }, 400)

  const id = crypto.randomUUID()
  await env.DB
    .prepare(`INSERT INTO moments (id, day, time, place_name, lat, lon, text, photos, created_by, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, v.day, v.time, v.place_name, v.lat, v.lon, v.text, JSON.stringify(v.photos),
          request.headers.get('X-Trip-Email'), new Date().toISOString())
    .run()
  return json({ id, day: v.day }, 201)
}
