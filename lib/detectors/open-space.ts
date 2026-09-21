import { nearestOpponent, offense } from "@/lib/reality/court-state"
import type { BasketballEvent, CourtState, DetectorConfig } from "@/lib/reality/types"

interface OpenWindow {
  startIndex: number
  enterDistance: number
  peakDistance: number
  peakIndex: number
  defenderAtPeak: string
  hadBall: boolean
}

/**
 * OPEN_SPACE is a STATEFUL event driven by a two-threshold state machine:
 *
 *   COVERED --(distance >= openSpaceThreshold)--> OPEN
 *   OPEN    --(distance <  openSpaceExitThreshold)--> COVERED
 *
 * One event per COVERED → OPEN → COVERED cycle, carrying start, peak, end
 * and duration. Distances are nearest-defender Euclidean distance in court
 * meters. A player who stays open for two seconds yields ONE event.
 */
export function detectOpenSpace(states: CourtState[], config: DetectorConfig): BasketballEvent[] {
  const events: BasketballEvent[] = []
  const enter = config.openSpaceThreshold
  const exit = Math.min(config.openSpaceExitThreshold, enter)
  const open = new Map<string, OpenWindow>()

  const close = (playerId: string, w: OpenWindow, endIndex: number, exitDistance: number) => {
    const start = states[w.startIndex]
    const end = states[endIndex]
    const peak = states[w.peakIndex]
    events.push({
      id: `open_${events.length + 1}`,
      type: "OPEN_SPACE",
      timestamp: start.timestamp,
      endTimestamp: end.timestamp,
      peakTimestamp: peak.timestamp,
      duration: round(end.timestamp - start.timestamp),
      actor: playerId,
      target: w.defenderAtPeak,
      evidence: {
        player: playerId,
        nearest_defender: w.defenderAtPeak,
        enter_distance: round(w.enterDistance),
        peak_open_distance: round(w.peakDistance),
        peak_open_at: peak.timestamp,
        exit_distance: round(exitDistance),
        duration: round(end.timestamp - start.timestamp),
        threshold: enter,
        exit_threshold: exit,
        has_ball: w.hadBall ? "yes" : "no",
      },
      confidence: confidenceFor(w.peakDistance, enter),
    })
  }

  for (let i = 0; i < states.length; i++) {
    const state = states[i]
    for (const player of offense(state)) {
      const nearest = nearestOpponent(state, player)
      if (!nearest) continue
      const w = open.get(player.id)

      if (!w) {
        if (nearest.distance >= enter) {
          open.set(player.id, {
            startIndex: i,
            enterDistance: nearest.distance,
            peakDistance: nearest.distance,
            peakIndex: i,
            defenderAtPeak: nearest.id,
            hadBall: state.ball.possessor === player.id,
          })
        }
        continue
      }

      if (nearest.distance < exit) {
        close(player.id, w, i, nearest.distance)
        open.delete(player.id)
        continue
      }

      if (nearest.distance > w.peakDistance) {
        w.peakDistance = nearest.distance
        w.peakIndex = i
        w.defenderAtPeak = nearest.id
      }
      if (state.ball.possessor === player.id) w.hadBall = true
    }
  }

  // Windows still open at the end of the clip close on the final frame.
  const last = states.length - 1
  for (const [playerId, w] of open) {
    const p = offense(states[last]).find((o) => o.id === playerId)
    const nearest = p ? nearestOpponent(states[last], p) : null
    close(playerId, w, last, nearest?.distance ?? w.peakDistance)
  }

  return events.sort((a, b) => a.timestamp - b.timestamp)
}

function confidenceFor(distance: number, threshold: number) {
  return Math.min(0.99, Math.max(0.2, round(0.5 + (distance - threshold) / threshold)))
}

function round(v: number, p = 2) {
  const f = 10 ** p
  return Math.round(v * f) / f
}
