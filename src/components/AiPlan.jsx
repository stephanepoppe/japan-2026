import { useState } from 'react'
import { usePlan, stayAddress, directionsUrl } from '../lib/plans'

const link = 'cursor-pointer font-medium text-ai underline-offset-4 hover:underline'

/**
 * One AI suggestion. AI text is set in Mincho and hangs off a dotted indigo rule:
 * the typeface says who wrote it, so nothing needs a badge (Q25a).
 */
export function AiStop({ spot, time, origin, onAdd }) {
  const [added, setAdded] = useState(false)
  return (
    <li className="grid grid-cols-[3.5rem_1fr] gap-x-3">
      <span className="pt-6 text-sm text-dim tabular-nums">{time ?? ''}</span>
      <div className="grid gap-2 border-l border-dotted border-ai/70 py-6 pl-4">
        <div>
          <h3 className="font-mincho text-lg leading-snug font-medium">{spot.title}</h3>
          {spot.area && <p className="text-sm text-dim">{spot.area}</p>}
        </div>
        <p className="font-mincho leading-relaxed">{spot.what}</p>
        {spot.touristy && <p className="text-sm font-medium">It’s touristy, but you have to go there.</p>}
        {spot.transit && <p className="text-sm text-dim">{spot.transit}</p>}
        <div className="flex gap-5 text-sm">
          <a className={link} href={directionsUrl(spot.place, origin)} target="_blank" rel="noreferrer">Route in Maps</a>
          {added
            ? <span className="text-dim">Added to the day</span>
            : <button className={link} onClick={() => { onAdd(); setAdded(true) }}>Add to day</button>}
        </div>
      </div>
    </li>
  )
}

export const AiByline = () => (
  <p className="pl-[calc(4.25rem+1px+1rem)] text-xs text-dim">Suggested by AI. Check opening hours before you go.</p>
)

/** Mount with key={day}; see usePlan. */
export default function AiPlan({ day, weather, auto, onAdd }) {
  const { eligible, plan, busy, error, generate } = usePlan(day, weather, { auto })
  if (!eligible) return null
  const home = stayAddress(day)

  return (
    <section className="grid gap-3" aria-busy={Boolean(busy)}>
      <div>
        <h2 className="font-mincho text-xl font-medium">A plan for the day</h2>
        {plan && <p className="text-sm text-dim">Around {plan.area}</p>}
      </div>

      {busy && (
        <p className="font-mincho text-dim motion-safe:animate-pulse">
          {busy === 'rethink' ? 'Rethinking the areas for this stay…' : 'Planning the day…'}
        </p>
      )}
      {error && <p className="text-sm text-ai">{error}</p>}

      {!plan && !busy && (
        <button className={`${link} justify-self-start py-2`} onClick={() => generate('first')}>Suggest a plan</button>
      )}

      {plan && (
        <div className={busy ? 'opacity-40' : ''}>
          <p className="font-mincho text-lg leading-relaxed">{plan.intro}</p>
          <ol className="mt-2">
            {plan.stops.map((s, i) => (
              <AiStop key={`${s.time}${s.title}`} spot={s} time={s.time}
                      origin={i ? plan.stops[i - 1].place : home}
                      onAdd={() => onAdd({ day, title: s.title, time: s.time || null, location: s.place })} />
            ))}
          </ol>
          <AiByline />
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 pl-[calc(4.25rem+1px+1rem)] text-sm">
            <button className={link} disabled={Boolean(busy)} onClick={() => generate('new')}>New suggestion</button>
            <button className="cursor-pointer text-dim underline-offset-4 hover:underline" disabled={Boolean(busy)}
                    onClick={() => generate('rethink')}>Rethink areas for this stay</button>
          </div>
        </div>
      )}
    </section>
  )
}
