import { useEffect, useRef, useState } from 'react'
import { BOOKINGS } from '../lib/bookings'
import RouteMap from './RouteMap'
import { SAMPLE } from './sample'

// The trip's cities in order, from the stays. Module-level so the map draws once.
const ROUTE = BOOKINGS
  .filter(b => b.kind === 'stay' && b.lat != null)
  .map(b => ({ city: b.city.replace(/, Japan$/, ''), lat: b.lat, lon: b.lon, from: b.start.slice(0, 10) }))
const FIRST = ROUTE[0]?.from

const DATA = SAMPLE
const DAYS = DATA.days.filter(d => d.moments.length).sort((a, b) => a.day.localeCompare(b.day))

const dayNumber = day => Math.round((Date.parse(day) - Date.parse(FIRST)) / 864e5) + 1
const longDate = day => new Date(day + 'T00:00:00Z')
  .toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

// ---- buttons: one look for every action, so links never pass as plain text --------------

const BTN = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-ai/40 bg-raised px-4 text-sm font-medium text-ai transition-colors hover:bg-ai-wash active:bg-ai-wash'
const BTN_SMALL = 'inline-flex min-h-9 items-center gap-1.5 rounded-md border border-ai/40 bg-raised px-3 text-sm font-medium text-ai transition-colors hover:bg-ai-wash active:bg-ai-wash'

const TURN = { right: '', left: 'rotate-180', down: 'rotate-90' }
function Chevron({ dir = 'right', className = '' }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={`size-4 shrink-0 ${TURN[dir]} ${className}`}>
      <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ---- tiny router: real addresses (/journal/2026-10-15), no page reloads ----------------

function usePath() {
  const [path, setPath] = useState(location.pathname)
  useEffect(() => {
    const on = () => setPath(location.pathname)
    addEventListener('popstate', on)
    return () => removeEventListener('popstate', on)
  }, [])
  const go = to => { history.pushState(null, '', to); setPath(to); scrollTo({ top: 0 }) }
  return [path, go]
}

function Link({ to, go, className, children }) {
  return (
    <a href={to} className={className}
       onClick={e => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); go(to) }}>
      {children}
    </a>
  )
}

// ---- photos ------------------------------------------------------------------------

function Photo({ p, fill }) {
  const ref = useRef(null)
  const img = useRef(null)
  const [seen, setSeen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (img.current.complete && img.current.naturalWidth) setLoaded(true)   // cached: onLoad already fired
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } }, { threshold: 0.25 })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className="overflow-hidden bg-rule" style={{ aspectRatio: fill ? '1' : `${p.w} / ${p.h}` }}>
      <img ref={img} src={p.url} alt="" loading="lazy" decoding="async" onLoad={() => setLoaded(true)}
           className={`develop size-full object-cover ${seen && loaded ? 'in' : ''}`} />
    </div>
  )
}

