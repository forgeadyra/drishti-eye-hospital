# Security & Verification Report — Drishti Eye Hospital website

**Date:** 2026-10-13 · **Commit scanned:** see `git log` · **Environment:** Windows 11, Node 26.3.1, Chrome (local install)

Legend: **PASS** = verified with evidence below · **PENDING** = cannot be verified until an external
account / deploy exists (nothing is failing; the check is ready to run) · **FAIL** = none.

> Where something was verified locally rather than on a real Netlify deploy, it is stated explicitly.
> No preview deploy has been made yet (that publishes the site, so it needs your go-ahead).

---

## Summary

| # | Item | Result |
|---|------|--------|
| 1 | Secrets handling (no secrets in `VITE_*`, `.env.example`, `.env*` ignored before first commit) | **PASS** |
| 2a | Contact: zod server-side validation | **PASS** |
| 2b | Contact: sanitize / escape input, strip HTML | **PASS** |
| 2c | Contact: honeypot | **PASS** |
| 2d | Contact: Turnstile verified server-side | **PASS** (Cloudflare test secrets) |
| 2e | Contact: rate limit 5 / IP / 10 min → 429 | **PASS** (handler level) · **PENDING** end-to-end via Upstash |
| 2f | Contact: POST only, JSON only, 10 KB body limit | **PASS** |
| 2g | Contact: CORS restricted to production domain | **PASS** |
| 2h | Contact: generic client errors, no PII in logs | **PASS** |
| 3 | Security headers (CSP, HSTS, nosniff, Referrer, Permissions, XFO) | **PASS** (Netlify emulator) · **PENDING** `curl -I` on a real preview deploy |
| 4 | Production build: no sourcemaps, no console.log, no debug flags | **PASS** |
| 5 | Dependencies: latest stable*, depcheck, `npm audit`, lockfile committed | **PASS** (*2 justified pins, see §5) |
| 6 | No `.env`, `.git`, sourcemaps or config served | **PASS** |
| 7 | gitleaks on full git history | **PASS** — no secrets, nothing to rotate |
| 8 | Every `target="_blank"` has `rel="noopener noreferrer"` | **PASS** |

---

## 1. Secrets — PASS

- The only `VITE_` variable is `VITE_TURNSTILE_SITE_KEY`, a Turnstile **site** key, which Cloudflare designs to be public.
- All secrets live only in the function's server-side environment and are read with `process.env` in `netlify/functions/contact.mts`. They are `TURNSTILE_SECRET_KEY`, `UPSTASH_REDIS_REST_URL/TOKEN`, `RESEND_API_KEY` and `CONTACT_TO_EMAIL/FROM_EMAIL`. The client bundle never imports that file.
- `.env.example` contains variable names only.
- `.gitignore` (which ignores `.env` and `.env.*` but allows `.env.example`) was written as the first file, before `git init`'s first commit:
  ```
  $ git check-ignore -v .env .env.local
  .gitignore:11:.env    .env
  .gitignore:12:.env.*  .env.local
  ```
- **Build gate:** `scripts/verify-dist.mjs` fails the build if any server env name or a secret-shaped value (Resend key, Turnstile secret, private key) appears in `dist/`. Last run: `verify-dist: all checks passed ✓`.

## 2. Contact form → `netlify/functions/contact.mts`

Evidence for all of 2a–2h comes from `npm run test:contact`. The test file is `scripts/test-contact.mjs`, which calls the real handler with real `Request` objects. Turnstile is checked against Cloudflare's live `siteverify` endpoint.

