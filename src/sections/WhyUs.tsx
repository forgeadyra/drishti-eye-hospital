import { business } from '../content/business'
import { Counter } from '../components/Counter'
import { SectionHeading } from '../components/SectionHeading'
import { Text } from '../components/Text'
import { useReveal } from '../lib/useReveal'

/** Only real, owner-supplied facts. Numeric facts count up; text facts reveal. */
export function WhyUs() {
  const ref = useReveal<HTMLElement>()
  return (
    <section id="why-us" ref={ref} tabIndex={-1} aria-labelledby="why-title" className="relative bg-navy py-24 outline-none md:py-36">
      <div className="container-x">
        <SectionHeading id="why-title" eyebrow="Why choose us">
          Why {business.name.split(' ')[0]}
        </SectionHeading>
        <dl className="grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {business.facts.map((f) => (
            <div key={f.label} data-reveal className="flex flex-col-reverse gap-3 bg-navy-2 p-8">
              <dt className="text-sm text-muted">{f.label}</dt>
              <dd className="h-display text-3xl md:text-4xl">
                {typeof f.value === 'number' ? (
                  <Counter value={f.value} suffix={f.suffix} />
                ) : (
                  <Text value={f.text ?? ''} />
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
