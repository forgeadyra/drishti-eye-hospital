/**
 * Tiny mutable store shared between the DOM (ScrollTrigger / pointer) and the lazy 3D scene.
 * Kept outside React so updates never re-render; the scene calls `requestFrame` to render on demand.
 */
export const heroState = {
  /** 0 → 1 as the hero scrolls out of view */
  progress: 0,
  /** pointer in normalised device coords (-1 … 1) */
  pointer: { x: 0, y: 0 },
  /** 0 → 1 assembly animation when the scene first appears */
  intro: 0,
  requestFrame: () => {},
}
