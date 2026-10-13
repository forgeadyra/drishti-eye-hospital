import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { securityHeaders, netlifyHeadersFile } from './config/headers.ts'
import { business, localBusinessJsonLd, SEO } from './src/content/business.ts'

// Netlify sets URL (primary site URL) at build time. SITE_URL lets you override.
const siteUrl = (process.env.SITE_URL ?? process.env.URL ?? 'http://localhost:4173').replace(/\/$/, '')

/**
 * `vite preview` serves dist/ with the exact headers Netlify will send (dist/_headers, which includes
 * the CSP hash of the inlined stylesheet). Falls back to the source headers before the first build.
 */
function distHeaders(): Record<string, string> {
  const file = resolve(import.meta.dirname, 'dist/_headers')
  if (!existsSync(file)) return securityHeaders
  const block = readFileSync(file, 'utf8').split(/\r?\n\r?\n/)[0] ?? ''
  return Object.fromEntries(
    block
      .split(/\r?\n/)
      .slice(1)
      .map((l) => l.trim().split(/:\s(.*)/s).slice(0, 2) as [string, string]),
  )
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

function seoPlugin(): Plugin {
  return {
    name: 'drishti-seo',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const isHome = ctx.path === '/index.html'
        const out = html
          .replaceAll('%SITE_URL%', siteUrl)
          .replaceAll('%TITLE%', escapeAttr(SEO.title))
          .replaceAll('%DESCRIPTION%', escapeAttr(SEO.description))
          .replaceAll('%NAME%', escapeAttr(business.name))
        if (!isHome) return out
        // application/ld+json is a non-executable data block: not affected by script-src CSP.
        const json = JSON.stringify(localBusinessJsonLd(siteUrl)).replace(/</g, '\u003c')
        return out.replace('</head>', `    <script type="application/ld+json">${json}</script>\n  </head>`)
      },
    },
    generateBundle() {
      const today = new Date().toISOString().slice(0, 10)
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
      })
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${siteUrl}/</loc><lastmod>${today}</lastmod></url>\n</urlset>\n`,
      })
      this.emitFile({ type: 'asset', fileName: '_headers', source: netlifyHeadersFile() })
    },
  }
}

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    react(),
    tailwindcss(),
    seoPlugin(),
    // `ANALYZE=1 npx vite build` → stats.json bundle breakdown (local only, never deployed)
    Boolean(process.env.ANALYZE) && !isSsrBuild && (visualizer({ filename: 'stats.json', template: 'raw-data', gzipSize: true }) as Plugin),
  ],
  define: { __BUILD_YEAR__: JSON.stringify(new Date().getFullYear()) },
  // Prerender bundle: inline all deps so Node can import it without resolution quirks.
  ssr: { noExternal: true },
  build: {
    target: 'es2022',
    sourcemap: false,
    cssCodeSplit: true,
    reportCompressedSize: true,
    rolldownOptions: {
      input: isSsrBuild
        ? undefined
        : {
            main: resolve(import.meta.dirname, 'index.html'),
            notFound: resolve(import.meta.dirname, '404.html'),
          },
      output: {
        minify: { compress: { dropConsole: true, dropDebugger: true } },
        // Long-term-cacheable vendor chunks. `three` is only reachable through the lazy HeroScene
        // import, so its chunk is never part of the initial load.
        codeSplitting: isSsrBuild
          ? undefined
          : {
              groups: [
                { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 4 },
                { name: 'motion', test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/, priority: 3 },
                { name: 'gsap', test: /node_modules[\\/](gsap|lenis)[\\/]/, priority: 2 },
                { name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 1 },
              ],
            },
      },
    },
    // three.js core is one ~690 KB (minified) module that can't be split further; it is lazy-loaded,
    // skipped on low-end / reduced-motion / no-WebGL, and gzip budgets are enforced in verify-dist.
    chunkSizeWarningLimit: 750,
  },
  preview: { port: 4173, strictPort: true, headers: distHeaders() },
  server: { port: 5173, strictPort: true },
}))
