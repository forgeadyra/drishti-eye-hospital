/**
 * Security headers — single source of truth.
 * Emitted to dist/_headers (served by Netlify) AND applied by `vite preview`,
 * so what we test locally is byte-for-byte what production sends.
 */

const csp = [
  "default-src 'self'",
  // No 'unsafe-inline', no 'unsafe-eval'. Turnstile is the only third-party script.
  "script-src 'self' https://challenges.cloudflare.com",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  // Google Maps embed + Turnstile challenge iframe only.
  'frame-src https://www.google.com https://challenges.cloudflare.com',
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

export const securityHeaders: Record<string, string> = {
  'Content-Security-Policy': csp,
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': [
    'accelerometer=()',
    'autoplay=()',
    'browsing-topics=()',
    'camera=()',
    'display-capture=()',
    'geolocation=()',
    'gyroscope=()',
    'hid=()',
    'magnetometer=()',
    'microphone=()',
    'midi=()',
    'payment=()',
    'serial=()',
    'usb=()',
    'xr-spatial-tracking=()',
  ].join(', '),
}

/** Netlify `_headers` file contents. */
export function netlifyHeadersFile(): string {
  const all = Object.entries(securityHeaders)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n')
  return [
    '/*',
    all,
    '',
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/fonts/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ].join('\n')
}
