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

function Copy({ label, value, wide }) {
  if (!value) return null
  return (
    <button className={`copy ${wide ? 'wide' : ''}`}
            onClick={() => navigator.clipboard?.writeText(value)} title="Tap to copy">
      <span className="muted small">{label}</span>
      <code>{value}</code>
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
    <section className="card arrival">
      <header>
        <span className="kind">🛂</span>
        <div>
          <h2>{departed ? 'Arriving in Japan' : 'Before you fly'}</h2>
          <p className="muted small">
            {departed
              ? `Lands ${f.arriveTime ? `${f.arriveTime} ` : ''}at Narita`
              : 'Register on Visit Japan Web — these are the values it asks for'}
          </p>
        </div>
      </header>

      <div className="meta">
        <Copy label="Flight into Japan" value={f.inbound} />
        <Copy label="Booking ref" value={f.flight.confirmation} />
        <Copy label="Postcode" value={f.stay.postcode} />
      </div>

      <div className="meta">
        <Copy label="Staying at" value={f.stay.name} wide />
      </div>
      <div className="meta">
        <Copy label="Address (Japanese)" value={f.stay.address_ja} wide />
      </div>
      <div className="meta">
        <Copy label="Address (romanized)" value={f.stay.address} wide />
      </div>

      <p className="muted small">
        Stay: {DAY(f.flight.start)} → {f.lastDay}
        {f.arriveTime && check && ` · lands ${f.arriveTime}, check-in ${check}`}
      </p>

      <p className="muted small">
        VJW also wants a contact number in Japan — use your roaming number, or ask the
        host through Airbnb.
      </p>

      <div className="actions">
        <a className="btn" href={VJW} target="_blank" rel="noreferrer">Visit Japan Web</a>
        <a className="btn ghost" href={KLM_STATUS} target="_blank" rel="noreferrer">
          Flight status
        </a>
      </div>
    </section>
  )
}
