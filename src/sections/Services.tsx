import { business } from '../content/business'
import { SectionHeading } from '../components/SectionHeading'
import { Text } from '../components/Text'
import { TiltCard } from '../components/TiltCard'
import { useReveal } from '../lib/useReveal'

export function Services() {
  const ref = useReveal<HTMLElement>()
  return (
    <section id="services" ref={ref} tabIndex={-1} aria-labelledby="services-title" className="relative bg-navy py-24 outline-none md:py-36">
      <div className="container-x">
        <SectionHeading id="services-title" eyebrow="Services">
          What we offer
        </SectionHeading>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {business.services.map((s, i) => (
            <li key={i} data-reveal>
              <TiltCard className="card h-full overflow-hidden p-7 transition-colors duration-500 hover:border-accent/40">
                <span className="font-display text-sm text-accent">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-8 font-display text-2xl">
                  <Text value={s.title} />
                </h3>
                <p className="mt-3 text-muted">
                  <Text value={s.description} />
                </p>
              </TiltCard>
            </li>
          ))}
        </ul>
        <p className="mt-10 max-w-2xl text-sm text-muted" data-reveal>
          Please call or visit for consultation details. Information on this site is general and is not a
          substitute for an in-person eye examination.
        </p>
      </div>
    </section>
  )
}
