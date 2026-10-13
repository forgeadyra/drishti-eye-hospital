/**
 * Browser QA against the production preview (`npm run preview` must be running on :4173,
 * or pass a URL: `node scripts/qa-browser.mjs https://deploy-preview.example`).
 *
 * Covers: 3D load + motion, reduced motion, WebGL disabled, low-end device, 360/768/1440 widths
 * (no horizontal overflow), mobile menu keyboard behaviour, console errors and CSP violations.
 * Screenshots → qa-artifacts/. Exit code 1 on any failure.
 */
import puppeteer from 'puppeteer-core'
import { Launcher } from 'chrome-launcher'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.argv[2] ?? 'http://localhost:4173'
const OUT = join(import.meta.dirname, '..', 'qa-artifacts')
mkdirSync(OUT, { recursive: true })
const chromePath = Launcher.getInstallations()[0]
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function launch(extraArgs = []) {
  return puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', ...extraArgs],
  })
}

/** Opens a page that records console errors + CSP violations. */
async function open(browser, { width = 1440, height = 900, mobile = false, reduced = false, cores } = {}) {
  const page = await browser.newPage()
  const problems = []
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`))
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  await page.evaluateOnNewDocument((c) => {
    document.addEventListener('securitypolicyviolation', (e) =>
      console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`),
    )
    if (c) Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => c })
  }, cores)
  await page.setViewport({ width, height, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 })
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page.goto(BASE, { waitUntil: 'load' })
  return { page, problems }
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 120))
    }
    window.scrollTo(0, 0)
  })
  await sleep(800)
}

// ── 1. Desktop: 3D scene loads after interaction, renders, reacts ──
{
  const browser = await launch()
  const { page, problems } = await open(browser)
  await page.mouse.move(700, 400)
  await page.waitForSelector('canvas', { timeout: 8000 }).catch(() => {})
  await sleep(9000) // headless Chrome renders WebGL in software (low FPS); give the intro time
  const hasCanvas = Boolean(await page.$('canvas'))
  check('desktop: 3D canvas mounts on a capable device', hasCanvas)
  await page.screenshot({ path: join(OUT, 'desktop-hero-3d.png') })
  const dpr = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    return c ? c.width / c.getBoundingClientRect().width : 0
  })
  check('desktop: canvas DPR ≤ 1.5', dpr > 0 && dpr <= 1.5, `dpr=${dpr.toFixed(2)}`)
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 0.6))
  await sleep(1500)
  await page.screenshot({ path: join(OUT, 'desktop-hero-scrolled.png') })
  await scrollThrough(page)
  const posterHidden = await page.evaluate(() => getComputedStyle(document.querySelector('#top picture img')).opacity)
  check('desktop: poster cross-fades out once 3D is ready', Number(posterHidden) < 0.1, `poster opacity=${posterHidden}`)
  check('desktop: no console errors / CSP violations', problems.length === 0, problems.join(' | '))

  // Keyboard focus on an off-screen element must scroll it into view (Lenis must not undo it).
  await page.evaluate(() => window.scrollTo(0, 0))
  await sleep(800)
  await page.evaluate(() => document.querySelector('#location a').focus())
  await sleep(1200)
  const inView = await page.evaluate(() => {
    const r = document.activeElement.getBoundingClientRect()
    return r.top >= 0 && r.bottom <= window.innerHeight
  })
  check('desktop: keyboard focus scrolls off-screen element into view', inView)
  const mapLoaded = await page.evaluate(() => Boolean(document.querySelector('#location iframe')))
  check('desktop: Google Map iframe lazy-loads when Location is reached', mapLoaded)
  await browser.close()
}

// ── 2. Reduced motion: no 3D, no intro, content intact ──
{
  const browser = await launch()
  const { page, problems } = await open(browser, { reduced: true })
  await page.mouse.move(700, 400)
  await sleep(4000)
  check('reduced-motion: no canvas', !(await page.$('canvas')))
  const introHidden = await page.$eval('.intro', (el) => getComputedStyle(el).display === 'none')
  check('reduced-motion: intro not shown', introHidden)
  await page.evaluate(() => document.getElementById('services').scrollIntoView())
  await sleep(600)
  const hiddenCount = await page.evaluate(
    () => [...document.querySelectorAll('[data-reveal]')].filter((el) => getComputedStyle(el).opacity === '0').length,
  )
  check('reduced-motion: all content visible (no hidden reveal targets)', hiddenCount === 0, `hidden=${hiddenCount}`)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: join(OUT, 'reduced-motion-hero.png') })
  check('reduced-motion: no console errors', problems.length === 0, problems.join(' | '))
  await browser.close()
}

