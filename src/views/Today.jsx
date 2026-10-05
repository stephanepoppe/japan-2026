import { tripRange, today, dayEntries, staysOn } from '../lib/bookings'
import { useItems } from '../lib/useItems'
import { useWeather } from '../lib/useWeather'
import { WeatherStrip } from '../components/Weather'
import ArrivalCard from '../components/ArrivalCard'
import BookingCard from '../components/BookingCard'
import ItemRow from '../components/ItemRow'
import AddItem from '../components/AddItem'
import SyncBanner from '../components/SyncBanner'
import AiPlan from '../components/AiPlan'
import Surprise from '../components/Surprise'

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
  const weather = weatherFor(day)
  const entries = dayEntries(day, items)
  const stays = staysOn(day)

  const [weekday, ...date] = pretty(day).split(' ')

  return (
    <div className="grid gap-12">
      <SyncBanner />
      <header>
        <p className="font-mincho text-lg text-dim">{weekday}</p>
        <h1 className="font-mincho text-5xl leading-[1.1] font-medium tracking-tight">{date.join(' ')}</h1>
        {until > 0 && <p className="mt-3 text-ai">{until} day{until === 1 ? '' : 's'} to go</p>}
        {now > last && <p className="mt-3 text-sm text-dim">The trip is over. This is the last day.</p>}
      </header>

      <ArrivalCard today={now} />

      <WeatherStrip w={weather} />

      <section className="grid gap-2">
        <h2 className="font-mincho text-xl font-medium">The day</h2>
        {stays.map(({ b, night, nights }) => (
          <p className="text-sm text-dim" key={b.confirmation ?? b.name}>
            Night {night} of {nights} at {b.name}
          </p>
        ))}

        <div className="mt-4 divide-y divide-rule border-y border-rule">
          {entries.map((e, i) =>
            e.type === 'booking'
              ? <BookingCard key={`b${i}`} b={{ ...e.b, role: e.role }} />
              : <ItemRow key={e.item.id} item={e.item} onUpdate={update} onRemove={remove} />
          )}
          {!entries.length && !stays.length && <p className="py-6 text-dim">Nothing booked for this day yet.</p>}
          <AddItem day={day} onAdd={add} />
        </div>
      </section>

      <AiPlan key={day} day={day} weather={weather} auto onAdd={add} />
      <Surprise key={`s${day}`} day={day} weather={weather} onAdd={add} />
    </div>
  )
}
