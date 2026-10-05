// Who may see what. Cloudflare Access sits in front of japan.elke-stephane.gent and lets
// anyone through who proves they own an email address (one-time PIN). This decides the rest:
//   owners (OWNERS)  -> everything
//   anyone else      -> a "this is private" page (journal readers get their own paths later)
// The pages.dev address isn't behind Access, so it only ever redirects to the real one.
import { accessEmail, parseOwners } from './_access.js'

const OPEN = ['/robots.txt', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/icon.svg']

const privatePage = email => new Response(`<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Privé</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f6f2;color:#1b1e26;
font:16px/1.6 -apple-system,"Hiragino Sans",sans-serif}main{max-width:26rem;padding:24px}
h1{font:500 1.6rem/1.2 "Hiragino Mincho ProN",serif;margin:0 0 .5rem}p{margin:.5rem 0;color:#6a6f7c}
a{color:#2443c4}</style>
<main><h1>Deze pagina is privé</h1>
<p>Je bent aangemeld als ${email.replace(/[<>&"]/g, '')}, maar dit adres heeft geen toegang.</p>
<p><a href="/cdn-cgi/access/logout">Afmelden en een ander adres gebruiken</a></p></main>`,
  { status: 403, headers: { 'content-type': 'text/html; charset=utf-8' } })

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
  return owner ? pass(email, owner) : privatePage(email)
}
