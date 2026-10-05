import { ask, fail, json, SURPRISE, stayFor, weatherLine, dayLabel } from './_ai.js'

// POST /api/surprise  body: { day, time, lat?, lon?, weather }
// One idea per call. Everything shown in a city is logged so neither phone sees it twice.
// The position is used for this one prompt and never stored.

export async function onRequestPost({ request, env }) {
  let body
  try { body = await request.json() } catch { return json({ error: 'bad json' }, 400) }

  const day = String(body.day ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return json({ error: 'day must be YYYY-MM-DD' }, 400)
  const stay = stayFor(day)
  if (!stay) return json({ error: 'There is nowhere booked to stay that night, so there is no city to suggest from.' }, 422)

  const time = /^\d{2}:\d{2}$/.test(body.time ?? '') ? body.time : null
  // ~100 m is enough to suggest from and no more precise than that (the phone rounds too).
  const near = Number.isFinite(body.lat) && Number.isFinite(body.lon)
    ? `${body.lat.toFixed(3)}, ${body.lon.toFixed(3)}`
    : null

  try {
    const { results: seen = [] } = await env.DB
      .prepare('SELECT title FROM surprises WHERE city = ? ORDER BY id').bind(stay.city).all()

    const idea = await ask(env, [
      `Surprise them with one thing to do, eat or drink on ${dayLabel(day)} in ${stay.city}${time ? `, starting around ${time}` : ''}.`,
      near
        ? `They are standing at roughly ${near} right now. Anything up to about 30 minutes away by train, metro or on foot is fine; "transit" starts from there.`
        : `They are staying at ${stay.name}, ${stay.address}. Anything up to about 30 minutes from there by public transport is fine; "transit" starts from there.`,
      `Weather: ${weatherLine(body.weather)}. Suit the hour and the weather: late evening means music bars and late food, rain means indoors.`,
      seen.length ? `Already suggested, never repeat these: ${seen.map(s => s.title).join('; ')}.` : '',
    ].filter(Boolean).join('\n\n'), SURPRISE, 'low')

    await env.DB.prepare('INSERT INTO surprises (city, title, place, created_at) VALUES (?, ?, ?, ?)')
      .bind(stay.city, String(idea.title).slice(0, 200), String(idea.place).slice(0, 300), new Date().toISOString()).run()

    return json({ ...idea, from: near ? 'here' : 'stay' })
  } catch (e) {
    return fail(e)
  }
}