```
PASS  valid submission → 200
PASS  CORS echoes only the allowed origin
PASS  invalid input (name too short) → 400 generic
PASS  invalid input (name too long) → 400 generic
PASS  invalid input (phone letters) → 400 generic
PASS  invalid input (phone too few digits) → 400 generic
PASS  invalid input (phone too many digits) → 400 generic
PASS  invalid input (message too short) → 400 generic
PASS  invalid input (message too long) → 400 generic
PASS  invalid input (wrong type (number)) → 400 generic
PASS  invalid input (missing field) → 400 generic
PASS  invalid input (unexpected extra key) → 400 generic
PASS  malformed JSON → 400
PASS  name that is only HTML → rejected after sanitising
PASS  honeypot filled → silent 200, nothing sent
PASS  6 rapid submits → first 5 OK, 6th is 429      — statuses=200,200,200,200,200,429
PASS  429 includes Retry-After                       — retry-after=600
PASS  other IPs unaffected by the limit
PASS  GET → 405 with Allow header
PASS  PUT → 405
PASS  non-JSON content-type → 415
PASS  form-encoded body → 415
PASS  body > 10 KB → 413
PASS  foreign Origin → 403, no CORS header
PASS  missing Origin → 403
PASS  CORS preflight from allowed origin → 204
PASS  CORS preflight from foreign origin → 403
PASS  Turnstile verification failure → 403 (server-side siteverify)
PASS  production without Upstash/Turnstile/Resend secrets → 500 (fails closed)
PASS  production rejects localhost origins
PASS  sanitize strips tags
PASS  sanitize strips control + bidi chars
PASS  escapeHtml escapes markup
PASS  server logs contain no name / phone / message / raw IP
34/34 contact-function checks passed
```

The same flows were then re-run over HTTP through Netlify's own runtime (`netlify dev`, serving `dist/`):

```
valid          → {"ok":true} 200
invalid        → {"ok":false,"error":"Please check the form and try again."} 400
honeypot       → {"ok":true} 200   (log: {"evt":"honeypot","ipKey":"eff8e7ca…"} — nothing sent)
GET            → 405
foreign Origin → 403
```

- **2a zod:** `.strict()` schema with types and lengths. The phone must match a pattern and contain 7–15 digits. Unknown keys are rejected.
- **2b Sanitize:** NFKC-normalises the input, strips tags, control characters, zero-width and bidi-override characters, and collapses whitespace. The email is sent as plain text, and the HTML part is fully entity-escaped. The subject is a fixed string and there is no reply-to built from user input, so header injection isn't possible.
- **2c Honeypot:** a hidden `website` field (off-screen, `aria-hidden`, `tabindex=-1`). If it's filled, the function returns a fake 200 and sends nothing.
- **2d Turnstile:** the token is verified server-side with `siteverify` (secret plus `remoteip`, 5 s timeout). Failure returns 403. In production a missing secret returns 500. Cloudflare's always-pass test secret is used only when the deploy context is `dev`.
- **2e Rate limit:** Upstash sliding window, 5 requests per 10 minutes, keyed on a SHA-256 hash of the IP (raw IPs are never stored). The limiter runs **before** parsing and Turnstile, so every request counts. Responses are 429 with `Retry-After`.
  - **PENDING, end to end.** The tests above used the dev-only in-memory limiter, which is the same code path apart from the store.
  - Through `netlify dev`, 6 rapid HTTP posts all returned 200. Each invocation runs in a fresh worker, so in-memory state can't persist there, and the same is true across production Lambda instances.
  - That is exactly why production **requires** Upstash and fails closed (500) without it, as tested above. Once Upstash is configured on a deploy, run:
    `node scripts/test-ratelimit.mjs https://<deploy-preview-url>` (expects request 6 → 429).
- **2f:** non-POST requests get 405 (OPTIONS is allowed for preflight). Only `application/json` is accepted (otherwise 415). The body is limited to 10 KB, enforced while streaming as well as via `Content-Length`; over the limit returns 413.
- **2g CORS:** `Access-Control-Allow-Origin` is set only for `ALLOWED_ORIGIN`, plus that deploy's own URL on preview or branch deploys and localhost in `dev`. Any other origin, or a missing `Origin`, gets 403.
- **2h:** clients only ever see generic messages. Logs are one JSON line per event (event name, field names on validation failure, hashed IP) and never contain values.
- **Client-side hardening:** the submit button is disabled until hydration, and the form has `method="post"`. A pre-hydration submit therefore can never fall back to a GET that puts PII in the URL.

## 3. Security headers — PASS (local Netlify runtime) · PENDING on a real deploy

All headers come from one module, `config/headers.ts`. At build time it is written to `dist/_headers`, which Netlify serves, and `vite preview` reads that same file.

`curl -I http://localhost:8888/` against **`netlify dev` serving `dist/`**:

```
HTTP/1.1 200 OK
Content-Security-Policy: default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'sha256-OlSNiotr1g2iS+59C1+pxXfy29SCXobI3NV+xlr/Leg='; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-src https://www.google.com https://challenges.cloudflare.com; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
Cross-Origin-Opener-Policy: same-origin
Permissions-Policy: accelerometer=(), autoplay=(), browsing-topics=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), hid=(), magnetometer=(), microphone=(), midi=(), payment=(), serial=(), usb=(), xr-spatial-tracking=()
```

