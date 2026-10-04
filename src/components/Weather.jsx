import { describe, whatToWear } from '../lib/weather'

/** The Today strip: conditions plus the one sentence you actually act on. */
export function WeatherStrip({ w }) {
  if (!w) return null
  const { icon, label } = describe(w.code)
  const advice = whatToWear(w)
  return (
    <div className="wstrip">
      <div className="wline">
        <span className="wicon">{icon}</span>
        <span className="wtemp">{Math.round(w.tmin)}–{Math.round(w.tmax)}°</span>
        <span className="muted">{w.city} · {label}</span>
        {w.rain > 0 && <span className="muted">· {w.rain}%</span>}
      </div>
      {advice && <p className="wadvice">{advice}</p>}
    </div>
  )
}

/** One line in the day panel, with the daylight you get. */
export function WeatherLine({ w }) {
  if (!w) return <p className="muted small">No forecast this far ahead.</p>
  const { icon, label } = describe(w.code)
  return (
    <p className="wdetail muted small">
      {icon} {w.city} · {Math.round(w.tmin)}–{Math.round(w.tmax)}° · {label}
      {w.rain > 0 && ` · ${w.rain}% rain`}
      {w.sunrise && ` · ☀ ${w.sunrise}–${w.sunset}`}
    </p>
  )
}

/** The two glyphs that fit in a calendar cell. */
export function WeatherCell({ w }) {
  if (!w) return <span className="wcell" />
  return (
    <span className="wcell">
      <i>{describe(w.code).icon}</i>
      <b>{Math.round(w.tmax)}°</b>
    </span>
  )
}
