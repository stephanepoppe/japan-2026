import { PHOTO_KEY } from '../moments/index.js'

// GET /api/journal/photos/:key -> the photo. Keys are random and never reused, so cache for good.
export async function onRequestGet({ params, env }) {
  const key = String(params.key ?? '')
  if (!PHOTO_KEY.test(key)) return new Response('Not found', { status: 404 })
  const obj = await env.PHOTOS.get(key)
  if (!obj) return new Response('Not found', { status: 404 })
  return new Response(obj.body, {
    headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=31536000, immutable', etag: obj.httpEtag },
  })
}
