import { useEffect, useRef, useState } from 'react'
import { business, fullAddress, mapEmbedSrc } from '../content/business'
import { ExternalLink } from '../components/ExternalLink'
import { ArrowIcon, ClockIcon, PinIcon } from '../components/Icons'
import { Magnetic } from '../components/Magnetic'
import { SectionHeading } from '../components/SectionHeading'
import { Text } from '../components/Text'
import { useReveal } from '../lib/useReveal'

export function Hours({ className = '' }: { className?: string }) {
  return (
    <dl className={`grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 ${className}`}>
      {business.hours.map((h, i) => (
        <div key={i} className="contents">
          <dt className="text-muted">
            <Text value={h.label} />
          </dt>
          <dd>
            <Text value={h.time} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function Location() {
  const ref = useReveal<HTMLElement>()
  const mapBox = useRef<HTMLDivElement>(null)
  const [loadMap, setLoadMap] = useState(false)

  // The Google Maps iframe (and its third-party requests) is only created when the section is near.
  useEffect(() => {
    const el = mapBox.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setLoadMap(true)
          io.disconnect()
        }
      },
      { rootMargin: '400px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section id="location" ref={ref} tabIndex={-1} aria-labelledby="location-title" className="relative py-24 outline-none md:py-36">
      <div className="container-x grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SectionHeading id="location-title" eyebrow="Location">
            Find us
          </SectionHeading>
          <address className="flex gap-3 not-italic" data-reveal>
            <PinIcon className="mt-1 shrink-0 text-accent" />
            <span>
              <span className="block font-medium">{business.name}</span>
              <span className="text-muted">
                <Text value={fullAddress} />
              </span>
            </span>
          </address>
          <div className="mt-8 flex gap-3" data-reveal>
            <ClockIcon className="mt-1 shrink-0 text-accent" />
            <div>
              <h3 className="font-medium">Opening hours</h3>
              <Hours className="mt-2" />
            </div>
          </div>
          <div className="mt-10" data-reveal>
            <Magnetic>
              <ExternalLink
                href={business.mapsUrl}
                className="btn-primary"
                aria-label="Get directions in Google Maps (opens in a new tab)"
              >
                <PinIcon /> Get directions <ArrowIcon className="size-4" />
              </ExternalLink>
            </Magnetic>
          </div>
        </div>

        <div className="lg:col-span-7" data-reveal>
          <div ref={mapBox} className="card relative aspect-[4/3] overflow-hidden lg:aspect-auto lg:h-full lg:min-h-[28rem]">
            {loadMap ? (
              <iframe
                title={`Map showing the location of ${business.name}`}
                src={mapEmbedSrc}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0 size-full border-0 grayscale-[0.4] invert-[0.9] hue-rotate-180"
              />
            ) : (
              <p className="absolute inset-0 grid place-items-center text-sm text-muted">Loading map…</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
