import type {
  Anchor,
  BasketballEvent,
  CourtState,
  Possession,
  TrackKeyframe,
  Vec2,
} from "./types"

function smoothstep(u: number): number {
  return u * u * (3 - 2 * u)
}

/** Sample a keyframe track at time t with eased interpolation between keys. */
export function sampleTrack(
  keyframes: TrackKeyframe[],
  t: number,
): Vec2 & { z: number } {
  if (keyframes.length === 0) return { x: 0, y: 0, z: 0 }
  const first = keyframes[0]
  const last = keyframes[keyframes.length - 1]
  if (t <= first.t) return { ...first.pos, z: first.z ?? 0 }
  if (t >= last.t) return { ...last.pos, z: last.z ?? 0 }

  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i]
    const b = keyframes[i + 1]
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t || 1
      const u = smoothstep((t - a.t) / span)
      return {
        x: a.pos.x + (b.pos.x - a.pos.x) * u,
        y: a.pos.y + (b.pos.y - a.pos.y) * u,
        z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * u,
      }
    }
  }
  return { ...last.pos, z: last.z ?? 0 }
}

/** Resolve the full court snapshot at time t. */
export function getCourtState(possession: Possession, t: number): CourtState {
  const players: CourtState["players"] = {}
  for (const track of possession.tracks) {
    const { x, y } = sampleTrack(track.keyframes, t)
    players[track.playerId] = { x, y }
  }

  const holder = possession.ball.possession.find(
    (p) => t >= p.from && t < p.to,
  )
  const ball = holder
    ? { ...players[holder.playerId], z: 0 }
    : sampleTrack(possession.ball.keyframes, t)

  return { t, players, ball }
}

/** Resolve an anchor to a court position, using the live state or a fixed time. */
export function resolveAnchor(
  possession: Possession,
  state: CourtState,
  anchor: Anchor,
): Vec2 {
  if ("playerId" in anchor) {
    if (anchor.t === undefined) return state.players[anchor.playerId]
    const track = possession.tracks.find((tr) => tr.playerId === anchor.playerId)
    if (!track) return { x: 0, y: 0 }
    const { x, y } = sampleTrack(track.keyframes, anchor.t)
    return { x, y }
  }
  return anchor
}

/** Sample a player's path between two times as a polyline. */
export function samplePath(
  possession: Possession,
  playerId: string,
  from: number,
  to: number,
  steps = 16,
): Vec2[] {
  const track = possession.tracks.find((tr) => tr.playerId === playerId)
  if (!track) return []
  const points: Vec2[] = []
  for (let i = 0; i <= steps; i++) {
    const t = from + ((to - from) * i) / steps
    const { x, y } = sampleTrack(track.keyframes, t)
    points.push({ x, y })
  }
  return points
}

/** The most recent event whose timestamp has been reached. */
export function getActiveEvent(
  events: BasketballEvent[],
  t: number,
  tolerance = 0.02,
): BasketballEvent | null {
  let active: BasketballEvent | null = null
  for (const event of events) {
    if (event.t <= t + tolerance) active = event
  }
  return active
}

/** Parse a broadcast clock label like "07:40.1" into seconds. */
export function parseClock(label: string): number {
  const [m, s] = label.split(":")
  return Number(m) * 60 + Number(s)
}

/** Format seconds as a broadcast clock label "MM:SS.T". */
export function formatClock(seconds: number): string {
  const clamped = Math.max(0, seconds)
  const m = Math.floor(clamped / 60)
  const s = clamped - m * 60
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`
}

/** Broadcast clock for a clip-relative time. */
export function clockAt(possession: Possession, t: number): string {
  return formatClock(parseClock(possession.video.clockAtStart) + t)
}
