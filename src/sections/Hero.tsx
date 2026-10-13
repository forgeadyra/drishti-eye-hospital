import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { business } from '../content/business'
import { CtaGroup } from '../components/CtaGroup'
import { Text } from '../components/Text'
import { hasWebGL, isLowEndDevice, matches, mq } from '../lib/capabilities'
import { heroState } from '../lib/heroState'
import { useMediaQuery } from '../lib/useMediaQuery'

const HeroScene = lazy(() => import('../three/HeroScene'))

type SceneState = 'off' | 'loading' | 'ready' | 'failed'

/**
 * Decides whether the 3D scene loads at all. It never loads under reduced motion, without WebGL,
 * or on low-end devices (≤4 cores / ≤4 GB / Save-Data) — those visitors keep the static poster.
 * On capable devices the chunk is fetched after `load`, on first interaction or ~2.5s of idle,
 * so it never competes with the text and CTAs for bandwidth or main-thread time.
 */
function useSceneGate(): [SceneState, (s: SceneState) => void] {
  const [state, setState] = useState<SceneState>('off')
  const reduced = useMediaQuery(mq.reducedMotion)

  useEffect(() => {
    if (reduced || isLowEndDevice() || !hasWebGL()) return
    const events = ['pointermove', 'pointerdown', 'wheel', 'touchstart', 'keydown', 'scroll'] as const
    let timer = 0
    const go = () => {
      cleanup()
      setState((s) => (s === 'off' ? 'loading' : s))
    }
    const arm = () => {
      events.forEach((e) => window.addEventListener(e, go, { once: true, passive: true }))
      timer = window.setTimeout(() => {
        if ('requestIdleCallback' in window) window.requestIdleCallback(go, { timeout: 1000 })
        else go()
      }, 2500)
    }
    const cleanup = () => {
      window.clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, go))
      window.removeEventListener('load', arm)
    }
    if (document.readyState === 'complete') arm()
    else window.addEventListener('load', arm, { once: true })
    return cleanup
  }, [reduced])

  // Switching reduced motion on mid-visit unmounts the scene immediately (poster remains).
  return [reduced ? 'off' : state, setState]
}

export function Hero() {
  const section = useRef<HTMLElement>(null)
  const copy = useRef<HTMLDivElement>(null)
  const [scene, setScene] = useSceneGate()
  const showCanvas = scene === 'loading' || scene === 'ready'

  // Scroll choreography: drives the 3D focus/dolly and lifts the copy away as the hero exits.
  useLayoutEffect(() => {
    if (!section.current || matches(mq.reducedMotion)) return
    gsap.registerPlugin(ScrollTrigger)
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: section.current,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        onUpdate: (self) => {
          heroState.progress = self.progress
          heroState.requestFrame()
        },
      })
      gsap.to(copy.current, {
        yPercent: -12,
        autoAlpha: 0,
        ease: 'none',
        scrollTrigger: { trigger: section.current, start: 'top top', end: 'bottom 20%', scrub: true },
      })
    }, section)
    return () => ctx.revert()
  }, [])

  // Pointer → normalised coords for the scene (desktop only).
  useEffect(() => {
    if (!matches(mq.finePointer)) return
    const move = (e: PointerEvent) => {
      heroState.pointer.x = (e.clientX / window.innerWidth) * 2 - 1
      heroState.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1)
      heroState.requestFrame()
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [])

  return (
    <section
      id="top"
      ref={section}
      tabIndex={-1}
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-svh items-end overflow-hidden outline-none lg:items-center"
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        {/* Static poster: decorative backdrop + permanent fallback for no-WebGL / low-end / reduced motion.
            Low fetch priority so it never competes with the CSS, fonts and h1 (the real LCP element). */}
        <picture>
          <source media="(orientation: portrait)" type="image/avif" srcSet="/posters/hero-portrait.avif" />
          <source media="(orientation: portrait)" type="image/webp" srcSet="/posters/hero-portrait.webp" />
          <source type="image/avif" srcSet="/posters/hero-landscape.avif" />
          <img
            src="/posters/hero-landscape.webp"
            alt=""
            width={1600}
            height={1000}
            fetchPriority="low"
            decoding="async"
            className={`absolute inset-0 size-full object-cover transition-opacity duration-1000 ${scene === 'ready' ? 'opacity-0' : 'opacity-100'}`}
          />
        </picture>
        {showCanvas && (
          <div className={`absolute inset-0 transition-opacity duration-1000 ${scene === 'ready' ? 'opacity-100' : 'opacity-0'}`}>
            <Suspense fallback={null}>
              <HeroScene onReady={() => setScene('ready')} onFail={() => setScene('failed')} />
            </Suspense>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent lg:bg-gradient-to-r lg:from-ink/90 lg:via-ink/30" />
      </div>
      <p className="sr-only">
        Decorative animation: an abstract iris and optical lens that come into sharp focus as you scroll.
      </p>

      <div ref={copy} className="container-x relative pt-32 pb-16 sm:pb-24 lg:py-0">
        <p className="eyebrow">
          {business.category} · <Text value={business.address.locality} />
        </p>
        <h1 id="hero-title" className="h-display mt-5 max-w-3xl text-[3.25rem] leading-[0.95] sm:text-7xl lg:text-8xl">
          Drishti
          <br />
          <span className="text-accent">Eye Hospital</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted sm:text-xl">
          Eye care led by <span className="text-cream">{business.doctor}</span>.{' '}
          <Text value={business.tagline} />
        </p>
        <CtaGroup className="mt-9" />
      </div>
    </section>
  )
}
