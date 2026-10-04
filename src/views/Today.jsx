import { tripRange, today, dayEntries, staysOn } from '../lib/bookings'
import { useItems } from '../lib/useItems'
import { useWeather } from '../lib/useWeather'
import { WeatherStrip } from '../components/Weather'
import ArrivalCard from '../components/ArrivalCard'
import BookingCard from '../components/BookingCard'
import ItemRow from '../components/ItemRow'
import AddItem from '../components/AddItem'
import SyncBanner from '../components/SyncBanner'

const pretty = iso => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB',
  { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

const daysUntil = iso =>
  Math.ceil((new Date(iso + 'T00:00:00Z') - new Date(today() + 'T00:00:00Z')) / 864e5)

export default function Today() {
  const { first, last } = tripRange()
  const now = today()
  // Before departure show day one; after the trip, the last day.
  const day = now < first ? first : now > last ? last : now
  const until = daysUntil(first)

  const { items, add, update, remove } = useItems()
  const weatherFor = useWeather()
  const entries = dayEntries(day, items)
  const stays = staysOn(day)

  return (
    <div className="stack">
      <SyncBanner />
      <header className="dayhead">
        <h1>{pretty(day)}</h1>
        {until > 0 && <p className="countdown">{until} day{until === 1 ? '' : 's'} to go</p>}
        {now > last && <p className="muted small">Trip finished — showing the last day.</p>}
      </header>

      <ArrivalCard today={now} />

      <WeatherStrip w={weatherFor(day)} />

      <div className="stack-tight">
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

        {!entries.length && !stays.length && <p className="muted">Nothing booked for this day.</p>}

        <AddItem day={day} onAdd={add} />
      </div>
    </div>
  )
}
