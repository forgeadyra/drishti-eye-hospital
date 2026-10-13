import { business, telHref, whatsappHref } from '../content/business'
import { ExternalLink } from './ExternalLink'
import { ArrowIcon, PhoneIcon, PinIcon, WhatsAppIcon } from './Icons'
import { Magnetic } from './Magnetic'

/**
 * Primary CTAs. Until the phone / WhatsApp numbers are supplied, those buttons fall back to
 * the contact section (never a broken tel: link).
 */
export function CtaGroup({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <Magnetic>
        <a className="btn-primary" href={telHref ?? '#contact'}>
          <PhoneIcon /> Call now
        </a>
      </Magnetic>
      <Magnetic>
        {whatsappHref ? (
          <ExternalLink className="btn-ghost" href={whatsappHref} aria-label="Chat on WhatsApp (opens in a new tab)">
            <WhatsAppIcon /> WhatsApp
          </ExternalLink>
        ) : (
          <a className="btn-ghost" href="#contact">
            <WhatsAppIcon /> WhatsApp
          </a>
        )}
      </Magnetic>
      <Magnetic>
        <ExternalLink
          className="btn-ghost"
          href={business.mapsUrl}
          aria-label="Get directions in Google Maps (opens in a new tab)"
        >
          <PinIcon /> Get directions <ArrowIcon className="size-4" />
        </ExternalLink>
      </Magnetic>
    </div>
  )
}
