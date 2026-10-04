import { bookingLink, mapsLink } from '../lib/bookings'

const ROLE = { start: 'Check in', end: 'Check out', during: 'Staying' }

export function Copy({ label, value }) {
  return (
    <button className="grid cursor-pointer text-left active:text-ai"
            onClick={() => navigator.clipboard?.writeText(value)} title="Tap to copy">
      <span className="text-xs text-dim">{label}</span>
      <span className="font-medium tabular-nums tracking-wide">{value}</span>
    </button>
  )
}

export default function BookingCard({ b }) {
  const manage = bookingLink(b)
  const maps = mapsLink(b)
  const time = b.start && b.start.length > 10 ? b.start.slice(11, 16) : null
  const facts = [
    b.kind === 'stay' && b.role ? ROLE[b.role] : null,
    b.city,
    b.flight_number,
  ].filter(Boolean)

  return (
    <article className="grid grid-cols-[3.5rem_1fr] gap-x-3 py-6">
      <span className="pt-0.5 text-sm text-dim tabular-nums">{time ?? ''}</span>
      <div className="grid min-w-0 gap-3">
        <div>
          <h3 className="text-[1.0625rem] leading-snug font-medium">{b.name}</h3>
          {facts.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-dim">
              {facts.map(f => <span key={f}>{f}</span>)}
            </p>
          )}
          {b.origin && b.destination && (
            <p className="mt-1 text-sm text-dim">{b.origin} to {b.destination}</p>
          )}
        </div>

        {b.address && <p className="text-sm text-dim" lang="ja">{b.address}</p>}

        {(b.confirmation || b.pin || b.cost) && (
          <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
            {b.confirmation && <Copy label="Confirmation" value={b.confirmation} />}
            {b.pin && <Copy label="PIN" value={b.pin} />}
            {b.cost && <span className="text-sm tabular-nums">{b.cost}</span>}
          </div>
        )}

        {b.notes && <p className="text-sm leading-relaxed text-dim">{b.notes}</p>}

        {(maps || manage) && (
          <div className="flex gap-5 text-sm font-medium">
            {maps && <a className="text-ai underline-offset-4 hover:underline" href={maps} target="_blank" rel="noreferrer">Navigate</a>}
            {manage && <a className="text-ai underline-offset-4 hover:underline" href={manage} target="_blank" rel="noreferrer">Open booking</a>}
          </div>
        )}
      </div>
    </article>
  )
}
