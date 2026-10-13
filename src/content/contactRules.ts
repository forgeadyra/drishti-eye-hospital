/**
 * Contact form rules — shared by the client form (fast feedback) and the serverless function
 * (the real enforcement, via zod). The client checks are a convenience only.
 */
export const CONTACT_LIMITS = {
  name: { min: 2, max: 80 },
  phone: { min: 7, max: 20 },
  message: { min: 10, max: 1000 },
  token: { max: 2048 },
  bodyBytes: 10 * 1024,
} as const

/** Digits, spaces, dashes, parentheses, optional leading +; 7–15 digits total (E.164 max is 15). */
export const PHONE_PATTERN = /^\+?[0-9\s\-()]{7,20}$/
export function phoneDigitsOk(phone: string): boolean {
  const n = phone.replace(/\D/g, '').length
  return n >= 7 && n <= 15
}

export const HONEYPOT_FIELD = 'website'

export interface ContactPayload {
  name: string
  phone: string
  message: string
  website: string
  turnstileToken: string
}
