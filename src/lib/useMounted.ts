import { useSyncExternalStore } from 'react'

const noop = () => () => {}

/** `false` on the server and during hydration, `true` afterwards. */
export function useMounted(): boolean {
  return useSyncExternalStore(noop, () => true, () => false)
}
