import { nearestOpponent, offense } from "@/lib/reality/court-state"
import type { BasketballEvent, CourtState, DetectorConfig } from "@/lib/reality/types"

/**
 * OPEN_SPACE: for every offensive player at every frame, compute the
 * Euclidean distance to the nearest defender. Emit an event only on the
 * NOT_OPEN → OPEN transition (distance crosses the configurable threshold),
 * and keep tracking the window so the event can report how open the
 * player eventually became.
 */
export function detectOpenSpace(states: CourtState[], config: DetectorConfig): BasketballEvent[] {
  const events: BasketballEvent[] = []
  const threshold = config.openSpaceThreshold
  const open = new Map<string, { eventIndex: number; peak: number; peakT: number }>()

  for (const state of states) {
    for (const player of offense(state)) {
      const nearest = nearestOpponent(state, player)
      if (!nearest) continue
      const isOpen = nearest.distance >= threshold
      const current = open.get(player.id)

      if (isOpen && !current) {
        // NOT_OPEN → OPEN transition
        events.push({
          id: `open_${events.length + 1}`,
          type: "OPEN_SPACE",
          timestamp: state.timestamp,
          actor: player.id,
          target: nearest.id,
          evidence: {
            player: player.id,
            nearest_defender: nearest.id,
            nearest_defender_distance: round(nearest.distance),
            peak_open_distance: round(nearest.distance),
            peak_open_at: state.timestamp,
            threshold,
            has_ball: state.ball.possessor === player.id ? "yes" : "no",
          },
          confidence: confidenceFor(nearest.distance, threshold),
        })
        open.set(player.id, {
          eventIndex: events.length - 1,
          peak: nearest.distance,
          peakT: state.timestamp,
        })
      } else if (isOpen && current) {
        if (nearest.distance > current.peak) {
          current.peak = nearest.distance
          current.peakT = state.timestamp
          const ev = events[current.eventIndex]
          ev.evidence.peak_open_distance = round(nearest.distance)
          ev.evidence.peak_open_at = state.timestamp
          ev.confidence = confidenceFor(nearest.distance, threshold)
        }
        events[current.eventIndex].endTimestamp = state.timestamp
      } else if (!isOpen && current) {
        // OPEN → NOT_OPEN: close the window
        events[current.eventIndex].evidence.closed_at = state.timestamp
        open.delete(player.id)
      }
    }
  }

  return events
}

function confidenceFor(distance: number, threshold: number) {
  return Math.min(0.99, Math.max(0.2, round(0.5 + (distance - threshold) / threshold)))
}

function round(v: number, p = 2) {
  const f = 10 ** p
  return Math.round(v * f) / f
}
