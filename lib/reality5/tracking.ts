import { stateAt } from "@/lib/reality/court-state"
import type { CourtState } from "@/lib/reality/types"
import { FEET_PER_METER } from "./court"
import type { Anchor, OverlayCourtState, Possession, PresentedEvent, Vec2 } from "./types"

const m2ft = (m: number) => m * FEET_PER_METER

/** Convert an engine court state (meters) into the overlay frame (feet). */
export function toOverlayState(state: CourtState): OverlayCourtState {
  const players: OverlayCourtState["players"] = {}
  for (const p of state.players) players[p.id] = { x: m2ft(p.x), y: m2ft(p.y) }
  return {
    t: state.timestamp,
    players,
    ball: { x: m2ft(state.ball.x), y: m2ft(state.ball.y), z: m2ft(state.ball.z ?? 0) },
    possessor: state.ball.possessor,
  }
}

/** Interpolated engine state (meters) at time t. */
export function getRealityState(possession: Possession, t: number): CourtState {
  return stateAt(possession.analysis.states, t)
}

/** Resolve the overlay snapshot (feet) at time t. */
export function getCourtState(possession: Possession, t: number): OverlayCourtState {
  return toOverlayState(getRealityState(possession, t))
}

/** Resolve an anchor to an overlay position, using the live state or a fixed time. */
export function resolveAnchor(
  possession: Possession,
  state: OverlayCourtState,
  anchor: Anchor,
): Vec2 {
  if ("playerId" in anchor) {
    if (anchor.t === undefined) return state.players[anchor.playerId] ?? { x: 0, y: 0 }
    const at = getCourtState(possession, anchor.t)
    return at.players[anchor.playerId] ?? { x: 0, y: 0 }
  }
  return anchor
}

/** Sample a player's path between two times as a polyline (feet). */
export function samplePath(
  possession: Possession,
  playerId: string,
  from: number,
  to: number,
  steps = 16,
): Vec2[] {
  const points: Vec2[] = []
  for (let i = 0; i <= steps; i++) {
    const t = from + ((to - from) * i) / steps
    const p = getCourtState(possession, t).players[playerId]
    if (p) points.push(p)
  }
  return points
}

/** The most recent event whose timestamp has been reached. */
export function getActiveEvent(
  events: PresentedEvent[],
  t: number,
  tolerance = 0.02,
): PresentedEvent | null {
  let active: PresentedEvent | null = null
  for (const event of events) {
    if (event.t <= t + tolerance) active = event
  }
  return active
}

export function parseClock(label: string): number {
  const [m, s] = label.split(":")
  return Number(m) * 60 + Number(s)
}

export function formatClock(seconds: number): string {
  const clamped = Math.max(0, seconds)
  const m = Math.floor(clamped / 60)
  const s = clamped - m * 60
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`
}

export function clockAt(possession: Possession, t: number): string {
  return formatClock(parseClock(possession.video.clockAtStart) + t)
}
