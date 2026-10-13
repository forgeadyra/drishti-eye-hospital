import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { business, telHref, whatsappHref } from '../content/business'
import { CONTACT_LIMITS, HONEYPOT_FIELD, PHONE_PATTERN, phoneDigitsOk, type ContactPayload } from '../content/contactRules'
import { ExternalLink } from '../components/ExternalLink'
import { PhoneIcon, WhatsAppIcon } from '../components/Icons'
import { Magnetic } from '../components/Magnetic'
import { SectionHeading } from '../components/SectionHeading'
import { Text } from '../components/Text'
import { loadTurnstile, TURNSTILE_SITE_KEY } from '../lib/turnstile'
import { useMounted } from '../lib/useMounted'
import { useReveal } from '../lib/useReveal'
import { curves, duration } from '../motion/config'

type Field = 'name' | 'phone' | 'message'
type Status = 'idle' | 'sending' | 'success' | 'error' | 'rate-limited'

function validate(v: Record<Field, string>): Partial<Record<Field, string>> {
  const e: Partial<Record<Field, string>> = {}
  const L = CONTACT_LIMITS
  if (v.name.trim().length < L.name.min || v.name.length > L.name.max)
    e.name = `Please enter your name (${L.name.min}–${L.name.max} characters).`
  if (!PHONE_PATTERN.test(v.phone.trim()) || !phoneDigitsOk(v.phone)) e.phone = 'Please enter a valid phone number.'
  if (v.message.trim().length < L.message.min || v.message.length > L.message.max)
    e.message = `Please write ${L.message.min}–${L.message.max} characters.`
  return e
}

const inputCls =
  'mt-2 block w-full rounded-2xl border border-white/15 bg-ink/60 px-4 py-3 text-cream placeholder:text-muted/70 transition-colors duration-300 focus:border-accent focus:outline-none aria-[invalid=true]:border-danger'

