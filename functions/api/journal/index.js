import { json } from '../items/index.js'

// GET /api/journal -> { owner, moments: [...] } with each moment's comments; owners and readers.
// Owners are the only requests carrying X-Trip-Email (functions/_middleware.js strips it for readers).
export const isOwner = req => req.headers.has('X-Trip-Email')
export const photoUrl = key => `/api/journal/photos/${key}`

export async function onRequestGet({ request, env }) {
  const [{ results: moments = [] }, { results: comments = [] }] = await env.DB.batch([
    env.DB.prepare('SELECT id, day, time, place_name, lat, lon, text, photos FROM moments ORDER BY day, time'),
    env.DB.prepare('SELECT id, moment_id, name, text, at FROM comments ORDER BY at'),
  ])
  return json({
    owner: isOwner(request),
    moments: moments.map(m => ({
      id: m.id, day: m.day, time: m.time, text: m.text,
      place: { name: m.place_name ?? '', lat: m.lat, lon: m.lon },
      photos: JSON.parse(m.photos).map(p => ({ url: photoUrl(p.key), w: p.w, h: p.h })),
      comments: comments.filter(c => c.moment_id === m.id).map(({ moment_id, ...c }) => c),
    })),
  })
}
