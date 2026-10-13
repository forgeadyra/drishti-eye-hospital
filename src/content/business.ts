/**
 * SINGLE SOURCE OF TRUTH for every business fact on the site.
 *
 * Real values come only from the owner. Anything wrapped in {{DOUBLE_BRACES}}
 * is a placeholder: it renders visibly in the UI so it can't be missed, and it
 * is automatically left OUT of JSON-LD / meta tags (see `real()`).
 *
 * Verified so far (from the Google Maps listing the owner supplied):
 *   - name, doctor, map coordinates, Maps URL.
 */

export const PLACEHOLDER = /\{\{[A-Z0-9_]+\}\}/

/** Returns the value only if it is filled in (not a {{PLACEHOLDER}}). */
export function real<T extends string | undefined>(v: T): T | undefined {
  return v && !PLACEHOLDER.test(v) ? v : undefined
}

export interface OpeningHours {
  /** e.g. 'Mon–Sat' — shown to visitors */
  label: string
  /** e.g. '9:00 am – 7:00 pm' or 'Closed' */
  time: string
  /** schema.org days + 24h times, used for JSON-LD only when filled in */
  schema?: { days: string[]; opens: string; closes: string }
}

export interface Service {
  title: string
  description: string
}

export interface Fact {
  label: string
  /** Numeric facts animate as counters; leave undefined for text facts. */
  value?: number
  suffix?: string
  text?: string
}

export const business = {
  name: 'Drishti Eye Hospital',
  doctor: 'Dr. Sachin Sharma',
  doctorCredentials: '{{DOCTOR_QUALIFICATIONS}}',
  category: 'Eye Hospital',
  tagline: '{{TAGLINE}}',

  /** Display format, e.g. '+91 98765 43210' */
  phoneDisplay: '{{PHONE}}',
  /** E.164 digits only, e.g. '+919876543210' */
  phoneE164: '{{PHONE_E164}}',
  /** WhatsApp number, E.164 without '+', e.g. '919876543210' */
  whatsapp: '{{WHATSAPP_NUMBER}}',
  email: '{{EMAIL}}',

  address: {
    street: '{{STREET_ADDRESS}}',
    locality: '{{CITY}}',
    region: '{{STATE}}',
    postalCode: '{{PIN_CODE}}',
    country: 'IN',
  },

  geo: { lat: 27.498988, lng: 77.6403933 },
  mapsUrl: 'https://maps.app.goo.gl/qRNeQ3uUkCz6wjrYA',

  hours: [
    { label: '{{DAYS_1}}', time: '{{HOURS_1}}' },
    { label: '{{DAYS_2}}', time: '{{HOURS_2}}' },
  ] as OpeningHours[],

  about: [
    '{{ABOUT_PARAGRAPH_1}}',
    '{{ABOUT_PARAGRAPH_2}}',
  ],

  services: [
    { title: '{{SERVICE_1}}', description: '{{SERVICE_1_DESCRIPTION}}' },
    { title: '{{SERVICE_2}}', description: '{{SERVICE_2_DESCRIPTION}}' },
    { title: '{{SERVICE_3}}', description: '{{SERVICE_3_DESCRIPTION}}' },
    { title: '{{SERVICE_4}}', description: '{{SERVICE_4_DESCRIPTION}}' },
    { title: '{{SERVICE_5}}', description: '{{SERVICE_5_DESCRIPTION}}' },
    { title: '{{SERVICE_6}}', description: '{{SERVICE_6_DESCRIPTION}}' },
  ] as Service[],

  /** Only real, verifiable facts. Never ratings, patient counts or success rates unless supplied. */
  facts: [
    { label: 'Years of practice', text: '{{YEARS_OF_PRACTICE}}' },
    { label: 'Led by', text: 'Dr. Sachin Sharma' },
    { label: 'Equipment', text: '{{KEY_EQUIPMENT}}' },
    { label: 'Specialities', text: '{{SPECIALITIES}}' },
  ] as Fact[],

  socials: [
    { label: 'Instagram', url: '{{INSTAGRAM_URL}}' },
    { label: 'Facebook', url: '{{FACEBOOK_URL}}' },
  ],
}

export type Business = typeof business

export const fullAddress = [
  business.address.street,
  business.address.locality,
  business.address.region,
  business.address.postalCode,
].join(', ')

export const telHref = real(business.phoneE164) ? `tel:${business.phoneE164}` : undefined
export const whatsappHref = real(business.whatsapp)
  ? `https://wa.me/${business.whatsapp}?text=${encodeURIComponent(
      `Hello ${business.name}, I would like to book an appointment.`,
    )}`
  : undefined

/** Keyless Google Maps embed centred on the verified coordinates. */
export const mapEmbedSrc = `https://www.google.com/maps?q=${business.geo.lat},${business.geo.lng}&z=17&output=embed`

export const SEO = {
  title: `${business.name} | ${business.doctor}`,
  description: `${business.name}, led by ${business.doctor}. Find our location, opening hours and contact details, call or WhatsApp us, or get directions.`,
}

/** JSON-LD — only includes fields that are actually filled in. */
export function localBusinessJsonLd(siteUrl: string) {
  const a = business.address
  const address = {
    '@type': 'PostalAddress',
    streetAddress: real(a.street),
    addressLocality: real(a.locality),
    addressRegion: real(a.region),
    postalCode: real(a.postalCode),
    addressCountry: a.country,
  }
  const hours = business.hours
    .map((h) => h.schema)
    .filter((s): s is NonNullable<OpeningHours['schema']> => Boolean(s))
    .map((s) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: s.days, opens: s.opens, closes: s.closes }))

  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalClinic',
    '@id': `${siteUrl}/#clinic`,
    name: business.name,
    url: siteUrl,
    image: `${siteUrl}/og-image.jpg`,
    telephone: real(business.phoneE164),
    email: real(business.email),
    address,
    geo: { '@type': 'GeoCoordinates', latitude: business.geo.lat, longitude: business.geo.lng },
    hasMap: business.mapsUrl,
    openingHoursSpecification: hours.length ? hours : undefined,
    employee: { '@type': 'Physician', name: business.doctor },
    sameAs: business.socials.map((s) => real(s.url)).filter(Boolean),
  }
}
