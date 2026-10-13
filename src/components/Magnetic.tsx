import { useEffect, useRef, type ReactNode } from 'react'
import { animate } from 'framer-motion'
import { matches, mq } from '../lib/capabilities'
import { spring } from '../motion/config'

/**
 * Magnetic hover: the child drifts toward the cursor and springs back.
 * Desktop (fine pointer) only, disabled under reduced motion. Styles are written via CSSOM
 * after hydration, so prerendered HTML carries no inline style attributes (strict CSP).
 */
export function Magnetic({ children, strength = 0.3 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !matches(mq.finePointer) || matches(mq.reducedMotion)) return
    const pos = { x: 0, y: 0 }
    const apply = () => {
      el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`
    }
    let ax: ReturnType<typeof animate> | undefined
    let ay: ReturnType<typeof animate> | undefined
    const to = (x: number, y: number) => {
      ax?.stop()
      ay?.stop()
      ax = animate(pos.x, x, { type: 'spring', ...spring, onUpdate: (v) => ((pos.x = v), apply()) })
      ay = animate(pos.y, y, { type: 'spring', ...spring, onUpdate: (v) => ((pos.y = v), apply()) })
    }
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      to((e.clientX - (r.left + r.width / 2)) * strength, (e.clientY - (r.top + r.height / 2)) * strength)
    }
    const leave = () => to(0, 0)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      ax?.stop()
      ay?.stop()
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  }, [strength])

  return (
    <span ref={ref} className="inline-flex will-change-transform">
      {children}
    </span>
  )
}
