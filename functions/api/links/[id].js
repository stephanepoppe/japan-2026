import { json } from '../items/index.js'

// DELETE /api/links/:id
export async function onRequestDelete({ params, env }) {
  const id = String(params.id ?? '')
  if (!id) return json({ error: 'missing id' }, 400)
  await env.DB.prepare('DELETE FROM links WHERE id = ?').bind(id).run()
  return new Response(null, { status: 204 })
}