/** First photo large; the rest share one row beneath it. */
function Photos({ photos }) {
  const [first, ...rest] = photos
  const portrait = first.h > first.w
  return (
    <div className="-mx-6 grid gap-1 sm:mx-0">
      <div className={portrait ? 'sm:max-w-md' : ''}><Photo p={first} /></div>
      {rest.length > 0 && (
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${rest.length}, 1fr)` }}>
          {rest.map(p => <Photo key={p.url} p={p} fill />)}
        </div>
      )}
    </div>
  )
}

// ---- comments ----------------------------------------------------------------------

const timeOf = iso => iso.slice(11, 16)

function Comments({ moment }) {
  const [list, setList] = useState(moment.comments)
  const [name, setName] = useState(() => { try { return localStorage.getItem('journal.name') ?? '' } catch { return '' } })
  const [text, setText] = useState('')

  const send = e => {
    e.preventDefault()
    if (!name.trim() || !text.trim()) return
    try { localStorage.setItem('journal.name', name.trim()) } catch {}
    // ponytail: sample only keeps it on screen; POST /api/journal/comments comes with the backend
    setList([...list, { id: crypto.randomUUID(), name: name.trim(), text: text.trim(), at: new Date().toISOString() }])
    setText('')
  }

  const field = 'w-full rounded-md border border-rule bg-raised px-3 py-2.5 placeholder:text-dim focus:border-ai focus:outline-none'
  return (
    <details className="group mt-5">
      <summary className={`${BTN_SMALL} cursor-pointer`}>
        {list.length ? `Bekijk ${list.length} ${list.length === 1 ? 'reactie' : 'reacties'}` : 'Schrijf een reactie'}
        <Chevron dir="down" className="transition-transform duration-200 group-open:-rotate-90 motion-reduce:transition-none" />
      </summary>
      <div className="mt-4 grid gap-5 border-l border-rule pl-4">
        {list.map(c => (
          <div key={c.id}>
            <p className="text-sm"><span className="font-medium">{c.name}</span> <span className="text-dim tabular-nums">{timeOf(c.at)}</span></p>
            <p className="leading-relaxed">{c.text}</p>
          </div>
        ))}
        <form className="grid gap-2" onSubmit={send}>
          <input className={field} value={name} onChange={e => setName(e.target.value)} placeholder="Jouw naam" aria-label="Jouw naam" />
          <textarea className={field} rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="Schrijf iets" aria-label="Reactie" />
          <button className="inline-flex min-h-11 items-center justify-self-start rounded-md bg-ai px-5 text-sm font-medium text-on-ai">Plaats reactie</button>
        </form>
      </div>
    </details>
  )
}

// ---- views -------------------------------------------------------------------------

function Moment({ m }) {
  return (
    <article className="mt-20 first:mt-14">
      <Photos photos={m.photos} />
      <div className="mt-5 max-w-[34rem]">
        <p className="flex gap-3 text-sm text-dim"><span className="tabular-nums">{m.time}</span><span>{m.place.name}</span></p>
        <p className="mt-2 font-mincho text-[1.1875rem] leading-[1.8]">{m.text}</p>
        <Comments moment={m} />
      </div>
    </article>
  )
}

function DayView({ entry, go }) {
  const i = DAYS.indexOf(entry)
  const prev = DAYS[i - 1], next = DAYS[i + 1]
  const newest = DAYS.at(-1).moments.at(-1).id
  return (
    <>
      <RouteMap route={ROUTE} now={DATA.now} focus={entry.moments} newest={newest}
                className="h-[42vh] min-h-64 w-full" />
      <main className="mx-auto max-w-2xl px-6 pb-24">
        <header className="mt-10">
          <p className="text-dim">{longDate(entry.day)}, {entry.city}</p>
          <h1 className="font-mincho text-6xl leading-none font-medium tracking-tight">Dag {dayNumber(entry.day)}</h1>
        </header>

        {entry.moments.map(m => <Moment key={m.id} m={m} />)}

        <nav className="mt-24 grid grid-cols-2 gap-3" aria-label="Andere dagen">
          {prev ? <Link to={`/journal/${prev.day}`} go={go} className={`${BTN} h-auto justify-start py-3 text-left`}>
            <Chevron dir="left" />
            <span className="grid"><span className="font-normal text-dim">Vorige dag</span>
              <span className="font-mincho text-base">Dag {dayNumber(prev.day)}, {prev.city}</span></span></Link> : <span />}
          {next && <Link to={`/journal/${next.day}`} go={go} className={`${BTN} h-auto justify-end py-3 text-right`}>
            <span className="grid"><span className="font-normal text-dim">Volgende dag</span>
              <span className="font-mincho text-base">Dag {dayNumber(next.day)}, {next.city}</span></span>
            <Chevron /></Link>}
        </nav>
      </main>
    </>
  )
}

function RouteView({ go }) {
  const all = DAYS.flatMap(d => d.moments.map(m => ({ ...m, day: d.day })))
  return (
    <>
      <RouteMap route={ROUTE} now={DATA.now} focus={all} newest={all.at(-1)?.id} interactive
                onPin={m => go(`/journal/${m.day}`)} className="h-[62vh] w-full" />
      <main className="mx-auto max-w-2xl px-6 pb-24">
        <h1 className="mt-10 font-mincho text-4xl font-medium">De route</h1>
        <ol className="mt-6 divide-y divide-rule border-y border-rule">
          {DAYS.map(d => (
            <li key={d.day}>
              <Link to={`/journal/${d.day}`} go={go}
                    className="-mx-3 grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 rounded-md px-3 py-4 transition-colors hover:bg-ai-wash active:bg-ai-wash">
                <span className="font-mincho text-lg">Dag {dayNumber(d.day)}</span>
                <span className="grid"><span>{d.city}</span>
                  <span className="text-sm text-dim">{longDate(d.day)}, {d.moments.length} {d.moments.length === 1 ? 'moment' : 'momenten'}</span></span>
                <span className="flex items-center gap-1 text-sm font-medium text-ai">Bekijk dag <Chevron /></span>
              </Link>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-dim">Nog te gaan: {ROUTE.filter(c => c.from > DATA.now).map(c => c.city).join(', ')}.</p>
      </main>
    </>
  )
}

export default function Journal() {
  const [path, go] = usePath()
  const isRoute = path.startsWith('/journal/route')
  const asked = path.match(/\/journal\/(\d{4}-\d{2}-\d{2})/)?.[1]
  const entry = DAYS.find(d => d.day === asked) ?? DAYS.at(-1)

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-[1000] flex items-center justify-between border-b border-rule bg-paper/90 px-6 py-2 text-sm backdrop-blur-md">
        <Link to="/journal" go={go} className="font-mincho text-base">Ons Japan-dagboek</Link>
        {isRoute
          ? <Link to="/journal" go={go} className={BTN_SMALL}><Chevron dir="left" />Naar laatste dag</Link>
          : <Link to="/journal/route" go={go} className={BTN_SMALL}>Bekijk hele route</Link>}
      </div>
      <div className="pt-[3.3rem]">
        {isRoute ? <RouteView go={go} /> : entry
          ? <DayView key="day" entry={entry} go={go} />
          : <p className="px-6 py-20 font-mincho text-xl">Nog niets gedeeld. Kom straks terug.</p>}
      </div>
    </>
  )
}
