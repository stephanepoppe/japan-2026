import { json, validate } from './index.js'

// PATCH /api/items/:id  -> change title, time, location or notes
// DELETE /api/items/:id
export async function onRequestPatch({ params, request, env }) {
  const id = String(params.id ?? '')
  if (!id) return json({ error: 'missing id' }, 400)

  let body
  try { body = await request.json() } catch { return json({ error: 'bad json' }, 400) }

  const { error, value } = validate(body, { partial: true })
  if (error) return json({ error }, 400)

  const fields = Object.keys(value)
  if (!fields.length) return json({ error: 'nothing to update' }, 400)

  // Column names come from validate()'s own allowlist, never from the request body.
  const set = fields.map(f => `${f} = ?`).join(', ')
  const { meta } = await env.DB
    .prepare(`UPDATE items SET ${set} WHERE id = ?`)
    .bind(...fields.map(f => value[f]), id)
    .run()

  if (!meta?.changes) return json({ error: 'not found' }, 404)

  const row = await env.DB
    .prepare('SELECT id, day, time, title, location, notes, created_by FROM items WHERE id = ?')
    .bind(id).first()
  return json(row)
}

export async function onRequestDelete({ params, env }) {
  const id = String(params.id ?? '')
  if (!id) return json({ error: 'missing id' }, 400)
  await env.DB.prepare('DELETE FROM items WHERE id = ?').bind(id).run()
  return new Response(null, { status: 204 })
}
