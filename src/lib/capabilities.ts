/** Browser capability checks. Only call from effects (never during render — SSR-safe). */

export const mq = {
  reducedMotion: '(prefers-reduced-motion: reduce)',
  finePointer: '(hover: hover) and (pointer: fine)',
} as const

export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

interface NavigatorHints {
  deviceMemory?: number
  connection?: { saveData?: boolean }
}

/** Low-end per spec: hardwareConcurrency ≤ 4 or deviceMemory ≤ 4 (GB). Also honours Save-Data. */
export function isLowEndDevice(): boolean {
  const nav = navigator as Navigator & NavigatorHints
  const cores = nav.hardwareConcurrency
  const memory = nav.deviceMemory
  return (
    (typeof cores === 'number' && cores <= 4) ||
    (typeof memory === 'number' && memory <= 4) ||
    nav.connection?.saveData === true
  )
}

export function matches(query: string): boolean {
  return typeof window !== 'undefined' && window.matchMedia(query).matches
}
