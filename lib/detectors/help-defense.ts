import {
  COURT_M,
  defense,
  dist,
  distanceToBasket,
  nearestOpponent,
  offense,
  playerById,
} from "@/lib/reality/court-state"
import type { BasketballEvent, CourtState, DetectorConfig } from "@/lib/reality/types"

const MOVE_SPEED_MIN = 1.0
const HEADING_MIN = 0.4

interface DriveWindow {
  handler: string
  startIndex: number
  endIndex: number
}

function findDriveWindow(states: CourtState[], drives: BasketballEvent[]): DriveWindow | null {
  const drive = drives.find((e) => e.type === "DRIVE")
  if (!drive || !drive.actor) return null
  const startIndex = states.findIndex((s) => s.timestamp >= drive.timestamp)
  const endT = (drive.endTimestamp ?? drive.timestamp) + 0.6
  let endIndex = states.findIndex((s) => s.timestamp > endT)
  if (endIndex === -1) endIndex = states.length - 1
  return { handler: drive.actor, startIndex, endIndex }
}

/**
 * HELP_DEFENSE: while the ball handler drives, an off-ball defender leaves
 * the offensive player they were guarding and moves significantly toward
 * the paint / ball handler.
 *
 * DEFENSIVE_COLLAPSE: enough defenders reduce their distance to the basket
 * during the same window.
 */
export function detectHelpDefense(
  states: CourtState[],
  config: DetectorConfig,
  drives: BasketballEvent[],
): BasketballEvent[] {
  const events: BasketballEvent[] = []
  const window = findDriveWindow(states, drives)
  if (!window || window.startIndex < 0) return events

  const start = states[window.startIndex]
  const handlerAtStart = playerById(start, window.handler)
  if (!handlerAtStart) return events

  // Original assignments: nearest offensive player at drive onset.
  const assignments = new Map<string, string>()
  for (const d of defense(start)) {
    const nearest = nearestOpponent(start, d)
    if (nearest) assignments.set(d.id, nearest.id)
  }

  const collapsing: { id: string; shift: number }[] = []

  for (const defender of defense(start)) {
    const assignment = assignments.get(defender.id)
    if (!assignment || assignment === window.handler) continue // on-ball defender

    let onset = -1
    let end = -1
    for (let i = window.startIndex; i <= window.endIndex; i++) {
      const d = playerById(states[i], defender.id)
      const handler = playerById(states[i], window.handler)
      if (!d || !handler) continue
      const towardPaint = headingTo(d, COURT_M.basket)
      const towardHandler = headingTo(d, handler)
      const moving = d.speed >= MOVE_SPEED_MIN && Math.max(towardPaint, towardHandler) >= HEADING_MIN
      if (moving && onset === -1) onset = i
      if (onset !== -1 && !moving) {
        end = i
        break
      }
    }
    if (onset === -1) continue
    if (end === -1) end = window.endIndex

    const before = playerById(states[onset], defender.id)!
    const after = playerById(states[end], defender.id)!
    const shift = dist(before, after)
    const basketShift = distanceToBasket(before) - distanceToBasket(after)
    if (basketShift >= config.collapseShiftThreshold) {
      collapsing.push({ id: defender.id, shift: basketShift })
    }
    if (shift < config.helpShiftThreshold) continue

    const handlerBefore = playerById(states[onset], window.handler)!
    const handlerAfter = playerById(states[end], window.handler)!
    const assignedBefore = playerById(states[onset], assignment)
    const assignedAfter = playerById(states[end], assignment)

    events.push({
      id: `help_${events.length + 1}`,
      type: "HELP_DEFENSE",
      timestamp: states[onset].timestamp,
      endTimestamp: states[end].timestamp,
      actor: defender.id,
      target: assignment,
      evidence: {
        defender: defender.id,
        left_assignment: assignment,
        defender_shift: round(shift),
        shift_threshold: config.helpShiftThreshold,
        distance_to_ball_handler_before: round(dist(before, handlerBefore)),
        distance_to_ball_handler_after: round(dist(after, handlerAfter)),
        distance_to_basket_change: round(-basketShift),
        assignment_distance_before: assignedBefore ? round(dist(before, assignedBefore)) : 0,
        assignment_distance_after: assignedAfter ? round(dist(after, assignedAfter)) : 0,
        movement_direction: basketShift > 0 ? "toward_paint" : "toward_ball_handler",
        reaction_time: round(states[onset].timestamp - start.timestamp),
      },
      confidence: clamp(0.5 + 0.3 * (shift / config.helpShiftThreshold - 1)),
    })
  }

  // The on-ball defender following the handler also counts toward a collapse.
  const onBall = [...assignments.entries()].find(([, a]) => a === window.handler)?.[0]
  if (onBall) {
    const b = playerById(start, onBall)!
    const a = playerById(states[window.endIndex], onBall)!
    const basketShift = distanceToBasket(b) - distanceToBasket(a)
    if (basketShift >= config.collapseShiftThreshold) collapsing.push({ id: onBall, shift: basketShift })
  }

  if (collapsing.length >= config.collapseMinDefenders) {
    const helpEnd = events.reduce(
      (t, e) => Math.max(t, e.endTimestamp ?? e.timestamp),
      start.timestamp,
    )
    const endIndex = Math.max(
      window.startIndex,
      states.findIndex((s) => s.timestamp >= helpEnd),
    )
    const handlerAtEnd = playerById(states[endIndex], window.handler)!
    const defendersNearHandler = defense(states[endIndex]).filter(
      (d) => dist(d, handlerAtEnd) <= 3.0,
    ).length
    const total = collapsing.reduce((s, c) => s + c.shift, 0)
    events.push({
      id: "collapse_1",
      type: "DEFENSIVE_COLLAPSE",
      timestamp: states[endIndex].timestamp,
      actor: window.handler,
      evidence: {
        defenders: collapsing.map((c) => c.id).join(","),
        defenders_collapsing: collapsing.length,
        total_basket_shift: round(total),
        defenders_within_3m_of_handler: defendersNearHandler,
        offense_left_unguarded: offense(states[endIndex]).filter((o) => {
          const n = nearestOpponent(states[endIndex], o)
          return n ? n.distance > config.openSpaceThreshold : false
        }).length,
      },
      confidence: clamp(0.4 + 0.12 * collapsing.length),
    })
  }

  return events.sort((a, b) => a.timestamp - b.timestamp)
}

function headingTo(p: { x: number; y: number; vx: number; vy: number; speed: number }, target: { x: number; y: number }) {
  if (p.speed === 0) return 0
  const d = dist(p, target)
  if (d === 0) return 0
  return (p.vx * (target.x - p.x) + p.vy * (target.y - p.y)) / (d * p.speed)
}

function round(v: number, p = 2) {
  const f = 10 ** p
  return Math.round(v * f) / f
}

function clamp(v: number) {
  return Math.min(0.99, Math.max(0.2, round(v)))
}
