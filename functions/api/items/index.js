// GET  /api/items   -> all day items
// POST /api/items   -> add one
// Who added it: the verified sign-in email, set by functions/_middleware.js.
const email = req => req.headers.get('X-Trip-Email') ?? 'unknown'
export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const COLS = 'id, day, time, title, location, notes, created_by'

/** Shared by POST and PATCH so both reject the same things. */
export function validate(body, { partial = false } = {}) {
  const out = {}
  if (body.day !== undefined || !partial) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.day ?? ''))) return { error: 'day must be YYYY-MM-DD' }
    out.day = String(body.day)
  }
  if (body.title !== undefined || !partial) {
    const t = String(body.title ?? '').trim()
    if (!t || t.length > 200) return { error: 'title must be 1-200 chars' }
    out.title = t
  }
  if (body.time !== undefined) {
    const t = body.time === null || body.time === '' ? null : String(body.time).slice(0, 5)
    if (t !== null && !/^\d{2}:\d{2}$/.test(t)) return { error: 'time must be HH:MM' }
    out.time = t
  }
  if (body.location !== undefined) {
    out.location = body.location ? String(body.location).slice(0, 200) : null
  }
  if (body.notes !== undefined) {
    out.notes = body.notes ? String(body.notes).slice(0, 1000) : null
  }
  return { value: out }
}

export async function onRequestGet({ env }) {
  const { results } = await env.DB
    .prepare(`SELECT ${COLS} FROM items ORDER BY day, time IS NULL, time`)
    .all()
  return json(results ?? [])
}

export async function onRequestPost({ request, env }) {
  let body
  try { body = await request.json() } catch { return json({ error: 'bad json' }, 400) }

  const { error, value } = validate(body)
  if (error) return json({ error }, 400)

  const row = {
    id: crypto.randomUUID(),
    day: value.day, time: value.time ?? null, title: value.title,
    location: value.location ?? null, notes: value.notes ?? null,
    created_by: email(request), created_at: new Date().toISOString(),
  }

  await env.DB
    .prepare(`INSERT INTO items (id, day, time, title, location, notes, created_by, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(row.id, row.day, row.time, row.title, row.location, row.notes,
          row.created_by, row.created_at)
    .run()

  return json(row, 201)
}
