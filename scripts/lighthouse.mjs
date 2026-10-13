/**
 * Lighthouse (mobile, simulated 4G + 4× CPU slowdown — Lighthouse defaults) against the
 * production preview. Runs 3 times, reports the median-performance run, checks the budget.
 *
 *   npm run preview   (in another terminal)
 *   npm run lighthouse [-- https://url]
 */
import lighthouse from 'lighthouse'
import * as chromeLauncher from 'chrome-launcher'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const URL = process.argv[2] ?? 'http://localhost:4173/'
const OUT = join(import.meta.dirname, '..', 'lighthouse-reports')
mkdirSync(OUT, { recursive: true })

const BUDGET = { performance: 85, accessibility: 95, 'best-practices': 95, seo: 95 }
const runs = []
for (let i = 1; i <= 3; i++) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new'] })
  const result = await lighthouse(URL, { port: chrome.port, output: ['html', 'json'], logLevel: 'error' })
  await chrome.kill()
  const lhr = result.lhr
  const scores = Object.fromEntries(Object.entries(lhr.categories).map(([k, c]) => [k, Math.round(c.score * 100)]))
  const a = lhr.audits
  const metrics = {
    LCP: a['largest-contentful-paint'].displayValue,
    CLS: a['cumulative-layout-shift'].displayValue,
    TBT: a['total-blocking-time'].displayValue,
    FCP: a['first-contentful-paint'].displayValue,
    SI: a['speed-index'].displayValue,
  }
  const failing = Object.values(lhr.categories)
    .flatMap((c) => c.auditRefs.map((r) => a[r.id]))
    .filter((au) => au && au.score !== null && au.score < 1 && au.scoreDisplayMode === 'binary')
    .map((au) => au.id)
  writeFileSync(join(OUT, `run-${i}.html`), result.report[0])
  writeFileSync(join(OUT, `run-${i}.json`), result.report[1])
  runs.push({ i, scores, metrics, lcpMs: a['largest-contentful-paint'].numericValue, cls: a['cumulative-layout-shift'].numericValue, failing })
  console.log(`run ${i}:`, JSON.stringify(scores), JSON.stringify(metrics), failing.length ? `failing audits: ${failing.join(', ')}` : '')
}

runs.sort((x, y) => x.scores.performance - y.scores.performance)
const median = runs[1]
console.log(`\nmedian run (#${median.i}): ${JSON.stringify(median.scores)} ${JSON.stringify(median.metrics)}`)
let ok = true
for (const [k, min] of Object.entries(BUDGET)) {
  const pass = median.scores[k] >= min
  ok &&= pass
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${k} ${median.scores[k]} (≥ ${min})`)
}
const lcpPass = median.lcpMs < 2500
const clsPass = median.cls < 0.1
console.log(`${lcpPass ? 'PASS' : 'FAIL'}  LCP ${median.metrics.LCP} (< 2.5 s)`)
console.log(`${clsPass ? 'PASS' : 'FAIL'}  CLS ${median.metrics.CLS} (< 0.1)`)
process.exit(ok && lcpPass && clsPass ? 0 : 1)
