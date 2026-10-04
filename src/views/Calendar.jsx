import { useState } from 'react'
import { tripRange, today, dayEntries, staysOn, dayMarks, undated } from '../lib/bookings'
import { useItems } from '../lib/useItems'
import { useWeather } from '../lib/useWeather'
import { WeatherLine, WeatherCell } from '../components/Weather'
import BookingCard from '../components/BookingCard'
import ItemRow from '../components/ItemRow'
import AddItem from '../components/AddItem'
import SyncBanner from '../components/SyncBanner'

const MONTH = '2026-10'
const DAYS_IN = 31
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const iso = d => `${MONTH}-${String(d).padStart(2, '0')}`
const pretty = s => new Date(s + 'T00:00:00Z')
  .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

// Monday-first offset for 1 October 2026.
const FIRST_WEEKDAY = (new Date(`${MONTH}-01T00:00:00Z`).getUTCDay() + 6) % 7

export default function Calendar() {
  const { first, last } = tripRange()
  const now = today()
  const [sel, setSel] = useState(now >= first && now <= last ? now : first)
  const { items, add, update, remove } = useItems()
  const weatherFor = useWeather()

  const marks = dayMarks(items)
  const entries = dayEntries(sel, items)
  const stays = staysOn(sel)
  const loose = undated()

  return (
    <div className="stack">
      <h1 className="monthhead">October 2026</h1>
      <SyncBanner />

      <div className="calgrid" role="grid">
        {WEEKDAYS.map((w, i) => <div key={i} className="gh">{w}</div>)}
        {Array.from({ length: FIRST_WEEKDAY }, (_, i) => <div key={`p${i}`} />)}
        {Array.from({ length: DAYS_IN }, (_, i) => {
          const d = iso(i + 1)
          const inTrip = d >= first && d <= last
          const kinds = marks[d]
          return (
            <button key={d} role="gridcell"
                    className={[
                      'gd',
                      inTrip ? 'in' : 'out',
                      d === sel ? 'sel' : '',
                      d === now ? 'now' : '',
                      staysOn(d).length ? 'staying' : '',
                    ].join(' ')}
                    aria-current={d === sel ? 'date' : undefined}
                    onClick={() => setSel(d)}>
              <span className="n">{i + 1}</span>
              <WeatherCell w={inTrip ? weatherFor(d) : null} />
              <span className="dots">
                {kinds && [...kinds].slice(0, 3).map(k => <i key={k} className={`dot ${k}`} />)}
              </span>
            </button>
          )
        })}
      </div>

      <section className="stack-tight">
        <h2 className="dayname">{pretty(sel)}</h2>
        <WeatherLine w={weatherFor(sel)} />

        {stays.map(({ b, night, nights }) => (
          <div className="stayline" key={b.confirmation ?? b.name}>
            🛏 {b.name} · night {night} of {nights}
          </div>
        ))}

        {entries.map((e, i) =>
          e.type === 'booking'
            ? <BookingCard key={`b${i}`} b={{ ...e.b, role: e.role }} />
            : <ItemRow key={e.item.id} item={e.item} onUpdate={update} onRemove={remove} />
        )}

        {!entries.length && !stays.length && <p className="muted small">Nothing on this day.</p>}

        <AddItem day={sel} onAdd={add} />
      </section>

      {loose.length > 0 && (
        <section>
          <h2 className="group-head">No date on these</h2>
          <div className="stack-tight">
            {loose.map(b => <BookingCard key={b.name} b={b} />)}
          </div>
        </section>
      )}
    </div>
  )
}
