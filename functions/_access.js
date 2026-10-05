// Verifies the Cloudflare Access sign-in token. No onRequest exports, so Pages makes no route of it.
// The token is checked here rather than trusting the Cf-Access-Authenticated-User-Email header:
// a request that reaches the site without passing Access (pages.dev, a misconfigured rule)
// could carry any header it likes, but it can't forge Cloudflare's signature.

const b64url = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
const text = s => JSON.parse(new TextDecoder().decode(b64url(s)))

let cached = { team: null, keys: null, at: 0 }

/** The team's public signing keys, cached for an hour (they rotate rarely). */
async function fetchKeys(team) {
  if (cached.team === team && Date.now() - cached.at < 3600e3) return cached.keys
  const r = await fetch(`https://${team}/cdn-cgi/access/certs`)
  if (!r.ok) throw new Error(`certs ${r.status}`)
  cached = { team, keys: (await r.json()).keys, at: Date.now() }
  return cached.keys
}

/** The signed-in email, or null if the token is missing, forged, expired or for another app. */
export async function accessEmail(token, { team, aud }, keys = fetchKeys) {
  if (!token) return null
  const [h, p, s] = token.split('.')
  if (!h || !p || !s) return null
  try {
    const header = text(h), claims = text(p)
    if (header.alg !== 'RS256') return null
    const jwk = (await keys(team)).find(k => k.kid === header.kid)
    if (!jwk) return null
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(s), new TextEncoder().encode(`${h}.${p}`))
    const auds = [].concat(claims.aud)
    const now = Date.now() / 1000
    if (!ok || !auds.includes(aud) || claims.iss !== `https://${team}` || !(claims.exp > now)) return null
    return typeof claims.email === 'string' ? claims.email.toLowerCase() : null
  } catch {
    return null
  }
}

/** OWNERS="a@x.be:Stéphane,b@y.be:Elke" -> Map(email -> display name). */
export const parseOwners = s => new Map(String(s ?? '').split(',').map(e => e.trim()).filter(Boolean)
  .map(e => { const [mail, name] = e.split(':'); return [mail.trim().toLowerCase(), (name ?? mail).trim()] }))

/**
 * What a signed-in non-owner (a journal reader) may do: read the journal, its built files and
 * photos, and leave a comment. Posting or deleting moments stays owners-only.
 */
// ponytail: all of /assets/ is open; the planner's data lives behind /api/, which stays owners-only.
export function readerMay(path, method = 'GET') {
  if (method === 'POST') return path === '/api/journal/comments'
  if (method !== 'GET' && method !== 'HEAD') return false
  return path === '/journal' || path === '/journal.html' || path.startsWith('/journal/')
    || path.startsWith('/assets/') || path === '/api/journal' || path.startsWith('/api/journal/photos/')
}
