import { BOOKINGS } from '../lib/bookings'

const VJW = 'https://www.vjw.digital.go.jp/'
const KLM_STATUS = 'https://www.klm.com/travel/flight-status'

const DAY = s => (s ?? '').slice(0, 10)

/** Outbound flight and the first place you sleep — the two things Japan asks about. */
function arrivalFacts() {
  const stays = BOOKINGS.filter(b => b.kind === 'stay' && DAY(b.start))
    .sort((a, b) => a.start.localeCompare(b.start))
  const flight = BOOKINGS.find(b => b.kind === 'flight')
  if (!flight || !stays.length) return null

  // "Arrives 2026-10-07 10:25" sits in the notes blob; pull it rather than guess.
  // \w* matched only one word; KLM writes 'arrives Tokyo Narita 2026-10-07 10:25'.
  const arr = (flight.notes ?? '').match(/arrives\s+(?:[\w.\-]+\s+){0,4}(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/i)
  return {
    flight,
    stay: stays[0],
    // The flight number that lands in Japan — VJW wants that one, not the return.
    inbound: (flight.flight_number ?? '').split('/')[0].trim(),
    arriveDay: arr?.[1] ?? DAY(stays[0].start),
    arriveTime: arr?.[2] ?? null,
    lastDay: DAY(flight.end) || DAY(stays[stays.length - 1].end),
  }
}

function Copy({ label, value }) {
  if (!value) return null
  return (
    <button className="grid w-full cursor-pointer grid-cols-[7.5rem_1fr] gap-x-4 py-3 text-left active:text-ai"
            onClick={() => navigator.clipboard?.writeText(value)} title="Tap to copy">
      <span className="text-sm text-dim">{label}</span>
      <span className="font-medium break-words">{value}</span>
    </button>
  )
}

/**
 * Pinned above Today until you've landed. Before departure it's a Visit Japan Web
 * checklist; from the 6th it's the reference you need at Narita with no signal.
 * Returns null once you're in the country — a card still shouting ARRIVAL on the
 * 15th is noise, and noise is how an app stops getting opened.
 */
export default function ArrivalCard({ today }) {
  const f = arrivalFacts()
  if (!f || today > f.arriveDay) return null

  const departed = today >= DAY(f.flight.start)
  const check = (f.stay.notes ?? '').match(/check[- ]?in[:\s]*(\d{1,2}:\d{2})/i)?.[1]

  return (
    <section className="-mx-6 grid gap-5 bg-ai-wash px-6 py-8 sm:mx-0 sm:rounded-lg">
      <div>
        <h2 className="font-mincho text-2xl font-medium">{departed ? 'Arriving in Japan' : 'Before you fly'}</h2>
        <p className="mt-1 text-dim">
          {departed
            ? `Lands ${f.arriveTime ? `${f.arriveTime} ` : ''}at Narita`
            : 'Register on Visit Japan Web. Tap a line to copy what it asks for.'}
        </p>
      </div>

      <div className="divide-y divide-ai/15 border-y border-ai/15">
        <Copy label="Flight into Japan" value={f.inbound} />
        <Copy label="Booking ref" value={f.flight.confirmation} />
        <Copy label="Staying at" value={f.stay.name} />
        <Copy label="Postcode" value={f.stay.postcode} />
        <Copy label="Address" value={f.stay.address_ja} />
        <Copy label="Romanized" value={f.stay.address} />
      </div>

      <p className="text-sm leading-relaxed text-dim">
        In Japan from {DAY(f.flight.start)} to {f.lastDay}.
        {f.arriveTime && check && ` Lands ${f.arriveTime}, check-in from ${check}.`}
        {' '}VJW also wants a contact number in Japan: use your roaming number, or ask the
        host through Airbnb.
      </p>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <a className="rounded-md bg-ai px-5 py-3 font-medium text-on-ai" href={VJW} target="_blank" rel="noreferrer">
          Open Visit Japan Web
        </a>
        <a className="font-medium text-ai underline-offset-4 hover:underline" href={KLM_STATUS} target="_blank" rel="noreferrer">
          Flight status
        </a>
      </div>
    </section>
  )
}
