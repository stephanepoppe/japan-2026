import { bookingLink, mapsLink } from '../lib/bookings'

const ICON = { flight: '✈', stay: '🛏', transport: '🚄', activity: '◎' }
const ROLE = { start: 'Check in', end: 'Check out', during: 'Staying' }

function Copy({ label, value }) {
  return (
    <button className="copy" onClick={() => navigator.clipboard?.writeText(value)} title="Tap to copy">
      <span className="muted small">{label}</span>
      <code>{value}</code>
    </button>
  )
}

export default function BookingCard({ b }) {
  const manage = bookingLink(b)
  const maps = mapsLink(b)
  const time = b.start && b.start.length > 10 ? b.start.slice(11, 16) : null

  return (
    <article className="card booking">
      <header>
        <span className="kind">{ICON[b.kind] ?? '•'}</span>
        <div>
          <h3>{b.name}</h3>
          <p className="muted small">
            {b.kind === 'stay' && b.role ? ROLE[b.role] : null}
            {time ? ` · ${time}` : ''}
            {b.city ? ` · ${b.city}` : ''}
            {b.origin && b.destination ? ` ${b.origin} → ${b.destination}` : ''}
            {b.flight_number ? ` · ${b.flight_number}` : ''}
          </p>
        </div>
      </header>

      {b.address && <p className="addr" lang="ja">{b.address}</p>}

      <div className="meta">
        {b.confirmation && <Copy label="Confirmation" value={b.confirmation} />}
        {b.pin && <Copy label="PIN" value={b.pin} />}
        {b.cost && <span className="pill">{b.cost}</span>}
      </div>

      {b.notes && <p className="notes muted small">{b.notes}</p>}

      <div className="actions">
        {maps && <a className="btn" href={maps} target="_blank" rel="noreferrer">Navigate</a>}
        {manage && <a className="btn ghost" href={manage} target="_blank" rel="noreferrer">Booking</a>}
      </div>
    </article>
  )
}
