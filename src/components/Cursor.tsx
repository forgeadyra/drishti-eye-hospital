import { useEffect, useState } from 'react'
import { m, useMotionValue, useSpring } from 'framer-motion'
import { mq } from '../lib/capabilities'
import { useMediaQuery } from '../lib/useMediaQuery'
import { spring } from '../motion/config'

/**
 * Cursor-follow ring. Decorative: desktop fine-pointer only, off under reduced motion,
 * and the native cursor is never hidden. Client-only (not in prerendered HTML).
 */
export function Cursor() {
  const fine = useMediaQuery(mq.finePointer)
  const reduced = useMediaQuery(mq.reducedMotion)
  if (!fine || reduced) return null
  return <CursorRing />
}

function CursorRing() {
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const sx = useSpring(x, spring)
  const sy = useSpring(y, spring)
  const [active, setActive] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      x.set(e.clientX)
      y.set(e.clientY)
      setVisible(true)
      const t = e.target as Element | null
      setActive(Boolean(t?.closest('a, button, [role="button"], input, textarea, label')))
    }
    const leave = () => setVisible(false)
    window.addEventListener('pointermove', move, { passive: true })
    document.documentElement.addEventListener('pointerleave', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', leave)
    }
  }, [x, y])

  return (
    <m.div
      aria-hidden="true"
      className="cursor-follower pointer-events-none fixed top-0 left-0 z-[70] -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/70 mix-blend-difference"
      style={{ x: sx, y: sy }}
      animate={{ width: active ? 56 : 28, height: active ? 56 : 28, opacity: visible ? 1 : 0 }}
      transition={{ type: 'spring', ...spring }}
    />
  )
}
