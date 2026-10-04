// Cloudflare Access can't protect a production *.pages.dev URL — Access needs a zone
// you own, and pages.dev isn't one. This is the stand-in: one shared passphrase, a
// signed cookie that lasts a year, and a login page for anything without one.
//
// ponytail: deliberately not a user system. Two people, one trip, one secret. If this
// ever needs per-person identity or revocation, put a real domain on Cloudflare and
// use Access — that is the upgrade path, not adding users here.
const COOKIE = 'trip_auth'
const YEAR = 60 * 60 * 24 * 365
const OPEN = ['/__auth', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/icon.svg']

const enc = new TextEncoder()

/** Deterministic token derived from the passphrase — the passphrase itself never
 *  goes in the cookie, so reading the cookie doesn't hand over the secret. */
async function token(secret) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('japan-2026'))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Length-independent compare so a wrong guess can't be timed. */
function same(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const page = (msg = '') => new Response(`<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Japan 2026</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#1c1917;color:#fafaf9;
       font:16px/1.5 ui-sans-serif,-apple-system,sans-serif}
  form{display:grid;gap:.75rem;width:min(22rem,86vw)}
  h1{font-size:1.2rem;margin:0 0 .25rem}
  input,button{font:inherit;padding:.7rem .8rem;border-radius:10px;border:1px solid #44403c}
  input{background:#292524;color:inherit}
  button{background:#fb7185;color:#fff;border:0;font-weight:600}
  p{margin:0;color:#a8a29e;font-size:.85rem}
</style>
<form method="POST" action="/__auth">
  <h1>Japan 2026</h1>
  ${msg ? `<p style="color:#fb7185">${msg}</p>` : '<p>Enter the trip passphrase.</p>'}
  <input type="password" name="p" autofocus autocomplete="current-password" aria-label="Passphrase">
  <button type="submit">Open</button>
</form>`, { status: msg ? 401 : 401, headers: { 'content-type': 'text/html; charset=utf-8' } })

export async function onRequest({ request, env, next }) {
  const secret = env.TRIP_PASSPHRASE
  if (!secret) return next()                 // unset locally: don't lock yourself out of dev

  const url = new URL(request.url)
  if (OPEN.includes(url.pathname) && url.pathname !== '/__auth') return next()

  const want = await token(secret)

  if (url.pathname === '/__auth') {
    if (request.method !== 'POST') return Response.redirect(url.origin + '/', 302)
    const given = (await request.formData()).get('p') ?? ''
    if (!same(String(given), secret)) return page('Not that one.')
    return new Response(null, {
      status: 302,
      headers: {
        location: '/',
        'set-cookie': `${COOKIE}=${want}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${YEAR}`,
      },
    })
  }

  const got = (request.headers.get('cookie') ?? '')
    .split(';').map(c => c.trim().split('='))
    .find(([k]) => k === COOKIE)?.[1] ?? ''

  return same(got, want) ? next() : page()
}