CSP notes:
- **No `unsafe-inline`, no `unsafe-eval`, no inline scripts.**
  - The critical CSS is inlined for performance and allowed by its **sha256 hash only**. The hash is regenerated on every build and checked by `verify-dist`.
  - JSON-LD is a non-executable `application/ld+json` data block, which `script-src` doesn't apply to.
  - The app bundle is loaded by an external `boot-*.js` file, not an inline script.
- The prerendered HTML contains **zero `style=""` attributes**. That's enforced by `verify-dist`, so `style-src` needs no exception. Runtime animation styles are written via the CSSOM, which CSP doesn't govern.
- **Third parties are limited to exact hosts:** Turnstile (`challenges.cloudflare.com`) and the Google Maps embed (`www.google.com`). Fonts are self-hosted, so no font CDN is needed.
- The browser QA run reported **0 CSP violations** across all scenarios (a `securitypolicyviolation` listener was installed in every page).
- The function's own responses add `Cache-Control: no-store`, `nosniff` and `CSP: default-src 'none'; frame-ancestors 'none'`.

**PENDING:** run `curl -I https://<deploy-preview-url>/` once a preview deploy exists.

## 4. Production build — PASS

- `build.sourcemap: false`. `verify-dist` fails the build on any `.map` file or `sourceMappingURL` comment.
- `console.*` and `debugger` are stripped by the minifier (`dropConsole`, `dropDebugger`). `verify-dist` also greps every shipped JS file for `console.log(` and `debugger`.
- ESLint's `no-console: error` and `no-debugger: error` apply to `src/`.
- There are no debug flags, query-string overrides or dev tools in production code. The analyzer plugin only runs with `ANALYZE=1` and only writes a local `stats.json`, which is gitignored.

## 5. Dependencies — PASS

```
$ npm audit
found 0 vulnerabilities
$ npm run check:deps   (depcheck 1.4.7)
No depcheck issue
```
- The lockfile (`package-lock.json`) is committed. All versions are pinned exactly.
- **Two deliberate deviations from "latest":**
  - **TypeScript 6.0.3** instead of 7.0.2, because `typescript-eslint` 8.71 supports `typescript <6.1`.
  - **ESLint 9.39.5** instead of 10.x, because `eslint-plugin-jsx-a11y` supports ESLint ≤ 9.
  - Both are the newest versions compatible with the rest of the toolchain.
- **Removed for security:** `netlify-cli` and `depcheck` pulled in 18 high-severity advisories (micromatch/braces, node-forge, an old sharp via ipx). Both are local developer tools only, so they were dropped from `package.json` and run on demand with a pinned `npx`. The committed dependency tree audits clean.

## 6. Exposed files — PASS

`verify-dist` checks `dist/` on every build for `.map`, `.env*`, `.git`, `.ts/.tsx/.mts`, `package*.json`, `netlify.toml`, `vite.config.*`, `tsconfig*` and the ESLint config. Over HTTP via `netlify dev`:

```
.env                   404
.env.example           404
.git/config            404
package.json           404
vite.config.ts         404
netlify.toml           404
src/main.tsx           404
assets/main.js.map     404
tsconfig.json          404
```

## 7. Git history — PASS (nothing to rotate)

```
$ gitleaks version → 8.30.1
$ gitleaks git --redact .
INF 1 commits scanned.  INF no leaks found
$ gitleaks dir --redact .      → no leaks found   (working tree incl. untracked)
$ gitleaks dir --redact dist   → no leaks found   (built output)
```
No secret has ever been committed, so **no keys need rotating**.

## 8. External links — PASS

- `<ExternalLink>` is the only component allowed to render `target="_blank"`, and it always sets `rel="noopener noreferrer"`. An ESLint `no-restricted-syntax` rule fails lint on a raw `target="_blank"` anywhere else.
- `verify-dist` also checks every `target="_blank"` in the built HTML.

---

## Final verification results

