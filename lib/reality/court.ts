/**
 * THE court coordinate contract. Every layer — adapters, CourtState,
 * detectors, renderer, distance math — uses this and nothing else.
 *
 * Physical meters, full NBA court:
 *   x = 0 → 28.65  (baseline to baseline)
 *   y = 0 → 15.24  (sideline to sideline)
 * Baskets sit on the long axis, 1.575 m in from each baseline.
 */
export const NBA_COURT = {
  length: 28.65,
  width: 15.24,
  leftBasket: { x: 1.575, y: 7.62 },
  rightBasket: { x: 27.075, y: 7.62 },
  /** Arc radius measured from the basket centre. */
  threePointRadius: 7.24,
  /** Corner three: straight line 0.91 m in from each sideline … */
  cornerLineInset: 0.91,
  /** … running 4.27 m out from the baseline before it meets the arc. */
  cornerDepth: 4.27,
  paint: { width: 4.88, depth: 5.79 },
  freeThrowRadius: 1.83,
  restrictedRadius: 1.22,
  hoopRadius: 0.23,
  /** Backboard face distance from the baseline. */
  backboardOffset: 1.22,
  coordinateSystem: "NBA_METRIC",
} as const

export type BasketSide = "left" | "right"

export interface Point {
  x: number
  y: number
}

export function basketFor(side: BasketSide): Point {
  return side === "left" ? NBA_COURT.leftBasket : NBA_COURT.rightBasket
}

/** Baseline x behind a given basket. */
export function baselineFor(side: BasketSide): number {
  return side === "left" ? 0 : NBA_COURT.length
}

export function isInsideCourt(p: Point): boolean {
  return p.x >= 0 && p.x <= NBA_COURT.length && p.y >= 0 && p.y <= NBA_COURT.width
}

/** Pixel (or SVG-unit) rectangle a court is drawn into. */
export interface Viewport {
  width: number
  height: number
}

/**
 * Fit the full court into a viewport preserving the 28.65 : 15.24 ratio and
 * centre it. This is the single meters → screen mapping.
 */
export function courtTransform(viewport: Viewport) {
  const scale = Math.min(viewport.width / NBA_COURT.length, viewport.height / NBA_COURT.width)
  const offsetX = (viewport.width - NBA_COURT.length * scale) / 2
  const offsetY = (viewport.height - NBA_COURT.width * scale) / 2
  return { scale, offsetX, offsetY }
}

export function courtToScreen(x: number, y: number, viewport: Viewport): Point {
  const { scale, offsetX, offsetY } = courtTransform(viewport)
  return { x: offsetX + x * scale, y: offsetY + y * scale }
}

export function screenToCourt(screenX: number, screenY: number, viewport: Viewport): Point {
  const { scale, offsetX, offsetY } = courtTransform(viewport)
  return { x: (screenX - offsetX) / scale, y: (screenY - offsetY) / scale }
}

/** Convert a physical length in meters to screen units for a viewport. */
export function lengthToScreen(meters: number, viewport: Viewport): number {
  return meters * courtTransform(viewport).scale
}
