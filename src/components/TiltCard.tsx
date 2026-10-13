import { useEffect, useRef, type ReactNode } from 'react'
import { animate } from 'framer-motion'
import { matches, mq } from '../lib/capabilities'
import { spring } from '../motion/config'

/** 3D hover tilt with a moving highlight. Fine pointer only; off under reduced motion. Writes via CSSOM. */
export function TiltCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !matches(mq.finePointer) || matches(mq.reducedMotion)) return
    const s = { rx: 0, ry: 0 }
    const apply = () => {
      el.style.transform = `perspective(900px) rotateX(${s.rx}deg) rotateY(${s.ry}deg)`
    }
    const runs: ReturnType<typeof animate>[] = []
    const to = (rx: number, ry: number) => {
      runs.forEach((r) => r.stop())
      runs.length = 0
      runs.push(
        animate(s.rx, rx, { type: 'spring', ...spring, onUpdate: (v) => ((s.rx = v), apply()) }),
        animate(s.ry, ry, { type: 'spring', ...spring, onUpdate: (v) => ((s.ry = v), apply()) }),
      )
    }
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width
      const py = (e.clientY - r.top) / r.height
      el.style.setProperty('--mx', `${px * 100}%`)
      el.style.setProperty('--my', `${py * 100}%`)
      to((0.5 - py) * 10, (px - 0.5) * 12)
    }
    const leave = () => to(0, 0)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      runs.forEach((r) => r.stop())
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  }, [])

  return (
    <div ref={ref} className={`tilt-card group relative transform-3d will-change-transform ${className}`}>
      {children}
    </div>
  )
}
