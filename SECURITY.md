# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Email **{{SECURITY_CONTACT_EMAIL}}** with:
- a description of the issue and its impact;
- steps to reproduce (URL, request, payload);
- any logs or screenshots.

You'll get an acknowledgement within 3 working days. Please allow reasonable time for a fix before
any disclosure.

## Scope

- The website at the production domain and `*.netlify.app` deploys of this project.
- The contact endpoint `POST /api/contact` (`netlify/functions/contact.mts`).

Out of scope: third-party services (Netlify platform, Cloudflare Turnstile, Google Maps, Upstash,
Resend) — report those to the vendor.

## How this project handles security

- **Secrets** live only in Netlify environment variables (Functions scope). Nothing secret is ever
  prefixed `VITE_`, and `.env*` files are gitignored. CI runs gitleaks over the full history.
- **Contact form:** strict zod validation, sanitising/escaping, honeypot, server-side Turnstile,
  Upstash rate limit (5 / IP / 10 min), POST + JSON only, 10 KB limit, CORS locked to the production
  origin, generic error messages, no PII in logs. Fails closed if a secret is missing.
- **Headers:** strict CSP (no `unsafe-inline` / `unsafe-eval`; inline CSS allowed by sha256 hash only),
  HSTS, nosniff, Referrer-Policy, Permissions-Policy, `X-Frame-Options: DENY`.
- **Builds** fail on sourcemaps, `console.log`, exposed config/source files, secret-shaped strings,
  inline scripts/styles not covered by CSP, or an initial JS bundle over 250 KB gzip.

Full evidence: [SECURITY_REPORT.md](SECURITY_REPORT.md).

## If a secret leaks

1. **Rotate it first** at the provider (Cloudflare / Upstash / Resend) — removing it from git history
   is not enough on its own.
2. Update the Netlify environment variable and redeploy.
3. Then clean history if needed, and re-run `gitleaks git --redact .`.
