import { useEffect, useState } from 'react'
import { today } from '../lib/bookings'
import { stayAddress, surprise, roundPosition } from '../lib/plans'
import { AiStop, AiByline } from './AiPlan'

/** Asked for only on tap, never on load. null if refused or unavailable: the stay city takes over. */
const here = () => new Promise(resolve => {
  if (!navigator.geolocation) return resolve(null)
  navigator.geolocation.getCurrentPosition(
    p => resolve(roundPosition(p.coords)),
    () => resolve(null),
    { timeout: 8000, maximumAge: 5 * 60 * 1000 },
  )
})

const tokyoTime = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })

export default function Surprise({ day, weather, onAdd }) {
  const [online, setOnline] = useState(navigator.onLine)
  const [idea, setIdea] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false)
    addEventListener('online', up); addEventListener('offline', down)
    return () => { removeEventListener('online', up); removeEventListener('offline', down) }
  }, [])

  if (!stayAddress(day)) return null

  const go = async () => {
    setBusy(true); setError(null)
    try {
      // GPS and the clock only mean something for today; other days plan from the stay.
      const live = day === today()
      setIdea(await surprise({
        day, weather,
        time: live ? tokyoTime() : null,
        position: live ? await here() : null,
      }))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="grid gap-3">
      <button onClick={go} disabled={!online || busy}
              className="cursor-pointer rounded-md border border-ai py-3 font-medium text-ai disabled:cursor-default disabled:border-rule disabled:text-dim">
        {busy ? 'Finding something…' : idea ? 'Surprise me again' : 'Surprise me'}
      </button>
      {!online && <p className="text-sm text-dim">Surprise me needs a connection.</p>}
      {error && <p className="text-sm text-ai">{error}</p>}
      {idea && (
        <div className={busy ? 'opacity-40' : ''}>
          <ol>
            <AiStop spot={idea} origin={idea.from === 'here' ? null : stayAddress(day)}
                    onAdd={() => onAdd({ day, title: idea.title, time: null, location: idea.place })} />
          </ol>
          <AiByline />
        </div>
      )}
    </section>
  )
}
