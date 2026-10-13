import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { business } from '../content/business'
import { SectionHeading } from '../components/SectionHeading'
import { Text } from '../components/Text'
import { EyeMark } from '../components/Icons'
import { matches, mq } from '../lib/capabilities'
import { useReveal } from '../lib/useReveal'
import { duration, gsapEase, registerGsapEases, stagger } from '../motion/config'

export function About() {
  const ref = useReveal<HTMLElement>()
  const story = useRef<HTMLDivElement>(null)

  // Masked line-by-line reveal of the story copy.
  useLayoutEffect(() => {
    const el = story.current
    if (!el || matches(mq.reducedMotion) || ScrollTrigger.isInViewport(el, 0.1)) return
    gsap.registerPlugin(ScrollTrigger, SplitText)
    registerGsapEases()
    const ctx = gsap.context(() => {
      el.querySelectorAll('p').forEach((p) => {
        SplitText.create(p, {
          type: 'lines',
          mask: 'lines',
          autoSplit: true,
          // lines stay plain readable text; no aria-label on <p> (prohibited ARIA)
          aria: 'none',
          onSplit: (self) =>
            gsap.from(self.lines, {
              yPercent: 105,
              duration: duration.slow,
              ease: gsapEase.out,
              stagger: stagger.base,
              scrollTrigger: { trigger: p, start: 'top 85%', once: true },
            }),
        })
      })
    }, el)
    return () => ctx.revert()
  }, [])

  return (
    <section id="about" ref={ref} tabIndex={-1} aria-labelledby="about-title" className="relative py-24 outline-none md:py-36">
      <div className="container-x grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <SectionHeading id="about-title" eyebrow="About">
            About {business.name}
          </SectionHeading>
          <div ref={story} className="space-y-6 text-lg leading-relaxed text-muted md:text-xl">
            {business.about.map((para, i) => (
              <p key={i}>
                <Text value={para} />
              </p>
            ))}
          </div>
        </div>

        <aside className="lg:col-span-4 lg:col-start-9 lg:self-end" data-reveal>
          <div className="card p-8">
            <EyeMark className="size-10 text-accent" />
            <p className="eyebrow mt-6">Led by</p>
            <p className="h-display mt-2 text-3xl">{business.doctor}</p>
            <p className="mt-3 text-muted">
              <Text value={business.doctorCredentials} />
            </p>
          </div>
        </aside>
      </div>
    </section>
  )
}
