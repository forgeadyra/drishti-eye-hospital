import { useCallback, useLayoutEffect, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { gallery } from '../content/gallery'
import { SectionHeading } from '../components/SectionHeading'
import { ResponsiveImage } from '../components/ResponsiveImage'
import { Lightbox } from '../components/Lightbox'
import { matches, mq } from '../lib/capabilities'
import { useReveal } from '../lib/useReveal'

const PLACEHOLDER_TILES = 6
const SPANS = ['sm:row-span-2', '', '', 'sm:row-span-2', '', '']

export function Gallery() {
  const ref = useReveal<HTMLElement>()
  const [index, setIndex] = useState<number | null>(null)
  const onChange = useCallback((i: number | null) => setIndex(i), [])

  // Parallax: each photo drifts inside its frame while scrolling.
  useLayoutEffect(() => {
    const root = ref.current
    if (!root || !gallery.length || matches(mq.reducedMotion)) return
    gsap.registerPlugin(ScrollTrigger)
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('[data-parallax]', root).forEach((img) => {
        gsap.fromTo(
          img,
          { yPercent: -7 },
          {
            yPercent: 7,
            ease: 'none',
            scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
          },
        )
      })
    }, root)
    return () => ctx.revert()
  }, [ref])

  return (
    <section id="gallery" ref={ref} tabIndex={-1} aria-labelledby="gallery-title" className="relative py-24 outline-none md:py-36">
      <div className="container-x">
        <SectionHeading id="gallery-title" eyebrow="Gallery">
          Inside the hospital
        </SectionHeading>

        {gallery.length > 0 ? (
          <ul className="grid auto-rows-[14rem] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.map((img, i) => (
              <li key={img.src} data-reveal className={SPANS[i % SPANS.length]}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`View larger: ${img.alt}`}
                  className="group relative block size-full overflow-hidden rounded-3xl"
                >
                  <span data-parallax className="absolute -inset-y-[8%] inset-x-0 block">
                    <ResponsiveImage
                      image={img}
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="size-full scale-105 object-cover transition-transform duration-700 ease-(--ease-out) group-hover:scale-110"
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="grid auto-rows-[14rem] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: PLACEHOLDER_TILES }, (_, i) => (
              <li
                key={i}
                data-reveal
                className={`card grid place-items-center border-dashed p-6 text-center ${SPANS[i]}`}
              >
                <p className="text-sm text-muted">
                  <span className="ph">{`{{GALLERY_PHOTO_${i + 1}}}`}</span>
                  <br />
                  Add photos to <code>assets-src/images/</code>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Lightbox images={gallery} index={index} onChange={onChange} />
    </section>
  )
}
