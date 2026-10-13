/**
 * End-to-end rate-limit check against a DEPLOYED site (Upstash must be configured there).
 * Rate limiting runs before Turnstile verification, so dummy tokens are fine: requests 1–5 are
 * expected to be rejected by Turnstile (403) or accepted, and request 6 MUST be 429.
 *
 *   node scripts/test-ratelimit.mjs https://deploy-preview-1--your-site.netlify.app
 */
const base = process.argv[2]?.replace(/\/$/, '')
if (!base) {
  console.error('usage: node scripts/test-ratelimit.mjs <site-url>')
  process.exit(2)
}
const body = JSON.stringify({
  name: 'Rate Limit Test',
  phone: '+91 90000 00000',
  message: 'Automated rate-limit test, please ignore.',
  website: '',
  turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
})
const statuses = []
for (let i = 0; i < 6; i++) {
  const res = await fetch(`${base}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body,
  })
  statuses.push(res.status)
  if (res.status === 429) console.log(`  Retry-After: ${res.headers.get('retry-after')}s`)
}
console.log(`statuses: ${statuses.join(', ')}`)
const ok = statuses.slice(0, 5).every((s) => s !== 429) && statuses[5] === 429
console.log(ok ? 'PASS  6th rapid submit → 429' : 'FAIL  expected the 6th request to be 429')
process.exit(ok ? 0 : 1)