// ── 3. WebGL disabled: poster fallback ──
{
  const browser = await launch(['--disable-3d-apis', '--disable-webgl'])
  const { page, problems } = await open(browser)
  await page.mouse.move(700, 400)
  await sleep(4000)
  check('no-WebGL: no canvas', !(await page.$('canvas')))
  const poster = await page.$eval('#top picture img', (el) => ({ op: getComputedStyle(el).opacity, w: el.naturalWidth }))
  check('no-WebGL: poster visible + loaded', Number(poster.op) === 1 && poster.w > 0, JSON.stringify(poster))
  await page.screenshot({ path: join(OUT, 'no-webgl-hero.png') })
  check('no-WebGL: no console errors', problems.length === 0, problems.join(' | '))
  await browser.close()
}

// ── 4. Low-end device (4 cores) ──
{
  const browser = await launch()
  const { page } = await open(browser, { cores: 4 })
  await page.mouse.move(700, 400)
  await sleep(4000)
  check('low-end (hardwareConcurrency=4): poster instead of 3D', !(await page.$('canvas')))
  await browser.close()
}

// ── 5. Responsive widths ──
for (const [width, height, mobile] of [
  [360, 780, true],
  [768, 1024, true],
  [1440, 900, false],
]) {
  const browser = await launch()
  const { page, problems } = await open(browser, { width, height, mobile })
  await scrollThrough(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(`${width}px: no horizontal overflow`, overflow <= 0, `overflow=${overflow}px`)
  await page.screenshot({ path: join(OUT, `width-${width}-hero.png`) })
  // fullPage capture is only reliable without mobile emulation (it resizes the viewport → svh relayout)
  if (!mobile) await page.screenshot({ path: join(OUT, `width-${width}-full.png`), fullPage: true })
  check(`${width}px: no console errors`, problems.length === 0, problems.join(' | '))

  if (width === 360) {
    // Mobile menu: opens as a modal, focus moves in, Esc closes and returns focus.
    await page.click('button[aria-controls="mobile-menu"]')
    await sleep(900)
    const open = await page.evaluate(() => ({
      dialog: Boolean(document.querySelector('#mobile-menu[role="dialog"]')),
      focusInside: Boolean(document.activeElement?.closest('#mobile-menu')),
    }))
    await page.screenshot({ path: join(OUT, 'width-360-menu-open.png') })
    check('360px: mobile menu opens as dialog with focus inside', open.dialog && open.focusInside, JSON.stringify(open))
    await page.keyboard.press('Escape')
    await sleep(900)
    const closed = await page.evaluate(() => ({
      gone: !document.querySelector('#mobile-menu'),
      focusBack: document.activeElement?.getAttribute('aria-controls') === 'mobile-menu',
    }))
    check('360px: Esc closes menu and returns focus', closed.gone && closed.focusBack, JSON.stringify(closed))
  }
  await browser.close()
}

// ── 6. 404 page ──
{
  const browser = await launch()
  const page = await browser.newPage()
  const res = await page.goto(`${BASE}/this-does-not-exist`, { waitUntil: 'load' })
  const h1 = await page.$eval('h1', (el) => el.textContent)
  // vite preview serves index.html for unknown routes; Netlify serves dist/404.html with status 404.
  const direct = await page.goto(`${BASE}/404.html`, { waitUntil: 'load' })
  const h1direct = await page.$eval('h1', (el) => el.textContent)
  await page.screenshot({ path: join(OUT, '404.png') })
  check('404 page renders', /out of focus/i.test(h1direct ?? ''), `status=${direct?.status()} h1="${h1direct}" (preview fallback: ${res?.status()} "${h1}")`)
  await browser.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} browser checks passed`)
process.exit(failed.length ? 1 : 0)
