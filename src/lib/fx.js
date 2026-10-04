const FALLBACK = 177          // ¥ per € — baked in so the calculator is never blank (Q10)
const KEY = 'fx.eurjpy'
const ENDPOINT = 'https://open.er-api.com/v6/latest/EUR'

export function cachedRate() {
  try {
    const { rate, at } = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    if (rate) return { rate, at, stale: Date.now() - at > 864e5 }
  } catch { /* corrupt entry, fall through */ }
  return { rate: FALLBACK, at: null, stale: true }
}

export async function refreshRate() {
  const r = await fetch(ENDPOINT)
  if (!r.ok) throw new Error(`fx ${r.status}`)
  const rate = (await r.json())?.rates?.JPY
  if (!rate) throw new Error('no JPY in response')
  const entry = { rate, at: Date.now() }
  localStorage.setItem(KEY, JSON.stringify(entry))
  return { ...entry, stale: false }
}
