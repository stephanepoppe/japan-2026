import { useEffect, useMemo, useRef, useState } from 'react'
import { BOOKINGS } from '../lib/bookings'
import RouteMap from './RouteMap'
import PhotoSwipeLightbox from 'photoswipe/lightbox'
import 'photoswipe/style.css'

// The trip's cities in order, from the stays. Module-level so the map draws once.
const ROUTE = BOOKINGS
  .filter(b => b.kind === 'stay' && b.lat != null && b.start)
  .map(b => ({ city: b.city.replace(/, Japan$/, ''), lat: b.lat, lon: b.lon, from: b.start.slice(0, 10) }))
const FIRST = ROUTE[0]?.from


/** Now in Japan, where the moments happen: { day: 'YYYY-MM-DD', time: 'HH:MM' }. */
const tokyo = () => { const s = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' }); return { day: s.slice(0, 10), time: s.slice(11, 16) } }
const NOW = tokyo().day

/** The city we slept in that day: the last stay that had started by then. */
const cityOn = day => ROUTE.filter(c => c.from <= day).at(-1)?.city ?? ROUTE[0]?.city ?? ''

/** API moments (sorted by day, time) -> [{ day, city, moments }]. */
function byDay(moments) {
  const days = []
  for (const m of moments) {
    if (days.at(-1)?.day !== m.day) days.push({ day: m.day, city: cityOn(m.day), moments: [] })
    days.at(-1).moments.push(m)
  }
  return days
}
const pinned = ms => ms.filter(m => m.place.lat != null)

async function api(path, init) {
  const r = await fetch(path, init)
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? `Fout ${r.status}`)
  return r.status === 204 ? null : r.json()
}

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
      {/* PhotoSwipe reads these; without JS the link still opens the photo. */}
      <a href={p.url} data-pswp-width={p.w} data-pswp-height={p.h} data-cropped="true"
         aria-label="Foto groot bekijken" className="block size-full cursor-zoom-in">
        <img ref={img} src={p.url} alt="" loading="lazy" decoding="async" draggable="false" onLoad={() => setLoaded(true)}
             className={`develop size-full object-cover ${seen && loaded ? 'in' : ''}`} />
      </a>
    </div>
  )
}

/** Tap a photo: a swipeable gallery of that moment's photos, zooming out of the cropped thumbnail. */
function useGallery(ref, any) {
  useEffect(() => {
    if (!ref.current) return
    const lb = new PhotoSwipeLightbox({ gallery: ref.current, children: 'a', pswpModule: () => import('photoswipe'),
      bgOpacity: 0.92, tapAction: 'close' })
    // The phone's back button closes the gallery instead of leaving the day: a history entry
    // of our own while it's open (same address, so the journal's router doesn't notice).
    lb.on('beforeOpen', () => history.pushState({ pswp: true }, ''))
    lb.on('close', () => { if (history.state?.pswp) history.back() })
    const onPop = () => lb.pswp?.close()
    addEventListener('popstate', onPop)
    lb.init()
    return () => { removeEventListener('popstate', onPop); lb.destroy() }
  }, [ref, any])   // set up again once a moment gets its first photo
}

/** First photo large; the rest share one row beneath it. */
function Photos({ photos }) {
  const ref = useRef(null)
  useGallery(ref, photos.length > 0)
  if (!photos.length) return null
  const [first, ...rest] = photos
  const portrait = first.h > first.w
  return (
    <div ref={ref} className="photos -mx-6 grid gap-1 sm:mx-0">
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

const whenOf = iso => new Date(iso).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function Comments({ moment }) {
  const [list, setList] = useState(moment.comments)
  const [name, setName] = useState(() => { try { return localStorage.getItem('journal.name') ?? '' } catch { return '' } })
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const send = async e => {
    e.preventDefault()
    if (!name.trim() || !text.trim() || busy) return
    try { localStorage.setItem('journal.name', name.trim()) } catch {}
    setBusy(true); setError('')
    try {
      const c = await api('/api/journal/comments', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ moment_id: moment.id, name: name.trim(), text: text.trim() }) })
      setList([...list, c]); setText('')
    } catch (err) { setError(`Je reactie is niet geplaatst: ${err.message}`) }
    setBusy(false)
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
            <p className="text-sm"><span className="font-medium">{c.name}</span> <span className="text-dim tabular-nums">{whenOf(c.at)}</span></p>
            <p className="leading-relaxed">{c.text}</p>
          </div>
        ))}
        <form className="grid gap-2" onSubmit={send}>
          <input className={field} value={name} onChange={e => setName(e.target.value)} placeholder="Jouw naam" aria-label="Jouw naam" />
          <textarea className={field} rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="Schrijf iets" aria-label="Reactie" />
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button disabled={busy} className="inline-flex min-h-11 items-center justify-self-start rounded-md bg-ai px-5 text-sm font-medium text-on-ai disabled:opacity-60">{busy ? 'Bezig…' : 'Plaats reactie'}</button>
        </form>
      </div>
    </details>
  )
}