export function Contact() {
  const ref = useReveal<HTMLElement>()
  const hydrated = useMounted()
  const form = useRef<HTMLFormElement>(null)
  const widget = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | undefined>(undefined)
  const [token, setToken] = useState('')
  const [captchaError, setCaptchaError] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [status, setStatus] = useState<Status>('idle')

  // Load Turnstile only when the form approaches the viewport.
  useEffect(() => {
    const el = widget.current
    if (!el) return
    let cancelled = false
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return
        io.disconnect()
        loadTurnstile()
          .then((ts) => {
            if (cancelled || widgetId.current) return
            widgetId.current = ts.render(el, {
              sitekey: TURNSTILE_SITE_KEY,
              theme: 'dark',
              callback: (t) => {
                setToken(t)
                setCaptchaError(false)
              },
              'expired-callback': () => setToken(''),
              'error-callback': () => setCaptchaError(true),
            })
          })
          .catch(() => !cancelled && setCaptchaError(true))
      },
      { rootMargin: '300px 0px' },
    )
    io.observe(el)
    return () => {
      cancelled = true
      io.disconnect()
      if (widgetId.current) window.turnstile?.remove(widgetId.current)
      widgetId.current = undefined
    }
  }, [])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const values = {
      name: String(fd.get('name') ?? ''),
      phone: String(fd.get('phone') ?? ''),
      message: String(fd.get('message') ?? ''),
    }
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length) {
      const first = Object.keys(found)[0]
      form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
      return
    }
    if (!token) {
      setCaptchaError(true)
      return
    }
    setStatus('sending')
    const payload: ContactPayload = {
      ...values,
      website: String(fd.get(HONEYPOT_FIELD) ?? ''),
      turnstileToken: token,
    }
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setStatus('success')
        form.current?.reset()
      } else setStatus(res.status === 429 ? 'rate-limited' : 'error')
    } catch {
      setStatus('error')
    } finally {
      setToken('')
      if (widgetId.current) window.turnstile?.reset(widgetId.current)
    }
  }

  const fieldProps = (f: Field) => ({
    id: `contact-${f}`,
    name: f,
    'aria-invalid': Boolean(errors[f]),
    'aria-describedby': errors[f] ? `contact-${f}-error` : undefined,
    className: inputCls,
  })

  return (
    <section id="contact" ref={ref} tabIndex={-1} aria-labelledby="contact-title" className="relative bg-navy py-24 outline-none md:py-36">
      <div className="container-x grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SectionHeading id="contact-title" eyebrow="Contact">
            Get in touch
          </SectionHeading>
          <p className="max-w-md text-muted" data-reveal>
            Call or message us to book an appointment, or leave your number and we’ll call you back.
          </p>
          <div className="mt-8 flex flex-col items-start gap-3" data-reveal>
            <Magnetic>
              {telHref ? (
                <a href={telHref} className="btn-primary">
                  <PhoneIcon /> {business.phoneDisplay}
                </a>
              ) : (
                <span className="btn-ghost cursor-default">
                  <PhoneIcon /> <Text value={business.phoneDisplay} />
                </span>
              )}
            </Magnetic>
            {whatsappHref ? (
              <Magnetic>
                <ExternalLink href={whatsappHref} className="btn-ghost" aria-label="Chat on WhatsApp (opens in a new tab)">
                  <WhatsAppIcon /> WhatsApp us
                </ExternalLink>
              </Magnetic>
            ) : (
              <span className="btn-ghost cursor-default">
                <WhatsAppIcon /> <Text value={business.whatsapp} />
              </span>
            )}
          </div>
          <p className="mt-8 max-w-md text-sm text-muted" data-reveal>
            For a medical emergency, please go to the nearest emergency department. Don’t share
            medical records or sensitive health details through this form.
          </p>
        </div>

        <form
          ref={form}
          // Safety net: if submitted before hydration it must never fall back to GET (PII in URL).
          method="post"
          action="/api/contact"
          noValidate
          onSubmit={onSubmit}
          aria-describedby="contact-status"
          className="card relative space-y-5 p-6 sm:p-8 lg:col-span-6 lg:col-start-7"
          data-reveal
        >
          <div>
            <label htmlFor="contact-name" className="text-sm font-medium">
              Name
            </label>
            <input {...fieldProps('name')} type="text" autoComplete="name" maxLength={CONTACT_LIMITS.name.max} required />
            {errors.name && <p id="contact-name-error" className="mt-1.5 text-sm text-danger">{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="contact-phone" className="text-sm font-medium">
              Phone
            </label>
            <input
              {...fieldProps('phone')}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={CONTACT_LIMITS.phone.max}
              required
            />
            {errors.phone && <p id="contact-phone-error" className="mt-1.5 text-sm text-danger">{errors.phone}</p>}
          </div>
          <div>
            <label htmlFor="contact-message" className="text-sm font-medium">
              Message
            </label>
            <textarea {...fieldProps('message')} rows={5} maxLength={CONTACT_LIMITS.message.max} required />
            {errors.message && <p id="contact-message-error" className="mt-1.5 text-sm text-danger">{errors.message}</p>}
          </div>

          {/* Honeypot: invisible to people and assistive tech; bots that fill it are silently dropped server-side. */}
          <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
            <label htmlFor="contact-website">Website</label>
            <input id="contact-website" name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
          </div>

          <div ref={widget} id="turnstile-widget" className="min-h-[65px]" />
          {captchaError && <p className="text-sm text-danger">Please complete the verification above.</p>}

          <button type="submit" className="btn-primary w-full disabled:opacity-60" disabled={!hydrated || status === 'sending'}>
            {status === 'sending' ? 'Sending…' : 'Send message'}
          </button>

          <div id="contact-status" aria-live="polite" className="min-h-6">
            <AnimatePresence mode="wait">
              {status !== 'idle' && status !== 'sending' && (
                <m.p
                  key={status}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: duration.fast, ease: curves.out }}
                  className={status === 'success' ? 'text-accent' : 'text-danger'}
                >
                  {status === 'success' && 'Thank you. We’ll call you back soon.'}
                  {status === 'error' && 'Sorry, something went wrong. Please call us instead.'}
                  {status === 'rate-limited' && 'Too many attempts. Please wait a few minutes or call us.'}
                </m.p>
              )}
            </AnimatePresence>
          </div>
        </form>
      </div>
    </section>
  )
}
