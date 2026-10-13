/**
 * Motion system — the ONLY place easing, durations and staggers are defined.
 * GSAP (via CustomEase) and Framer Motion both read from these curves, so scroll
 * choreography and UI micro-interactions feel like one system.
 * CSS mirrors (for pure-CSS transitions) live in styles/index.css → `--ease-*`; keep in sync.
 */
import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

type Bezier = [number, number, number, number]

export const curves = {
  /** Default for entrances: fast start, long soft landing. */
  out: [0.16, 1, 0.3, 1] as Bezier,
  /** Symmetric, for transitions between two states (menus, masks). */
  inOut: [0.65, 0, 0.35, 1] as Bezier,
  /** Exits. */
  in: [0.7, 0, 0.84, 0] as Bezier,
} as const

export const duration = { fast: 0.35, base: 0.7, slow: 1.1, intro: 1.2 } as const
export const stagger = { tight: 0.05, base: 0.08, loose: 0.12 } as const
export const distance = { sm: 16, md: 32, lg: 64 } as const

/** Spring for magnetic buttons / cursor. */
export const spring = { stiffness: 220, damping: 18, mass: 0.6 } as const

/** GSAP ease names registered from the same curves. */
export const gsapEase = { out: 'drishti.out', inOut: 'drishti.inOut', in: 'drishti.in' } as const

let registered = false
export function registerGsapEases() {
  if (registered) return
  registered = true
  gsap.registerPlugin(CustomEase)
  const path = ([a, b, c, d]: Bezier) => `M0,0 C${a},${b} ${c},${d} 1,1`
  CustomEase.create(gsapEase.out, path(curves.out))
  CustomEase.create(gsapEase.inOut, path(curves.inOut))
  CustomEase.create(gsapEase.in, path(curves.in))
}
