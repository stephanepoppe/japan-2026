import { useEffect, useState } from 'react'
import { cachedRate, refreshRate } from '../lib/fx'

const QUICK = [500, 1000, 2000, 5000, 10000]
const fmt = (n, d = 2) => n.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d })

export default function Calculator() {
  const [{ rate, at, stale }, setFx] = useState(cachedRate)
  const [yen, setYen] = useState('1000')

  useEffect(() => { refreshRate().then(setFx).catch(() => {}) }, [])

  // Single source of truth: yen. Typing euros converts back, so both fields stay live.
  const eur = yen === '' ? '' : Number(yen) / rate
  const setEur = v => setYen(v === '' ? '' : String(Math.round(Number(v) * rate)))

  return (
    <div className="stack">
      <div className="card calc">
        <label className="field">
          <span className="unit">¥</span>
          <input type="number" inputMode="decimal" value={yen}
                 onChange={e => setYen(e.target.value)} placeholder="0" aria-label="Japanese yen" />
        </label>
        <div className="calc-eq">=</div>
        <label className="field">
          <span className="unit">€</span>
          <input type="number" inputMode="decimal" step="0.01"
                 value={eur === '' ? '' : Number(eur).toFixed(2)}
                 onChange={e => setEur(e.target.value)} placeholder="0.00" aria-label="Euro" />
        </label>
      </div>

      <div className="chips">
        {QUICK.map(v => (
          <button key={v} className="chip" onClick={() => setYen(String(v))}>
            ¥{v.toLocaleString()}
            <small>€{fmt(v / rate)}</small>
          </button>
        ))}
      </div>

      <p className="muted small">
        1 € = ¥{fmt(rate)} · ¥1,000 = €{fmt(1000 / rate)}
        <br />
        {at ? `updated ${new Date(at).toLocaleString('en-GB')}` : 'using built-in fallback rate'}
        {stale && at ? ' · may be a day old' : ''}
      </p>
    </div>
  )
}