// ---- views -------------------------------------------------------------------------

/** Two taps to delete, no dialog: the first tap only arms the button. */
function DeleteMoment({ id, reload }) {
  const [armed, setArmed] = useState(false)
  const [error, setError] = useState('')
  const del = async () => {
    if (!armed) return setArmed(true)
    try { await api(`/api/journal/moments/${id}`, { method: 'DELETE' }); reload() }
    catch (err) { setError(err.message); setArmed(false) }
  }
  return (
    <span className="flex items-center gap-2">
      {error && <span role="alert" className="text-red-700">{error}</span>}
      <button type="button" onClick={del} onBlur={() => setArmed(false)}
              className={armed ? 'font-medium text-red-700' : 'text-dim underline'}>
        {armed ? 'Tik nogmaals om te verwijderen' : 'Verwijder'}
      </button>
    </span>
  )
}

function Moment({ m, owner, reload, go }) {
  return (
    <article className="mt-20 first:mt-14">
      <Photos photos={m.photos} />
      <div className="mt-5 max-w-[34rem]">
        <p className="flex flex-wrap gap-3 text-sm text-dim"><span className="tabular-nums">{m.time}</span><span>{m.place.name}</span>
          {owner && <><Link to={`/journal/edit/${m.id}`} go={go} className="ml-auto text-dim underline">Bewerk</Link>
            <DeleteMoment id={m.id} reload={reload} /></>}</p>
        {m.text && <p className="mt-2 font-mincho text-[1.1875rem] leading-[1.8] whitespace-pre-line">{m.text}</p>}
        <Comments moment={m} />
      </div>
    </article>
  )
}

