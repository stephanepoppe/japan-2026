// Who may see what. Cloudflare Access sits in front of japan.elke-stephane.gent and lets
// anyone through who proves they own an email address (one-time PIN). This decides the rest:
//   owners (OWNERS)  -> everything
//   anyone else      -> the journal only: read it, comment (readerMay); other pages send them to /journal
// The pages.dev address isn't behind Access, so it only ever redirects to the real one.
import { accessEmail, parseOwners, readerMay } from './_access.js'

const OPEN = ['/robots.txt', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/icon.svg']

/** Private site: no search engine may index anything, error pages included. */
export async function onRequest(ctx) {
  const res = await guard(ctx)
  const out = new Response(res.body, res)        // responses from next() have immutable headers
  out.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  return out
}

async function guard({ request, env, next }) {
  const url = new URL(request.url)

  if (env.SITE_HOST && url.hostname !== env.SITE_HOST && url.hostname.endsWith('.pages.dev')) {
    return Response.redirect(`https://${env.SITE_HOST}${url.pathname}${url.search}`, 301)
  }
  if (OPEN.includes(url.pathname)) return next()

  // Identity travels to the API only through these headers, set here and nowhere else.
  const headers = new Headers(request.headers)
  headers.delete('X-Trip-Email'); headers.delete('X-Trip-Name')
  const pass = (email, name) => {
    headers.set('X-Trip-Email', email); headers.set('X-Trip-Name', name)
    return next(new Request(request, { headers }))
  }

  if (!env.ACCESS_AUD) return pass('dev@localhost', 'Dev')   // local dev has no Access in front

  const token = request.headers.get('Cf-Access-Jwt-Assertion')
    ?? (request.headers.get('cookie') ?? '').match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1]
  const email = await accessEmail(token, { team: env.ACCESS_TEAM, aud: env.ACCESS_AUD })
  // No valid sign-in: start over at the Access login (it sends people back here afterwards).
  if (!email) return Response.redirect(`${url.origin}/cdn-cgi/access/login/${url.hostname}?redirect_url=${encodeURIComponent(url.pathname + url.search)}`, 302)

  const owner = parseOwners(env.OWNERS).get(email)
  if (owner) return pass(email, owner)
  // Readers carry no identity headers, so the API never mistakes them for an owner.
  if (readerMay(url.pathname, request.method)) return next(new Request(request, { headers }))
  if (url.pathname.startsWith('/api/')) return new Response('Forbidden', { status: 403 })
  return Response.redirect(`${url.origin}/journal`, 302)
}
