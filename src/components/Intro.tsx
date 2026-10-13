import { useEffect, useRef } from 'react'
import { business } from '../content/business'
import { EyeMark } from './Icons'

/**
 * Cinematic intro (1.15s), rendered in the prerendered HTML and driven by pure CSS keyframes so it
 * plays before any JS loads and can never block content:
 *  - pointer-events: none (everything underneath is clickable/readable from frame one)
 *  - skipped instantly on any click / key / wheel / touch
 *  - not shown at all under prefers-reduced-motion (see styles/intro.css)
 */
export function Intro() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const skip = () => el.classList.add('intro-skip')
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, skip, { once: true, passive: true }))
    return () => events.forEach((e) => window.removeEventListener(e, skip))
  }, [])

  return (
    <div ref={ref} className="intro" aria-hidden="true">
      <div className="intro-mark">
        <EyeMark className="size-14 text-accent" />
        <span className="font-display text-2xl tracking-tight">{business.name}</span>
      </div>
    </div>
  )
}
