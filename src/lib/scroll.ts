/**
 * Smooth scroll (Lenis) driven by the GSAP ticker so ScrollTrigger and Lenis share one RAF loop.
 * Disabled entirely under prefers-reduced-motion (native scrolling is used instead).
 */
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { registerGsapEases } from '../motion/config'
import { matches, mq } from './capabilities'

let lenis: Lenis | null = null

export function initScroll(): () => void {
  gsap.registerPlugin(ScrollTrigger)
  registerGsapEases()
  if (matches(mq.reducedMotion)) return () => {}

  lenis = new Lenis({ autoRaf: false, lerp: 0.12 })
  const instance = lenis
  instance.on('scroll', ScrollTrigger.update)
  const tick = (time: number) => instance.raf(time * 1000)
  gsap.ticker.add(tick)
  gsap.ticker.lagSmoothing(0)

  // Keyboard a11y: Lenis owns the scroll position, so the browser's "scroll focused element into
  // view" gets undone. Bring any off-screen focus target into view through Lenis instead.
  const onFocus = (e: FocusEvent) => {
    const el = e.target as HTMLElement | null
    if (!el || el === document.body || el.closest('[role="dialog"]')) return
    const r = el.getBoundingClientRect()
    if (r.top >= 72 && r.bottom <= window.innerHeight) return
    instance.scrollTo(el, { offset: -window.innerHeight / 3, immediate: true, force: true })
  }
  document.addEventListener('focusin', onFocus)

  return () => {
    document.removeEventListener('focusin', onFocus)
    gsap.ticker.remove(tick)
    instance.destroy()
    lenis = null
  }
}

export function lockScroll(locked: boolean) {
  if (lenis) {
    if (locked) lenis.stop()
    else lenis.start()
  }
  document.documentElement.classList.toggle('overflow-hidden', locked)
}

/** Scrolls to a section and moves keyboard focus to it (accessible in-page navigation). */
export function scrollToSection(id: string) {
  const target = document.getElementById(id)
  if (!target) return
  const focus = () => target.focus({ preventScroll: true })
  if (lenis) {
    lenis.scrollTo(target, { offset: id === 'top' ? 0 : -72, force: true, onComplete: focus })
  } else {
    target.scrollIntoView({ behavior: matches(mq.reducedMotion) ? 'auto' : 'smooth' })
    focus()
  }
  history.replaceState(null, '', id === 'top' ? location.pathname : `#${id}`)
}
