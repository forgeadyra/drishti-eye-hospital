/**
 * Image pipeline (runs before every build):
 *  1. Gallery photos: assets-src/images/*.{jpg,jpeg,png,webp,avif} → AVIF + WebP at 480/960/1600w
 *     into public/images/g/, plus src/content/gallery.generated.json (dimensions, srcsets, alt).
 *     Alt text is REQUIRED per photo in assets-src/images/alt.json — the build fails without it.
 *  2. Hero poster (WebGL / reduced-motion / low-end fallback), drawn procedurally to match the 3D iris.
 *  3. Favicon set + Open Graph image.
 */
import sharp from 'sharp'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'

const root = join(import.meta.dirname, '..')
const SRC = join(root, 'assets-src/images')
const OUT = join(root, 'public/images/g')
const PUB = join(root, 'public')
const MANIFEST = join(root, 'src/content/gallery.generated.json')
const WIDTHS = [480, 960, 1600]

mkdirSync(OUT, { recursive: true })
mkdirSync(join(PUB, 'posters'), { recursive: true })

// ─── 1. Gallery ──────────────────────────────────────────────────
const altPath = join(SRC, 'alt.json')
const alts = existsSync(altPath) ? JSON.parse(readFileSync(altPath, 'utf8')) : {}
const photos = existsSync(SRC)
  ? readdirSync(SRC).filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f)).sort()
  : []

const manifest = []
for (const file of photos) {
  const alt = alts[file]
  if (!alt || typeof alt !== 'string' || !alt.trim()) {
    console.error(`✖ Missing alt text for assets-src/images/${file} — add it to assets-src/images/alt.json`)
    process.exit(1)
  }
  const name = basename(file, extname(file)).toLowerCase().replace(/[^a-z0-9-]+/g, '-')
  const input = sharp(join(SRC, file)).rotate() // honour EXIF orientation, then strip metadata
  const { width: w0 = 0, height: h0 = 0 } = await input.metadata()
  const widths = WIDTHS.filter((w) => w <= w0)
  if (!widths.length) widths.push(w0)
  const srcset = { avif: [], webp: [] }
  for (const w of widths) {
    for (const fmt of ['avif', 'webp']) {
      const out = join(OUT, `${name}-${w}.${fmt}`)
      if (!existsSync(out)) {
        await sharp(join(SRC, file)).rotate().resize({ width: w })[fmt]({ quality: fmt === 'avif' ? 50 : 72 }).toFile(out)
      }
      srcset[fmt].push(`/images/g/${name}-${w}.${fmt} ${w}w`)
    }
  }
  const largest = widths[widths.length - 1]
  manifest.push({
    src: `/images/g/${name}-${largest}.webp`,
    alt: alt.trim(),
    width: largest,
    height: Math.round((h0 / w0) * largest),
    avif: srcset.avif.join(', '),
    webp: srcset.webp.join(', '),
  })
}
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')

// ─── 2. Hero poster (matches the 3D iris) ────────────────────────
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
}
function posterSvg(W, H) {
  const r = rng(42)
  // Matches HeroScene layout: iris right of the copy on landscape, top-centre on portrait.
  const portrait = H > W
  const cx = portrait ? W * 0.5 : W * 0.7
  const cy = portrait ? H * 0.3 : H * 0.5
  const s = portrait ? W / 5.4 : Math.min(W, H) / 5.2
  let fibers = ''
  for (let i = 0; i < 900; i++) {
    const a = r() * Math.PI * 2
    const r0 = s * (1.0 + r() * 0.15)
    const r1 = s * (1.35 + Math.pow(r(), 0.8) * 0.8)
    const t = (r1 / s - 1.35) / 0.8
    const col = t < 0.35 ? '#e9c27a' : '#5eead4'
    fibers += `<line x1="${(cx + Math.cos(a) * r0).toFixed(1)}" y1="${(cy + Math.sin(a) * r0).toFixed(1)}" x2="${(cx + Math.cos(a) * r1).toFixed(1)}" y2="${(cy + Math.sin(a) * r1).toFixed(1)}" stroke="${col}" stroke-opacity="${(0.08 + r() * 0.3).toFixed(2)}" stroke-width="${(0.6 + r() * 1.4).toFixed(1)}"/>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bg" cx="${cx / W}" cy="0.5" r="0.9"><stop offset="0" stop-color="#12283d"/><stop offset="0.55" stop-color="#0b1b2b"/><stop offset="1" stop-color="#06111c"/></radialGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#5eead4" stop-opacity="0.18"/><stop offset="1" stop-color="#5eead4" stop-opacity="0"/></radialGradient>
    <radialGradient id="lens" cx="0.38" cy="0.32" r="0.75"><stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.03"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <circle cx="${cx}" cy="${cy}" r="${s * 3}" fill="url(#glow)"/>
  ${fibers}
  <circle cx="${cx}" cy="${cy}" r="${s * 0.98}" fill="#03080e"/>
  <circle cx="${cx}" cy="${cy}" r="${s * 2.4}" fill="url(#lens)" stroke="#e9c27a" stroke-opacity="0.55" stroke-width="2.5"/>
  <circle cx="${cx}" cy="${cy}" r="${s * 2.45}" fill="none" stroke="#5eead4" stroke-opacity="0.12" stroke-width="1"/>
</svg>`
}
for (const [w, h] of [
  [800, 1200],
  [1600, 1000],
]) {
  const svg = Buffer.from(posterSvg(w, h))
  const tag = w < h ? 'portrait' : 'landscape'
  await sharp(svg).avif({ quality: 45 }).toFile(join(PUB, `posters/hero-${tag}.avif`))
  await sharp(svg).webp({ quality: 70 }).toFile(join(PUB, `posters/hero-${tag}.webp`))
}

// ─── 3. Favicons + OG image ──────────────────────────────────────
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0b1b2b"/><path d="M8 32s8-13 24-13 24 13 24 13-8 13-24 13S8 32 8 32Z" fill="none" stroke="#5eead4" stroke-width="3.2" stroke-linejoin="round"/><circle cx="32" cy="32" r="8.5" fill="none" stroke="#e9c27a" stroke-width="3.2"/><circle cx="32" cy="32" r="3" fill="#5eead4"/></svg>`
writeFileSync(join(PUB, 'favicon.svg'), favicon)
const fav = Buffer.from(favicon)
await sharp(fav).resize(180, 180).png().toFile(join(PUB, 'apple-touch-icon.png'))
await sharp(fav).resize(192, 192).png().toFile(join(PUB, 'icon-192.png'))
await sharp(fav).resize(512, 512).png().toFile(join(PUB, 'icon-512.png'))
await sharp(fav).resize(32, 32).png().toFile(join(PUB, 'favicon-32.png'))

const og = Buffer.from(
  posterSvg(1200, 630).replace(
    '</svg>',
    `<text x="72" y="300" font-family="Georgia, serif" font-size="68" fill="#f4efe6">Drishti Eye Hospital</text><text x="74" y="364" font-family="Arial, sans-serif" font-size="30" fill="#a9b8c6">Dr. Sachin Sharma</text></svg>`,
  ),
)
await sharp(og).jpeg({ quality: 82, mozjpeg: true }).toFile(join(PUB, 'og-image.jpg'))

console.log(`images: ${manifest.length} gallery photo(s), poster, favicons, og-image ✓`)
