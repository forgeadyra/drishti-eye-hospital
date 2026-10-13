/**
 * POST /api/contact — the site's only backend.
 *
 * Order of checks (cheapest first, every request counts toward the rate limit):
 *   method → origin (CORS) → content-type → body size → rate limit → JSON + zod → honeypot
 *   → Turnstile (server-side verify) → sanitize → email.
 *
 * Responses are deliberately generic. Logs never contain name / phone / message / raw IP.
 * In production every secret is REQUIRED; if one is missing the function fails closed (500).
 */
import type { Config, Context } from '@netlify/functions'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { Resend } from 'resend'
import { CONTACT_LIMITS, HONEYPOT_FIELD, PHONE_PATTERN, phoneDigitsOk } from '../../src/content/contactRules.ts'

export const config: Config = { path: '/api/contact' }

const RATE = { max: 5, window: '10 m', windowMs: 10 * 60 * 1000 } as const
/** Cloudflare's documented always-pass test secret — used ONLY when running locally (context "dev"). */
const TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA'
const DEV_ORIGINS = ['http://localhost:8888', 'http://localhost:5173', 'http://localhost:4173']

// ─── validation ──────────────────────────────────────────────────
const L = CONTACT_LIMITS
const schema = z
  .object({
    name: z.string().trim().min(L.name.min).max(L.name.max),
    phone: z.string().trim().min(L.phone.min).max(L.phone.max).regex(PHONE_PATTERN).refine(phoneDigitsOk),
    message: z.string().trim().min(L.message.min).max(L.message.max),
    [HONEYPOT_FIELD]: z.string().max(200),
    turnstileToken: z.string().min(1).max(L.token.max),
  })
  .strict() // reject unexpected keys

/** Strip tags + control chars, collapse whitespace. Output is plain text. */
export function sanitize(input: string, multiline = false): string {
  let s = input.normalize('NFKC').replace(/<[^>]*>?/g, '')
  // eslint-disable-next-line no-control-regex
  s = s.replace(multiline ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, ' ')
  s = s.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '') // zero-width / bidi overrides
  s = multiline ? s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') : s.replace(/\s+/g, ' ')
  return s.trim()
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"'`=/]/g, (c) => `&#${c.charCodeAt(0)};`)
}

// ─── helpers ─────────────────────────────────────────────────────
const env = (k: string) => process.env[k]?.trim() || undefined
const hash = (v: string) => createHash('sha256').update(v).digest('hex').slice(0, 16)
const log = (evt: string, data: Record<string, unknown> = {}) =>
  console.info(JSON.stringify({ fn: 'contact', evt, ...data }))

function allowedOrigins(deployContext: string): string[] {
  const list = [env('ALLOWED_ORIGIN')]
  if (deployContext !== 'production') list.push(env('DEPLOY_PRIME_URL'), env('DEPLOY_URL'))
  if (deployContext === 'dev') list.push(...DEV_ORIGINS)
  return list.filter((o): o is string => Boolean(o)).map((o) => o.replace(/\/$/, ''))
}

function respond(status: number, body: object | null, origin: string | null, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    Vary: 'Origin',
    ...extra,
  }
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    headers['Access-Control-Allow-Headers'] = 'Content-Type'
    headers['Access-Control-Max-Age'] = '600'
  }
  if (body) headers['Content-Type'] = 'application/json; charset=utf-8'
  return new Response(body ? JSON.stringify(body) : null, { status, headers })
}

async function readBodyLimited(req: Request, limit: number): Promise<string | null> {
  const declared = Number(req.headers.get('content-length') ?? '0')
  if (declared > limit) return null
  if (!req.body) return ''
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > limit) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

// ─── rate limiting ───────────────────────────────────────────────
let upstash: Ratelimit | null = null
const memory = new Map<string, number[]>() // local dev only

async function limit(key: string, deployContext: string): Promise<{ ok: boolean; retryAfter: number } | 'misconfigured'> {
  if (env('UPSTASH_REDIS_REST_URL') && env('UPSTASH_REDIS_REST_TOKEN')) {
    upstash ??= new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(RATE.max, RATE.window),
      prefix: 'drishti:contact',
    })
    const r = await upstash.limit(key)
    return { ok: r.success, retryAfter: Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)) }
  }
  if (deployContext !== 'dev') return 'misconfigured'
  const now = Date.now()
  const hits = (memory.get(key) ?? []).filter((t) => now - t < RATE.windowMs)
  hits.push(now)
  memory.set(key, hits)
  const oldest = hits[0] ?? now
  return { ok: hits.length <= RATE.max, retryAfter: Math.ceil((oldest + RATE.windowMs - now) / 1000) }
}

async function verifyTurnstile(token: string, ip: string, secret: string): Promise<boolean> {
  const body = new FormData()
  body.append('secret', secret)
  body.append('response', token)
  if (ip) body.append('remoteip', ip)
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
    })
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}

