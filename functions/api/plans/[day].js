import {
  ask, fail, json, AREAS, PLAN, stayFor, nightsOf, fixedLines, weatherLine, dayLabel,
} from '../_ai.js'

// GET  /api/plans/:day  -> the saved plan, or 404
// POST /api/plans/:day  -> make one. body: { mode: 'first' | 'new' | 'rethink', weather }
//   first:   only if none exists yet (two phones opening Today at once get the same plan)
//   new:     same area, new stops
//   rethink: redo the areas for the whole stay, then this day; other days of the stay
//            lose their plan so they follow the new split when opened

const DAY = /^\d{4}-\d{2}-\d{2}$/

const loadPlan = (env, day) =>
  env.DB.prepare('SELECT plan FROM plans WHERE day = ?').bind(day).first('plan')

export async function onRequestGet({ params, env }) {
  const day = String(params.day ?? '')
  if (!DAY.test(day)) return json({ error: 'day must be YYYY-MM-DD' }, 400)
  const plan = await loadPlan(env, day)
  return plan ? json(JSON.parse(plan)) : json({ error: 'no plan yet' }, 404)
}

export async function onRequestPost({ params, request, env }) {
  const day = String(params.day ?? '')
  if (!DAY.test(day)) return json({ error: 'day must be YYYY-MM-DD' }, 400)

  let body
  try { body = await request.json() } catch { return json({ error: 'bad json' }, 400) }
  const mode = ['first', 'new', 'rethink'].includes(body.mode) ? body.mode : 'first'

  const stay = stayFor(day)
  if (!stay) return json({ error: 'There is nowhere booked to stay that night, so there is no plan to make.' }, 422)

  const saved = await loadPlan(env, day)
  if (mode === 'first' && saved) return json(JSON.parse(saved))

  try {
    const { results: items = [] } = await env.DB
      .prepare('SELECT day, time, title, location FROM items WHERE day >= ? AND day < ?')
      .bind(stay.from, stay.to).all()

    const areas = await areasFor(env, stay, items, mode === 'rethink')
    const mine = areas.find(a => a.day === day)
    const previous = mode === 'new' && saved ? JSON.parse(saved).stops.map(s => s.title) : []

    const plan = await ask(env, [
      `Plan ${dayLabel(day)} in ${stay.city}.`,
      `They are staying at ${stay.name}, ${stay.address}. The first stop's transit starts from there.`,
      mine ? `This day is for: ${mine.area} (${mine.why}).` : '',
      `Already fixed today:\n${fixedLines(day, items).join('\n') || '- nothing'}`,
      'If their own plans with a location sit in another area, centre the day around those instead and name that area.',
      `Weather: ${weatherLine(body.weather)}.`,
      previous.length ? `Suggest different stops from last time: ${previous.join(', ')}.` : '',
      'Give 2 to 4 stops in time order that fit around what is fixed.',
    ].filter(Boolean).join('\n\n'), PLAN, 'medium')

    const row = { ...plan, day, created_at: new Date().toISOString() }
    // 'first' lets an earlier writer win so both phones see one plan; the others replace on purpose.
    await env.DB.prepare(`INSERT ${mode === 'first' ? 'OR IGNORE' : 'OR REPLACE'} INTO plans (day, stay_key, plan, created_at) VALUES (?, ?, ?, ?)`)
      .bind(day, stay.key, JSON.stringify(row), row.created_at).run()
    if (mode === 'rethink') {
      await env.DB.prepare('DELETE FROM plans WHERE stay_key = ? AND day != ?').bind(stay.key, day).run()
    }
    return json(JSON.parse(await loadPlan(env, day)))
  } catch (e) {
    return fail(e)
  }
}

/** The stay's split into areas: made once, shared, and only redone when asked. */
async function areasFor(env, stay, items, rethink) {
  if (!rethink) {
    const saved = await env.DB.prepare('SELECT areas FROM areas WHERE stay_key = ?').bind(stay.key).first('areas')
    if (saved) return JSON.parse(saved)
  }

  const nights = nightsOf(stay)
  const { days } = await ask(env, [
    `They stay ${nights.length} night${nights.length === 1 ? '' : 's'} in ${stay.city}, at ${stay.name}, ${stay.address}.`,
    'Split the stay into one area per day: a single neighbourhood or a few that sit close together, so no day zigzags across the city.',
    'Spread the best areas over the days instead of front-loading them, and never use an area twice. On an arrival day, keep it near the accommodation or the station.',
    `What is fixed on each day:\n${nights.map(d => `${dayLabel(d)}:\n${fixedLines(d, items).join('\n') || '- nothing'}`).join('\n')}`,
    `Return exactly these days: ${nights.join(', ')}.`,
  ].join('\n\n'), AREAS, 'medium')

  // Two phones making the first split at once: the first one saved is the one both use.
  await env.DB.prepare(`INSERT ${rethink ? 'OR REPLACE' : 'OR IGNORE'} INTO areas (stay_key, areas, created_at) VALUES (?, ?, ?)`)
    .bind(stay.key, JSON.stringify(days), new Date().toISOString()).run()
  return JSON.parse(await env.DB.prepare('SELECT areas FROM areas WHERE stay_key = ?').bind(stay.key).first('areas'))
}
