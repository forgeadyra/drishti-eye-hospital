/**
 * Contact function tests — calls the Netlify handler directly with real Request objects.
 * Turnstile is verified against Cloudflare's real siteverify endpoint using Cloudflare's
 * documented TEST secrets (always-pass / always-fail), so network access is required.
 *
 *   node scripts/test-contact.mjs
 */
import handler, { sanitize, escapeHtml } from '../netlify/functions/contact.mts'

const ORIGIN = 'http://localhost:5173'
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

// Capture the function's server-side logs so we can assert on them (and prove no PII is logged).
const logs = []
const realInfo = console.info
console.info = (line) => logs.push(String(line))

let ipSeq = 1
const ctx = (context = 'dev', ip = `203.0.113.${ipSeq++}`) => ({ deploy: { context }, ip })
const valid = {
  name: 'Asha Verma',
  phone: '+91 98765 43210',
  message: 'I would like to book an eye check-up next week.',
  website: '',
  turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
}
const req = (body, { method = 'POST', origin = ORIGIN, type = 'application/json', raw } = {}) =>
  new Request('http://localhost/api/contact', {
    method,
    headers: { ...(origin && { Origin: origin }), ...(type && { 'Content-Type': type }) },
    body: method === 'POST' || method === 'PUT' ? (raw ?? JSON.stringify(body)) : undefined,
  })
const call = async (r, c = ctx()) => {
  const res = await handler(r, c)
  return { status: res.status, body: res.status === 204 ? null : await res.json().catch(() => null), headers: res.headers }
}

// ── happy path ──
{
  const r = await call(req(valid))
  check('valid submission → 200', r.status === 200 && r.body?.ok === true, `status=${r.status}`)
  check('CORS echoes only the allowed origin', r.headers.get('access-control-allow-origin') === ORIGIN)
}

// ── validation ──
for (const [label, patch] of [
  ['name too short', { name: 'A' }],
  ['name too long', { name: 'A'.repeat(81) }],
  ['phone letters', { phone: 'call me maybe' }],
  ['phone too few digits', { phone: '12345' }],
  ['phone too many digits', { phone: '+1234567890123456' }],
  ['message too short', { message: 'hi' }],
  ['message too long', { message: 'x'.repeat(1001) }],
  ['wrong type (number)', { name: 12345 }],
  ['missing field', { message: undefined }],
  ['unexpected extra key', { admin: true }],
]) {
  const r = await call(req({ ...valid, ...patch }))
  check(`invalid input (${label}) → 400 generic`, r.status === 400 && !/zod|issue|path/i.test(JSON.stringify(r.body)), `status=${r.status} body=${JSON.stringify(r.body)}`)
}
{
  const r = await call(req(null, { raw: '{not json' }))
  check('malformed JSON → 400', r.status === 400)
}
{
  const r = await call(req({ ...valid, name: '<b></b>' }))
  check('name that is only HTML → rejected after sanitising', r.status === 400)
}

// ── honeypot ──
{
  const before = logs.length
  const r = await call(req({ ...valid, website: 'http://spam.example' }))
  const logged = logs.slice(before).join('\n')
  check('honeypot filled → silent 200, nothing sent', r.status === 200 && /"evt":"honeypot"/.test(logged) && !/"evt":"(sent|email_skipped_dev)"/.test(logged), logged)
}

// ── rate limit: 6 rapid submits from one IP ──
{
  const c = ctx('dev', '198.51.100.77')
  const statuses = []
  for (let i = 0; i < 6; i++) statuses.push((await call(req(valid), c)).status)
  const sixth = await handler(req(valid), c)
  check('6 rapid submits → first 5 OK, 6th is 429', statuses.slice(0, 5).every((s) => s === 200) && statuses[5] === 429, `statuses=${statuses.join(',')}`)
  check('429 includes Retry-After', sixth.status === 429 && Number(sixth.headers.get('retry-after')) > 0, `retry-after=${sixth.headers.get('retry-after')}`)
  const other = await call(req(valid))
  check('other IPs unaffected by the limit', other.status === 200)
}

// ── transport rules ──
{
  const r = await call(req(null, { method: 'GET', type: null }))
  check('GET → 405 with Allow header', r.status === 405 && r.headers.get('allow') === 'POST, OPTIONS')
  const p = await call(req(null, { method: 'PUT', raw: '{}' }))
  check('PUT → 405', p.status === 405)
  const t = await call(req(valid, { type: 'text/plain' }))
  check('non-JSON content-type → 415', t.status === 415)
  const f = await call(req(null, { type: 'application/x-www-form-urlencoded', raw: 'name=x' }))
  check('form-encoded body → 415', f.status === 415)
  const big = await call(req({ ...valid, message: 'x'.repeat(11 * 1024) }))
  check('body > 10 KB → 413', big.status === 413)
  const evil = await call(req(valid, { origin: 'https://evil.example' }))
  check('foreign Origin → 403, no CORS header', evil.status === 403 && !evil.headers.get('access-control-allow-origin'))
  const none = await call(req(valid, { origin: null }))
  check('missing Origin → 403', none.status === 403)
  const pre = await call(req(null, { method: 'OPTIONS', type: null }))
  check('CORS preflight from allowed origin → 204', pre.status === 204 && pre.headers.get('access-control-allow-methods') === 'POST, OPTIONS')
  const preEvil = await call(req(null, { method: 'OPTIONS', type: null, origin: 'https://evil.example' }))
  check('CORS preflight from foreign origin → 403', preEvil.status === 403)
}

// ── Turnstile ──
{
  process.env.TURNSTILE_SECRET_KEY = '2x0000000000000000000000000000000AA' // Cloudflare test secret: always fails
  const r = await call(req(valid))
  check('Turnstile verification failure → 403 (server-side siteverify)', r.status === 403, `status=${r.status}`)
  delete process.env.TURNSTILE_SECRET_KEY
}

// ── production fails closed when secrets are missing ──
{
  process.env.ALLOWED_ORIGIN = 'https://www.example-clinic.test'
  const r = await call(req(valid, { origin: 'https://www.example-clinic.test' }), ctx('production'))
  check('production without Upstash/Turnstile/Resend secrets → 500 (fails closed)', r.status === 500, `status=${r.status}`)
  const local = await call(req(valid), ctx('production'))
  check('production rejects localhost origins', local.status === 403)
  delete process.env.ALLOWED_ORIGIN
}

// ── sanitiser / escaper unit checks ──
check('sanitize strips tags', sanitize('<script>alert(1)</script>Asha') === 'alert(1)Asha')
check('sanitize strips control + bidi chars', sanitize('As\u0000ha‮') === 'As ha')
check('escapeHtml escapes markup', escapeHtml('<img src=x onerror=1>') === '&#60;img src&#61;x onerror&#61;1&#62;')

// ── logs never contain PII ──
{
  const all = logs.join('\n')
  const leaked = ['Asha', '98765', 'eye check-up', '203.0.113', '198.51.100'].filter((s) => all.includes(s))
  check('server logs contain no name / phone / message / raw IP', leaked.length === 0, leaked.join(', '))
}

console.info = realInfo
const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} contact-function checks passed`)
process.exit(failed ? 1 : 0)