// ─── handler ─────────────────────────────────────────────────────
export default async function handler(req: Request, context: Context): Promise<Response> {
  const deployContext = context.deploy?.context ?? 'production'
  const isDev = deployContext === 'dev'
  const ip = context.ip ?? ''
  const ipKey = hash(ip || 'unknown')

  // CORS: only the production domain (plus this deploy's own URL on previews, localhost in dev).
  const origin = req.headers.get('origin')?.replace(/\/$/, '') ?? null
  const allowed = allowedOrigins(deployContext)
  if (!allowed.length) {
    log('misconfigured', { missing: 'ALLOWED_ORIGIN' })
    return respond(500, { ok: false, error: 'Something went wrong.' }, null)
  }
  const originOk = origin !== null && allowed.includes(origin)

  if (req.method === 'OPTIONS') {
    return originOk ? respond(204, null, origin) : respond(403, null, null)
  }
  if (req.method !== 'POST') return respond(405, { ok: false, error: 'Method not allowed.' }, null, { Allow: 'POST, OPTIONS' })
  if (!originOk) {
    log('rejected', { reason: 'origin', ipKey })
    return respond(403, { ok: false, error: 'Forbidden.' }, null)
  }
  const ct = req.headers.get('content-type') ?? ''
  if (!/^application\/json\s*(;\s*charset=utf-8\s*)?$/i.test(ct)) {
    return respond(415, { ok: false, error: 'Unsupported content type.' }, origin)
  }
  const raw = await readBodyLimited(req, L.bodyBytes)
  if (raw === null) return respond(413, { ok: false, error: 'Request too large.' }, origin)

  const rl = await limit(ipKey, deployContext)
  if (rl === 'misconfigured') {
    log('misconfigured', { missing: 'UPSTASH_REDIS_REST_URL/TOKEN' })
    return respond(500, { ok: false, error: 'Something went wrong.' }, origin)
  }
  if (!rl.ok) {
    log('rate_limited', { ipKey })
    return respond(429, { ok: false, error: 'Too many requests. Please try again later.' }, origin, {
      'Retry-After': String(rl.retryAfter),
    })
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return respond(400, { ok: false, error: 'Invalid request.' }, origin)
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    // Log which fields failed, never their values.
    log('invalid', { ipKey, fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? 'body')))] })
    return respond(400, { ok: false, error: 'Please check the form and try again.' }, origin)
  }
  const data = parsed.data

  // Honeypot: pretend success so bots learn nothing; nothing is sent.
  if (data[HONEYPOT_FIELD].length > 0) {
    log('honeypot', { ipKey })
    return respond(200, { ok: true }, origin)
  }

  const secret = env('TURNSTILE_SECRET_KEY') ?? (isDev ? TURNSTILE_TEST_SECRET : undefined)
  if (!secret) {
    log('misconfigured', { missing: 'TURNSTILE_SECRET_KEY' })
    return respond(500, { ok: false, error: 'Something went wrong.' }, origin)
  }
  if (!(await verifyTurnstile(data.turnstileToken, ip, secret))) {
    log('turnstile_failed', { ipKey })
    return respond(403, { ok: false, error: 'Verification failed. Please try again.' }, origin)
  }

  const name = sanitize(data.name)
  const phone = sanitize(data.phone)
  const message = sanitize(data.message, true)
  if (name.length < L.name.min || message.length < L.message.min) {
    log('invalid', { ipKey, fields: ['sanitized'] })
    return respond(400, { ok: false, error: 'Please check the form and try again.' }, origin)
  }

  const apiKey = env('RESEND_API_KEY')
  const to = env('CONTACT_TO_EMAIL')
  const from = env('CONTACT_FROM_EMAIL')
  if (!apiKey || !to || !from) {
    if (isDev) {
      log('email_skipped_dev', { ipKey, chars: message.length })
      return respond(200, { ok: true }, origin)
    }
    log('misconfigured', { missing: 'RESEND_API_KEY/CONTACT_TO_EMAIL/CONTACT_FROM_EMAIL' })
    return respond(500, { ok: false, error: 'Something went wrong.' }, origin)
  }

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to,
      subject: 'New website enquiry',
      text: `Name: ${name}\nPhone: ${phone}\n\nMessage:\n${message}\n`,
      html: `<p><strong>Name:</strong> ${escapeHtml(name)}<br><strong>Phone:</strong> ${escapeHtml(phone)}</p><p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
    })
    if (error) throw new Error(error.name)
  } catch (e) {
    log('email_failed', { ipKey, reason: e instanceof Error ? e.message : 'unknown' })
    return respond(502, { ok: false, error: 'Something went wrong. Please call us instead.' }, origin)
  }

  log('sent', { ipKey })
  return respond(200, { ok: true }, origin)
}
