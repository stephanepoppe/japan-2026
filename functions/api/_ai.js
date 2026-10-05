// Shared by /api/plans and /api/surprise. No onRequest exports, so Pages makes no route of it.
import Anthropic from '@anthropic-ai/sdk'
import { staysOn, dayEntries } from '../../src/lib/bookings.js'

const MODEL = 'claude-sonnet-5-5'

export class AiError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** Turns any failure into a response the app can show as-is. */
export const fail = e => e instanceof AiError
  ? json({ error: e.message }, e.status)
  : json({ error: 'The AI could not be reached. Try again in a minute.' }, 502)

const SYSTEM = `You are a sharp, well-travelled local friend helping two people on a trip through Japan in October 2026.

Who they are: they love food, music, good coffee, vinyl and record shops, design, clothes and fashion, and half-day hikes. Packed days are fine. They eat mostly casual (ramen, izakaya, kissaten, standing bars), with the occasional exceptional splurge.

How you recommend:
- Real, specific places only: a named shop, café, trail, temple, bar or street. If you are not confident a place exists and is still open, leave it out.
- Prefer places locals love over tourist circuits. A famous, crowded sight is allowed only when it is genuinely unmissable; mark it touristy: true. Everything else is touristy: false.
- Respect what is already booked: never overlap a booked time, and leave room for check-in and train times.
- "title" is the place's exact name. "place" is a Google Maps search query starting with that same name, plus neighbourhood and city, so it resolves to the right spot.
- "transit" is one short line, at most 12 words, on how to get there from the previous point by public transport: the main line, from → to, and total minutes. E.g. "Ginza line, Asakusa → Ueno-hirokoji, 6 min", "Oedo + Odakyu lines to Shimo-kitazawa, 40 min" or "Walk, 10 min".
- The intro only mentions what is in the stops.
- "what" is one plain sentence on why it suits them. No hype words.
- Write in English.`

/** One structured call. Throws AiError with a message fit for the screen. */
export async function ask(env, prompt, schema, effort) {
  if (!env.ANTHROPIC_API_KEY) {
    throw new AiError(503, 'AI suggestions are not set up yet: add the ANTHROPIC_API_KEY secret in Cloudflare Pages.')
  }
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  const r = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort, format: { type: 'json_schema', schema } },
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  })
  if (r.stop_reason === 'refusal') throw new AiError(502, 'The AI declined this request. Try again.')
  if (r.stop_reason === 'max_tokens') throw new AiError(502, 'The AI answer was cut off. Try again.')
  const text = r.content.find(b => b.type === 'text')?.text
  try { return JSON.parse(text) } catch { throw new AiError(502, 'The AI answer was garbled. Try again.') }
}

// ---- schemas -----------------------------------------------------------------------

const str = description => ({ type: 'string', description })
const obj = (properties) => ({
  type: 'object', additionalProperties: false, required: Object.keys(properties), properties,
})

const SPOT = {
  title: str('Name of the place'),
  place: str('Google Maps search query: name, neighbourhood, city'),
  what: str('One sentence on why it suits them'),
  touristy: { type: 'boolean' },
  transit: str('How to get there from the previous point by public transport'),
}

export const AREAS = obj({
  days: { type: 'array', items: obj({ day: str('YYYY-MM-DD'), area: str('Area name'), why: str('One short sentence') }) },
})

export const PLAN = obj({
  area: str('The area this day is centred on'),
  intro: str('One or two sentences on the shape of the day'),
  stops: { type: 'array', items: obj({ time: str('HH:MM, 24h'), ...SPOT }) },
})

export const SURPRISE = obj({ ...SPOT, area: str('Neighbourhood it is in') })

// ---- trip context ------------------------------------------------------------------

/** The stay a day belongs to. Days without one (in the air, between stays) get no AI plan. */
export function stayFor(day) {
  const s = staysOn(day)[0]
  if (!s) return null
  const b = s.b
  return {
    key: b.confirmation ?? `${b.name}|${b.start}`,
    city: (b.city ?? '').replace(/, Japan$/, ''),
    name: b.name,
    address: b.address_ja || b.address || b.name,
    from: b.start.slice(0, 10),
    to: b.end.slice(0, 10),
  }
}

/** Every night of a stay, as YYYY-MM-DD. */
export function nightsOf(stay) {
  const out = []
  for (const d = new Date(stay.from + 'T00:00:00Z'); d.toISOString().slice(0, 10) < stay.to; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

const weekday = day => new Date(day + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })

/** What's fixed on a day, as prompt lines: bookings plus their own items. */
export function fixedLines(day, items) {
  return dayEntries(day, items).map(e => {
    if (e.type === 'item') {
      const i = e.item
      return `- ${i.time ?? 'any time'}: ${i.title}${i.location ? ` (at ${i.location})` : ''} [their own plan]`
    }
    const b = e.b
    const what = b.kind === 'stay' ? `${e.role === 'end' ? 'Check out of' : 'Check in to'} ${b.name}` : b.name
    return `- ${e.at ?? 'any time'}: ${what}`
  })
}

/** Weather comes from the phone (it already has the forecast); keep only plain numbers. */
export function weatherLine(w) {
  if (!w || typeof w !== 'object') return 'No forecast yet.'
  const n = v => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null)
  const label = String(w.label ?? '').slice(0, 40)
  return `${n(w.tmin)}–${n(w.tmax)}°C, ${label || 'unknown sky'}, ${n(w.rain) ?? 0}% chance of rain`
    + (w.sunrise && w.sunset ? `, daylight ${String(w.sunrise).slice(0, 5)}–${String(w.sunset).slice(0, 5)}` : '')
}

export const dayLabel = day => `${weekday(day)} ${day}`
