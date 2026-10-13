import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { matches, mq } from './capabilities'
import { distance, duration, gsapEase, registerGsapEases, stagger } from '../motion/config'

/**
 * Staggered scroll reveal for every `[data-reveal]` descendant of the returned ref.
 * Content is visible in the prerendered HTML; GSAP only hides elements that are still
 * below the fold at hydration, so nothing already on screen ever flashes.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useLayoutEffect(() => {
    const root = ref.current
    if (!root || matches(mq.reducedMotion)) return
    gsap.registerPlugin(ScrollTrigger)
    registerGsapEases()
    const ctx = gsap.context(() => {
      const items = gsap.utils
        .toArray<HTMLElement>('[data-reveal]', root)
        .filter((el) => !ScrollTrigger.isInViewport(el, 0.05))
      if (!items.length) return
      gsap.set(items, { autoAlpha: 0, y: distance.md })
      ScrollTrigger.batch(items, {
        start: 'top 88%',
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            autoAlpha: 1,
            y: 0,
            duration: duration.base,
            ease: gsapEase.out,
            stagger: stagger.base,
            overwrite: true,
          }),
      })
    }, root)
    return () => ctx.revert()
  }, [])
  return ref
}
