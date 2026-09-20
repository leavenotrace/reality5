import type { Vec2 } from "./types"

/** NBA half court dimensions in feet. */
export const COURT = {
  width: 50,
  depth: 47,
  hoop: { x: 25, y: 5.25 },
  hoopRadius: 0.75,
  backboardY: 4,
  paint: { x: 17, width: 16, depth: 19 },
  freeThrowRadius: 6,
  restrictedRadius: 4,
  threePointRadius: 23.75,
  cornerThreeX: 3,
  cornerThreeDepth: 14,
} as const

/** SVG viewBox used by the overlay, matched to a 16:9 broadcast frame. */
export const FRAME = { width: 160, height: 90 } as const

const scale = 84 / COURT.depth
const offsetX = (FRAME.width - COURT.width * scale) / 2
const offsetY = 3

/** Project court feet into overlay frame units. */
export function project(p: Vec2): Vec2 {
  return { x: offsetX + p.x * scale, y: offsetY + p.y * scale }
}

/** Convert a length in feet to overlay frame units. */
export function projectLength(feet: number): number {
  return feet * scale
}

export const FEET_PER_METER = 3.28084

export function feetToMeters(feet: number): number {
  return feet / FEET_PER_METER
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
