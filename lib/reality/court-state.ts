import { NBA_COURT, type BasketSide, type Point, baselineFor, basketFor } from "./court"
import type { BallState, CourtState, PlayerState } from "./types"

export type { Point }

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Distance (m) from a point to the basket the offense is attacking. */
export function distanceToBasket(p: Point, side: BasketSide): number {
  return dist(p, basketFor(side))
}

/** Distance (m) from a point to the baseline behind the attacked basket. */
export function distanceToBaseline(p: Point, side: BasketSide): number {
  return Math.abs(baselineFor(side) - p.x)
}

/** In the corner-three zone: within cornerDepth of the baseline. */
export function isInCorner(p: Point, side: BasketSide): boolean {
  return distanceToBaseline(p, side) <= NBA_COURT.cornerDepth
}

export function isBeyondArc(p: Point, side: BasketSide): boolean {
  if (isInCorner(p, side)) {
    return p.y <= NBA_COURT.cornerLineInset || p.y >= NBA_COURT.width - NBA_COURT.cornerLineInset
  }
  return distanceToBasket(p, side) >= NBA_COURT.threePointRadius
}

export function isInPaint(p: Point, side: BasketSide): boolean {
  const halfWidth = NBA_COURT.paint.width / 2
  return (
    Math.abs(p.y - basketFor(side).y) <= halfWidth &&
    distanceToBaseline(p, side) <= NBA_COURT.paint.depth
  )
}

export function playerById(state: CourtState, id: string): PlayerState | undefined {
  return state.players.find((p) => p.id === id)
}

export function offense(state: CourtState): PlayerState[] {
  return state.players.filter((p) => p.team === "offense")
}

export function defense(state: CourtState): PlayerState[] {
  return state.players.filter((p) => p.team === "defense")
}

export interface NearestResult {
  id: string
  distance: number
}

/** Nearest opposing player to `player` in this state. */
export function nearestOpponent(state: CourtState, player: PlayerState): NearestResult | null {
  let best: NearestResult | null = null
  for (const other of state.players) {
    if (other.team === player.team) continue
    const d = dist(player, other)
    if (!best || d < best.distance) best = { id: other.id, distance: d }
  }
  return best
}

export function nearestDefenderDistance(state: CourtState, playerId: string): NearestResult | null {
  const player = playerById(state, playerId)
  if (!player) return null
  return nearestOpponent(state, player)
}

/** Unit vector from a → b, or zero when coincident. */
export function direction(a: Point, b: Point): Point {
  const d = dist(a, b)
  if (d === 0) return { x: 0, y: 0 }
  return { x: (b.x - a.x) / d, y: (b.y - a.y) / d }
}

/** Cosine similarity between a velocity and the direction toward a target. */
export function headingToward(player: PlayerState, target: Point): number {
  if (player.speed === 0) return 0
  const toward = direction(player, target)
  return (player.vx * toward.x + player.vy * toward.y) / player.speed
}

/**
 * Re-derive vx / vy / speed from positions with a central difference so
 * hand-edited coordinates never disagree with their stored velocities.
 */
export function deriveKinematics(states: CourtState[]): CourtState[] {
  return states.map((state, i) => {
    const prev = states[Math.max(0, i - 1)]
    const next = states[Math.min(states.length - 1, i + 1)]
    const span = next.timestamp - prev.timestamp || 1
    return {
      ...state,
      players: state.players.map((p) => {
        const a = playerById(prev, p.id) ?? p
        const b = playerById(next, p.id) ?? p
        const vx = (b.x - a.x) / span
        const vy = (b.y - a.y) / span
        return { ...p, vx, vy, speed: Math.hypot(vx, vy) }
      }),
    }
  })
}

export function frameIndexAt(states: CourtState[], t: number): number {
  if (states.length === 0) return -1
  let lo = 0
  let hi = states.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (states[mid].timestamp <= t) lo = mid
    else hi = mid - 1
  }
  return lo
}

function lerp(a: number, b: number, u: number) {
  return a + (b - a) * u
}

/** Interpolated court state at an arbitrary time. */
export function stateAt(states: CourtState[], t: number): CourtState {
  const i = frameIndexAt(states, t)
  const a = states[Math.max(0, i)]
  const b = states[Math.min(states.length - 1, i + 1)]
  if (!a) throw new Error("stateAt: empty tracking data")
  if (a === b || t <= a.timestamp) return a
  const u = Math.min(1, (t - a.timestamp) / (b.timestamp - a.timestamp || 1))

  const players: PlayerState[] = a.players.map((pa) => {
    const pb = playerById(b, pa.id) ?? pa
    const vx = lerp(pa.vx, pb.vx, u)
    const vy = lerp(pa.vy, pb.vy, u)
    return {
      ...pa,
      x: lerp(pa.x, pb.x, u),
      y: lerp(pa.y, pb.y, u),
      vx,
      vy,
      speed: Math.hypot(vx, vy),
    }
  })

  const ball: BallState = {
    x: lerp(a.ball.x, b.ball.x, u),
    y: lerp(a.ball.y, b.ball.y, u),
    z: lerp(a.ball.z ?? 0, b.ball.z ?? 0, u),
    possessor: u < 0.5 ? a.ball.possessor : b.ball.possessor,
  }

  return { timestamp: t, gameClock: a.gameClock, players, ball }
}
