/**
 * Post-build gate. Fails the build (exit 1) if any production guarantee is broken.
 * Prints NOTICE lines (non-fatal) for owner-supplied content that is still a placeholder.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join, relative } from 'node:path'

const dist = join(import.meta.dirname, '..', 'dist')
const failures = []
const notices = []
const fail = (msg) => failures.push(msg)

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}
const files = walk(dist).map((p) => relative(dist, p).replaceAll('\\', '/'))
const read = (f) => readFileSync(join(dist, f), 'utf8')
const kb = (n) => `${(n / 1024).toFixed(1)} KB`

// 1. Exposed files: sourcemaps, env, VCS, source, config.
const forbidden = [
  /\.map$/,
  /(^|\/)\.env/,
  /(^|\/)\.git(\/|$)/,
  /\.(ts|tsx|mts)$/,
  /(^|\/)(package(-lock)?\.json|netlify\.toml|vite\.config\.\w+|tsconfig.*\.json|eslint\.config\.js)$/,
]
for (const f of files) if (forbidden.some((re) => re.test(f))) fail(`exposed file in dist: ${f}`)

const js = files.filter((f) => f.endsWith('.js'))
const html = files.filter((f) => f.endsWith('.html'))

// 2. No sourceMappingURL, console.log, debugger in shipped JS.
for (const f of js) {
  const src = read(f)
  if (/sourceMappingURL=/.test(src)) fail(`sourceMappingURL in ${f}`)
  if (/console\.log\s*\(/.test(src)) fail(`console.log in ${f}`)
  if (/\bdebugger\b/.test(src)) fail(`debugger statement in ${f}`)
}

// 3. Secrets / server-only env names must never reach the client bundle.
const secretPatterns = [
  /TURNSTILE_SECRET_KEY/,
  /UPSTASH_REDIS_REST_TOKEN/,
  /RESEND_API_KEY/,
  /\bre_[A-Za-z0-9]{20,}/, // Resend key shape
  /0x4AAAAAAA[A-Za-z0-9_-]{20,}/, // Turnstile secret shape
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
]
for (const f of [...js, ...html])
  for (const re of secretPatterns) if (re.test(read(f))) fail(`secret-like value ${re} in ${f}`)

// 4. HTML: CSP-safe (no inline executable scripts, no style attributes, no inline handlers).
for (const f of html) {
  const src = read(f)
  for (const m of src.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const [, attrs, body] = m
    const isData = /type="application\/ld\+json"/.test(attrs)
    if (!isData && body.trim()) fail(`inline <script> in ${f}`)
  }
  if (/\sstyle="/.test(src)) fail(`inline style attribute in ${f} (blocked by CSP)`)
  if (/\son[a-z]+="/.test(src)) fail(`inline event handler in ${f}`)
  for (const m of src.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g))
    if (!/rel="noopener noreferrer"/.test(m[0])) fail(`target=_blank without rel in ${f}: ${m[0].slice(0, 80)}`)
  const h1 = (src.match(/<h1\b/g) ?? []).length
  if (h1 !== 1) fail(`${f} has ${h1} <h1> elements (expected 1)`)
  for (const m of src.matchAll(/<img\b[^>]*>/g)) if (!/\salt="/.test(m[0])) fail(`<img> without alt in ${f}`)
  for (const m of src.matchAll(/<img\b[^>]*>/g))
    if (!/\swidth="/.test(m[0]) || !/\sheight="/.test(m[0])) fail(`<img> without width/height in ${f}`)
}

// 4b. Every inline <style> must be allowed by a CSP hash (no 'unsafe-inline').
{
  const { createHash } = await import('node:crypto')
  const csp = read('_headers').match(/Content-Security-Policy: (.*)/)?.[1] ?? ''
  if (/unsafe-inline|unsafe-eval/.test(csp)) fail('CSP contains unsafe-inline / unsafe-eval')
  for (const f of html)
    for (const m of read(f).matchAll(/<style>([\s\S]*?)<\/style>/g)) {
      const h = createHash('sha256').update(m[1]).digest('base64')
      if (!csp.includes(`'sha256-${h}'`)) fail(`inline <style> in ${f} not allowed by CSP hash`)
    }
}

// 5. Initial JS budget (< 250 KB gzip): entry script + everything it modulepreloads.
const index = read('index.html')
// Entry scripts in the HTML, plus everything the boot loader requests (entry + its preloads).
const direct = [...index.matchAll(/<(?:script[^>]+src|link[^>]+rel="modulepreload"[^>]+href)="\/([^"]+\.js)"/g)].map(
  (m) => m[1],
)
const initial = [...new Set(direct.flatMap((f) => [f, ...[...(/boot-/.test(f) ? read(f) : "").matchAll(/"\/(assets\/[^"]+\.js)"/g)].map((m) => m[1])]))]
const gz = (f) => gzipSync(readFileSync(join(dist, f)), { level: 9 }).length
const initialBytes = initial.reduce((n, f) => n + gz(f), 0)
const css = files.filter((f) => f.endsWith('.css'))
const lazy = js.filter((f) => !initial.includes(f))
console.log('\n── bundle report (gzip) ──')
for (const f of initial) console.log(`  initial  ${kb(gz(f)).padStart(9)}  ${f}`)
for (const f of lazy) console.log(`  lazy     ${kb(gz(f)).padStart(9)}  ${f}`)
for (const f of css) console.log(`  css      ${kb(gz(f)).padStart(9)}  ${f}`)
console.log(`  INITIAL JS TOTAL: ${kb(initialBytes)} (budget 250 KB)`)
if (initialBytes > 250 * 1024) fail(`initial JS ${kb(initialBytes)} exceeds 250 KB gzip budget`)

// 6. Required SEO files.
for (const f of ['robots.txt', 'sitemap.xml', '_headers', 'favicon.svg', 'og-image.jpg', '404.html'])
  if (!files.includes(f)) fail(`missing ${f}`)
if (!/application\/ld\+json/.test(index)) fail('JSON-LD missing from index.html')

// 7. 3D assets budget (< 1.5 MB): models/textures shipped.
const models = files.filter((f) => /\.(glb|gltf|ktx2|hdr|exr)$/.test(f))
const modelBytes = models.reduce((n, f) => n + statSync(join(dist, f)).size, 0)
console.log(`  3D model/texture assets: ${models.length} file(s), ${kb(modelBytes)} (budget 1.5 MB)`)
if (modelBytes > 1.5 * 1024 * 1024) fail('3D assets exceed 1.5 MB')

// Notices (non-fatal): owner content still to supply.
const ph = new Set(index.match(/\{\{[A-Z0-9_]+\}\}/g) ?? [])
if (ph.size) notices.push(`${ph.size} placeholder(s) still visible on the page: ${[...ph].join(' ')}`)
if (js.some((f) => read(f).includes('1x00000000000000000000AA')))
  notices.push('Turnstile is using Cloudflare’s TEST site key — set VITE_TURNSTILE_SITE_KEY for production.')

console.log('')
for (const n of notices) console.log(`NOTICE  ${n}`)
if (failures.length) {
  for (const f of failures) console.error(`FAIL    ${f}`)
  process.exit(1)
}
console.log('verify-dist: all checks passed ✓')