function DayView({ entry, days, go, owner, reload }) {
  const i = days.indexOf(entry)
  const prev = days[i - 1], next = days[i + 1]
  const newest = pinned(days.flatMap(d => d.moments)).at(-1)?.id
  return (
    <>
      <RouteMap route={ROUTE} now={NOW} focus={pinned(entry.moments)} newest={newest}
                className="h-[42vh] min-h-64 w-full" />
      <main className="mx-auto max-w-2xl px-6 pb-24">
        <header className="mt-10">
          <p className="text-dim">{longDate(entry.day)}, {entry.city}</p>
          <h1 className="font-mincho text-6xl leading-none font-medium tracking-tight">Dag {dayNumber(entry.day)}</h1>
        </header>

        {entry.moments.map(m => <Moment key={m.id} m={m} owner={owner} reload={reload} go={go} />)}

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

function RouteView({ days, go }) {
  const all = pinned(days.flatMap(d => d.moments))
  return (
    <>
      <RouteMap route={ROUTE} now={NOW} focus={all} newest={all.at(-1)?.id} interactive
                onPin={m => go(`/journal/${m.day}`)} className="h-[62vh] w-full" />
      <main className="mx-auto max-w-2xl px-6 pb-24">
        <h1 className="mt-10 font-mincho text-4xl font-medium">De route</h1>
        <ol className="mt-6 divide-y divide-rule border-y border-rule">
          {days.map(d => (
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
        <p className="mt-6 text-sm text-dim">Nog te gaan: {ROUTE.filter(c => c.from > NOW).map(c => c.city).join(', ') || 'niets, we zijn thuis'}.</p>
      </main>
    </>
  )
}

// ---- posting a moment (owners) -----------------------------------------------------

/** Phone photo -> JPEG of at most 2048 px. Redrawing on a canvas also drops EXIF, GPS included. */
async function shrink(file, max = 2048) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const f = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * f), h = Math.round(bmp.height * f)
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h })
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const blob = await new Promise(ok => canvas.toBlob(ok, 'image/jpeg', 0.85))
  return { blob, w, h }
}

/** New moment, or editing one (`moment`): its photos stay unless removed, new ones are added. */
function MomentForm({ moment, posted, go }) {
  const start = moment ?? tokyo()
  const [day, setDay] = useState(start.day)
  const [time, setTime] = useState(start.time)
  const [text, setText] = useState(moment?.text ?? '')
  const [kept, setKept] = useState(moment?.photos ?? [])
  const [files, setFiles] = useState([])
  const [place, setPlace] = useState(moment?.place.name ?? '')
  const [pos, setPos] = useState(!moment ? { state: 'zoeken' }
    : moment.place.lat != null ? { state: 'bewaard', lat: moment.place.lat, lon: moment.place.lon } : { state: 'uit' })
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  // Where we are now is the pin; a moment posted later can drop it.
  // ponytail: no reverse geocoding or reading GPS from the photo; the place name is typed.
  useEffect(() => {
    if (moment) return                     // editing keeps the pin where it was
    if (!navigator.geolocation) return setPos({ state: 'geen' })
    navigator.geolocation.getCurrentPosition(
      p => setPos({ state: 'ok', lat: +p.coords.latitude.toFixed(5), lon: +p.coords.longitude.toFixed(5) }),
      () => setPos({ state: 'geen' }), { enableHighAccuracy: true, timeout: 15000 })
  }, [])

  // Once per photo pick, not per render: a new URL per keystroke re-decodes every full-size photo.
  const previews = useMemo(() => files.map(f => URL.createObjectURL(f)), [files])
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews])

  const submit = async e => {
    e.preventDefault()
    if (status) return
    if (!text.trim() && !files.length && !kept.length) return setError('Voeg een foto of wat tekst toe.')
    setError('')
    try {
      const photos = kept.map(({ key, w, h }) => ({ key, w, h }))
      for (const [i, file] of files.entries()) {
        setStatus(`Foto ${i + 1} van ${files.length} uploaden…`)
        const { blob, w, h } = await shrink(file)
        const { key } = await api('/api/journal/photos', { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: blob })
        photos.push({ key, w, h })
      }
      setStatus(moment ? 'Opslaan…' : 'Moment plaatsen…')
      const keep = pos.state === 'ok' || pos.state === 'bewaard'
      await api(moment ? `/api/journal/moments/${moment.id}` : '/api/journal/moments', { method: moment ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ day, time, text, photos,
          place: { name: place, lat: keep ? pos.lat : null, lon: keep ? pos.lon : null } }) })
      await posted(day)
    } catch (err) {
      setError(`${moment ? 'Niet opgeslagen' : 'Niet geplaatst'}: ${err.message}. Je tekst en foto's staan er nog, probeer opnieuw.`)
      setStatus('')
    }
  }

  const field = 'w-full rounded-md border border-rule bg-raised px-3 py-2.5 placeholder:text-dim focus:border-ai focus:outline-none'
  const label = 'grid gap-1.5 text-sm font-medium'
  return (
    <main className="mx-auto max-w-2xl px-6 pb-24">
      <h1 className="mt-10 font-mincho text-4xl font-medium">{moment ? 'Moment bewerken' : 'Nieuw moment'}</h1>
      <form className="mt-8 grid gap-6" onSubmit={submit}>
        <label className={label}>Foto's
          <input type="file" accept="image/*" multiple className={field}
                 onChange={e => { setFiles([...files, ...e.target.files].slice(0, 12 - kept.length)); e.target.value = '' }} />
        </label>
        {kept.length + files.length > 0 && (
          <ul className="grid grid-cols-4 gap-1" aria-label="Gekozen foto's">
            {kept.map((p, i) => (
              <li key={p.key} className="relative">
                <img src={p.url} alt="" className="aspect-square w-full object-cover" />
                <button type="button" onClick={() => setKept(kept.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 rounded-md bg-paper/90 px-2 py-1 text-xs font-medium" aria-label={`Foto ${i + 1} weghalen`}>✕</button>
              </li>
            ))}
            {previews.map((src, i) => (
              <li key={src} className="relative">
                <img src={src} alt="" className="aspect-square w-full object-cover" />
                <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 rounded-md bg-paper/90 px-2 py-1 text-xs font-medium" aria-label={`Foto ${kept.length + i + 1} weghalen`}>✕</button>
              </li>
            ))}
          </ul>
        )}
        <label className={label}>Wat gebeurde er?
          <textarea className={`${field} font-mincho text-lg leading-relaxed`} rows={5} value={text} onChange={e => setText(e.target.value)} maxLength={2000} />
        </label>
        <label className={label}>Waar?
          <input className={field} value={place} onChange={e => setPlace(e.target.value)} placeholder="Bv. Rokuyosha, Kyoto" maxLength={200} />
          <span className="font-normal text-dim">
            {pos.state === 'zoeken' && 'Locatie zoeken voor de pin op de kaart…'}
            {pos.state === 'ok' && <>Pin op je huidige locatie. <button type="button" className="text-ai underline" onClick={() => setPos({ state: 'uit' })}>Geen pin</button></>}
            {pos.state === 'bewaard' && <>De pin blijft waar hij stond. <button type="button" className="text-ai underline" onClick={() => setPos({ state: 'uit' })}>Geen pin</button></>}
            {pos.state === 'uit' && 'Geen pin op de kaart.'}
            {pos.state === 'geen' && 'Geen locatie gevonden, dus geen pin op de kaart.'}
          </span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>Dag<input type="date" className={field} value={day} onChange={e => setDay(e.target.value)} required /></label>
          <label className={label}>Uur (Japan)<input type="time" className={field} value={time} onChange={e => setTime(e.target.value)} required /></label>
        </div>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <div className="grid gap-3">
          <button disabled={!!status} className="inline-flex min-h-12 items-center justify-center rounded-md bg-ai px-5 font-medium text-on-ai disabled:opacity-60">
            {status || (moment ? 'Opslaan' : 'Deel moment')}
          </button>
          {moment && <Link to={`/journal/${moment.day}`} go={go} className={BTN}>Annuleer</Link>}
        </div>
      </form>
    </main>
  )
}

export default function Journal() {
  const [path, go] = usePath()
  const [data, setData] = useState(null)
  const load = () => api('/api/journal').then(setData, () => setData({ error: true }))
  useEffect(() => { load() }, [])

  const days = byDay(data?.moments ?? [])
  const isRoute = path.startsWith('/journal/route')
  const isNew = path.startsWith('/journal/new') && data?.owner
  const editing = data?.owner && data.moments.find(m => path === `/journal/edit/${m.id}`)
  const asked = path.match(/\/journal\/(\d{4}-\d{2}-\d{2})/)?.[1]
  const entry = days.find(d => d.day === asked) ?? days.at(-1)
  const posted = day => load().then(() => go(`/journal/${day}`))

  let view
  if (!data) view = <p className="px-6 py-20 text-dim">Laden…</p>
  else if (data.error) view = <p className="px-6 py-20 font-mincho text-xl">Het dagboek kon niet laden. Probeer het straks opnieuw.</p>
  else if (isNew) view = <MomentForm posted={posted} />
  else if (editing) view = <MomentForm key={editing.id} moment={editing} posted={posted} go={go} />
  else if (isRoute) view = <RouteView days={days} go={go} />
  else if (entry) view = <DayView key="day" entry={entry} days={days} go={go} owner={data.owner} reload={load} />
  else view = <p className="px-6 py-20 font-mincho text-xl">Nog niets gedeeld. Kom straks terug.</p>

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-[1000] flex items-center justify-between border-b border-rule bg-paper/90 px-6 py-2 text-sm backdrop-blur-md">
        <Link to="/journal" go={go} className="font-mincho text-base">Japan Steps</Link>
        <span className="flex gap-2">
          {data?.owner && !isNew && !editing && <Link to="/journal/new" go={go} className={BTN_SMALL}>+ Moment</Link>}
          {isRoute || isNew || editing
            ? <Link to="/journal" go={go} className={BTN_SMALL}><Chevron dir="left" />Naar laatste dag</Link>
            : <Link to="/journal/route" go={go} className={BTN_SMALL}>Hele route</Link>}
        </span>
      </div>
      <div className="pt-[3.3rem]">{view}</div>
    </>
  )
}
