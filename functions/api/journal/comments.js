import { json } from '../items/index.js'

// POST /api/journal/comments {moment_id, name, text} -> the saved comment. Owners and readers.
export async function onRequestPost({ request, env }) {
  let body
  try { body = await request.json() } catch { return json({ error: 'bad json' }, 400) }
  const name = String(body.name ?? '').trim(), text = String(body.text ?? '').trim()
  if (!name || name.length > 60) return json({ error: 'name must be 1-60 chars' }, 400)
  if (!text || text.length > 1000) return json({ error: 'text must be 1-1000 chars' }, 400)
  const moment = String(body.moment_id ?? '')
  if (!await env.DB.prepare('SELECT 1 FROM moments WHERE id = ?').bind(moment).first()) return json({ error: 'no such moment' }, 404)

  const row = { id: crypto.randomUUID(), name, text, at: new Date().toISOString() }
  await env.DB.prepare('INSERT INTO comments (id, moment_id, name, text, at) VALUES (?, ?, ?, ?, ?)')
    .bind(row.id, moment, row.name, row.text, row.at).run()
  return json(row, 201)
}
