import { json } from '../items/index.js'

// GET  /api/links   -> all bookmarks, oldest first
// POST /api/links   -> add one {title, url}
const email = req => req.headers.get('Cf-Access-Authenticated-User-Email') ?? 'unknown'

export async function onRequestGet({ env }) {
  const { results } = await env.DB
    .prepare('SELECT id, title, url FROM links ORDER BY created_at')
    .all()
  return json(results ?? [])
}

export async function onRequestPost({ request, env }) {
  let body
  try { body = await request.json() } catch { return json({ error: 'bad json' }, 400) }

  const title = String(body.title ?? '').trim()
  if (!title || title.length > 200) return json({ error: 'title must be 1-200 chars' }, 400)

  // Only http(s): a stored javascript: URL would run on tap.
  let url
  try { url = new URL(String(body.url ?? '')) } catch { return json({ error: 'bad url' }, 400) }
  if (!/^https?:$/.test(url.protocol) || url.href.length > 2000) return json({ error: 'url must be http(s)' }, 400)

  const row = { id: crypto.randomUUID(), title, url: url.href }
  await env.DB
    .prepare('INSERT INTO links (id, title, url, created_by, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(row.id, row.title, row.url, email(request), new Date().toISOString())
    .run()

  return json(row, 201)
}
