import { courtToScreen, lengthToScreen, screenToCourt, type Viewport } from "@/lib/reality/court"
import type { Vec2 } from "./types"

export { NBA_COURT } from "@/lib/reality/court"

/**
 * SVG viewBox used by the broadcast overlay, matched to a 16:9 frame.
 * The court is fitted into this viewport by courtToScreen, preserving
 * the 28.65 : 15.24 aspect ratio. Nothing else may map meters to pixels.
 */
export const FRAME: Viewport = { width: 160, height: 90 }

/** Project court meters into overlay frame units. */
export function project(p: Vec2): Vec2 {
  return courtToScreen(p.x, p.y, FRAME)
}

/** Inverse of project: overlay frame units → court meters. */
export function unproject(p: Vec2): Vec2 {
  return screenToCourt(p.x, p.y, FRAME)
}

/** Convert a length in meters to overlay frame units. */
export function projectLength(meters: number): number {
  return lengthToScreen(meters, FRAME)
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
