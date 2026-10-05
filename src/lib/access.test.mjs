// Run: node src/lib/access.test.mjs
// Signs tokens with a throwaway key and checks only the genuine, current, right-app one passes.
import assert from 'node:assert/strict'
import { accessEmail, parseOwners, readerMay } from '../../functions/_access.js'

const team = 'team.cloudflareaccess.com', aud = 'app-aud'
const alg = { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }
const real = await crypto.subtle.generateKey(alg, true, ['sign', 'verify'])
const fake = await crypto.subtle.generateKey(alg, true, ['sign', 'verify'])
const jwk = { ...(await crypto.subtle.exportKey('jwk', real.publicKey)), kid: 'k1' }
const keys = async () => [jwk]

const b64 = b => Buffer.from(b).toString('base64url')
async function token(claims, key = real.privateKey, kid = 'k1') {
  const h = b64(JSON.stringify({ alg: 'RS256', kid })), p = b64(JSON.stringify(claims))
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${h}.${p}`))
  return `${h}.${p}.${b64(new Uint8Array(sig))}`
}
const ok = { aud: [aud], iss: `https://${team}`, exp: Date.now() / 1000 + 600, email: 'Stef@Example.be' }
const check = t => accessEmail(t, { team, aud }, keys)

assert.equal(await check(await token(ok)), 'stef@example.be', 'genuine token passes, email lowercased')
assert.equal(await check(await token(ok, fake.privateKey)), null, 'forged signature')
assert.equal(await check(await token({ ...ok, aud: ['other-app'] })), null, 'token for another app')
assert.equal(await check(await token({ ...ok, exp: Date.now() / 1000 - 1 })), null, 'expired')
assert.equal(await check(await token({ ...ok, iss: 'https://evil.cloudflareaccess.com' })), null, 'wrong team')
assert.equal(await check(await token(ok, real.privateKey, 'unknown')), null, 'unknown key id')
assert.equal(await check(null), null, 'no token')
assert.equal(await check('garbage'), null, 'not a token')
const [h, , s] = (await token(ok)).split('.')
assert.equal(await check(`${h}.${b64(JSON.stringify({ ...ok, email: 'evil@x.be' }))}.${s}`), null, 'tampered claims')

const owners = parseOwners(' A@x.be:Stéphane , b@y.be:Elke,')
assert.equal(owners.get('a@x.be'), 'Stéphane')
assert.equal(owners.get('b@y.be'), 'Elke')
assert.equal(parseOwners(undefined).size, 0, 'unset = nobody is an owner')

console.log('access ok')

for (const p of ['/journal', '/journal/day/3', '/journal.html', '/assets/journal-x.js'])
  assert.ok(readerMay(p), `reader may load ${p}`)
for (const p of ['/', '/index.html', '/api/items', '/sw.js', '/journalx', '/journal-secret', '/api/journal/moments'])
  assert.ok(!readerMay(p), `reader may not load ${p}`)
assert.ok(readerMay('/api/journal'), 'reader may read the journal')
assert.ok(readerMay('/api/journal/photos/x.jpg'), 'reader may see photos')
assert.ok(readerMay('/api/journal/comments', 'POST'), 'reader may comment')
for (const [p, m] of [['/api/journal/moments', 'POST'], ['/api/journal/photos', 'POST'],
  ['/api/journal/moments/x', 'DELETE'], ['/journal', 'POST'], ['/api/items', 'POST']])
  assert.ok(!readerMay(p, m), `reader may not ${m} ${p}`)
console.log('reader paths ok')
