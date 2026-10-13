import { useEffect, useRef } from 'react'
import { animate, useInView } from 'framer-motion'
import { matches, mq } from '../lib/capabilities'
import { curves, duration } from '../motion/config'

/** Counts up to a REAL numeric fact when scrolled into view. Final value is in the HTML (SSR / reduced motion). */
export function Counter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -15% 0px' })

  useEffect(() => {
    const el = ref.current
    if (!el || !inView || matches(mq.reducedMotion)) return
    const fmt = new Intl.NumberFormat('en-IN')
    const controls = animate(0, value, {
      duration: duration.slow * 1.5,
      ease: curves.out,
      onUpdate: (v) => {
        el.textContent = `${fmt.format(Math.round(v))}${suffix}`
      },
    })
    return () => controls.stop()
  }, [inView, value, suffix])

  return (
    <span ref={ref} className="tabular-nums">
      {new Intl.NumberFormat('en-IN').format(value)}
      {suffix}
    </span>
  )
}
