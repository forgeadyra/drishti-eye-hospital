/**
 * Post-build HTML step:
 *  1. Prerender <App/> into dist/index.html (h1, copy and CTAs are in the initial HTML: fast LCP,
 *     crawlable, works without JS).
 *  2. Inline the critical stylesheet (removes a render-blocking round trip) and allow exactly that
 *     <style> block in the CSP via its sha256 hash, so the policy stays free of 'unsafe-inline'.
 */
import { createHash } from 'node:crypto'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = join(import.meta.dirname, '..')
const dist = join(root, 'dist')
const ssrDir = join(root, 'dist-ssr')
const { render } = await import(pathToFileURL(join(ssrDir, 'entry-server.js')).href)

const file = join(dist, 'index.html')
let html = readFileSync(file, 'utf8')
if (!html.includes('<!--app-html-->')) throw new Error('prerender: <!--app-html--> marker missing')
html = html.replace('<!--app-html-->', render())

// Inline the stylesheet(s) linked from index.html.
const hashes = []
html = html.replace(/<link rel="stylesheet" crossorigin href="\/(assets\/[^"]+\.css)">/g, (_, href) => {
  const css = readFileSync(join(dist, href), 'utf8').trim()
  hashes.push(`'sha256-${createHash('sha256').update(css).digest('base64')}'`)
  return `<style>${css}</style>`
})
if (!hashes.length) throw new Error('prerender: no stylesheet found to inline')

// 3. Load the app bundle AFTER first paint. The HTML is fully prerendered and every CTA is a plain
//    link, so hydration can wait one frame; on slow networks the text no longer competes with
//    ~170 KB of JS for bandwidth. The boot file is external (CSP: no inline scripts).
const entry = html.match(/<script type="module" crossorigin src="(\/assets\/main-[^"]+\.js)"><\/script>/)
if (!entry) throw new Error('prerender: entry script not found')
const preloads = [...html.matchAll(/<link rel="modulepreload" crossorigin href="([^"]+)">/g)].map((m) => m[1])
const boot = `const p=${JSON.stringify(preloads)},s=${JSON.stringify(entry[1])};const go=()=>{for(const h of p){const l=document.createElement("link");l.rel="modulepreload";l.href=h;document.head.appendChild(l)}import(s)};requestAnimationFrame(()=>setTimeout(go,0));\n`
const bootName = `assets/boot-${createHash('sha256').update(boot).digest('hex').slice(0, 8)}.js`
writeFileSync(join(dist, bootName), boot)
html = html
  .replace(/\s*<link rel="modulepreload" crossorigin href="[^"]+">/g, '')
  .replace(entry[0], `<script type="module" src="/${bootName}"></script>`)
writeFileSync(file, html)

const headersFile = join(dist, '_headers')
const headers = readFileSync(headersFile, 'utf8')
if (!headers.includes("style-src 'self'")) throw new Error('prerender: style-src directive not found in _headers')
writeFileSync(headersFile, headers.replace("style-src 'self'", `style-src 'self' ${hashes.join(' ')}`))

rmSync(ssrDir, { recursive: true, force: true })
console.log(`prerender: dist/index.html ✓ (CSS inlined, CSP hash ${hashes.join(' ')})`)