| Check | Result | Evidence |
|---|---|---|
| `npm run build` (0 TS errors, 0 warnings) | **PASS** | exit 0; `grep -ciE "warn\|(!)" build.log` → `0` |
| ESLint (`--max-warnings 0`) | **PASS** | exit 0, no output |
| `tsc -b --force` | **PASS** | exit 0, no output |
| `npm audit` (0 high/critical) | **PASS** | `found 0 vulnerabilities` |
| gitleaks | **PASS** | `no leaks found` |
| Lighthouse mobile (3 runs, simulated 4G) | **PASS** | see below |
| Form: valid / invalid / honeypot / 6 rapid → 429 | **PASS** (429 at handler level; Upstash end-to-end PENDING) | §2 |
| `curl -I` headers | **PASS** on Netlify runtime locally · **PENDING** on a deploy | §3 |
| Reduced motion | **PASS** | no canvas, no intro, all content visible, 0 errors |
| WebGL disabled (`--disable-3d-apis --disable-webgl`) | **PASS** | poster shown and loaded, no canvas, 0 errors |
| Low-end device (`hardwareConcurrency = 4`) | **PASS** | poster instead of 3D |
| 360 / 768 / 1440 px | **PASS** | 0 px horizontal overflow at each width; mobile menu is a dialog with focus trap, Esc closes and returns focus |
| Bundle budget | **PASS** | initial JS **165.0 KB gzip** (budget 250); 3D lazy: three 180.9 KB + scene 55.6 KB; 3D models 0 KB (procedural) |

**Lighthouse (mobile, Lighthouse 13.5, defaults: simulated slow 4G + 4× CPU), against the production build served by `vite preview` with production headers:**

```
run 1: perf 99  a11y 100  bp 100  seo 100   LCP 1.6 s  CLS 0  TBT 90 ms   FCP 1.4 s
run 2: perf 99  a11y 100  bp 100  seo 100   LCP 1.6 s  CLS 0  TBT 110 ms  FCP 1.4 s
run 3: perf 98  a11y 100  bp 100  seo 100   LCP 1.5 s  CLS 0  TBT 140 ms  FCP 1.4 s
PASS performance 99 (≥85) · accessibility 100 (≥95) · best-practices 100 (≥95) · seo 100 (≥95) · LCP 1.6 s (<2.5) · CLS 0 (<0.1)
```

**What it took to reach the budget.** The first Lighthouse run **failed**: Performance 79, LCP 2.9 s, CLS 0.225, and an `aria-prohibited-attr` audit. The fixes were:
- metric-matched fallback fonts (CLS 0.225 → 0);
- CSS inlined under a CSP hash;
- the app bundle loaded after first paint;
- the poster set to low fetch priority;
- the Fraunces italic face dropped (−47 KB);
- SplitText's `aria-label` on `<p>` removed.

## Honest caveats

1. **Lighthouse doesn't measure the 3D scene.**
   - By design the 3D chunk (~236 KB gzip) loads only after the visitor interacts or after about 2.5 s of idle on a capable device. Lighthouse doesn't interact, so it never loads during the run.
   - On real low-end phones (≤4 cores or ≤4 GB) it never loads at all.
   - On desktop it loads after the first mouse move. Its cost on capable machines has not been measured by Lighthouse.
2. **Everything was measured locally.**
   - Lighthouse ran on `localhost`, so real network/CDN variance isn't included. Re-run `npm run lighthouse -- https://<deploy-preview-url>/` after deploying.
   - An earlier local run (before the final changes) produced one LCP outlier of 2.8 s in 3 runs. The final 3 runs were all ≤ 1.6 s.
3. **3D was tested in software.** Headless Chrome renders WebGL with SwiftShader. Visuals were checked from screenshots; GPU timing was not measured.
4. **Browser coverage.** Only Chromium was tested. Safari and Firefox have not been tested.
5. **The fallback-font metrics** are tuned for Georgia and Arial, which Windows and macOS have and Android generally doesn't. A small font-swap shift is possible on Android until Fraunces/Inter load (Lighthouse emulation measured CLS 0).
6. **The Google Maps embed** sets third-party cookies once a visitor scrolls to it. It is lazy-loaded, so Lighthouse didn't see it.
7. **Content isn't final.**
   - 37 `{{PLACEHOLDERS}}` remain visible on the page by design.
   - Turnstile is still on Cloudflare's **test** site key, so `VITE_TURNSTILE_SITE_KEY` must be set before launch.
   - There are no gallery photos yet.
8. **`vite preview` answers unknown paths with `index.html` (200).** Netlify serves `404.html` with status **404**, which was verified via `netlify dev` (`/nope → 404`, `<h1>This page is out of focus.`).
