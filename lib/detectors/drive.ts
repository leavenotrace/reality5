import {
  COURT_M,
  distanceToBasket,
  headingToward,
  playerById,
} from "@/lib/reality/court-state"
import type { BasketballEvent, CourtState, DetectorConfig } from "@/lib/reality/types"

const HEADING_MIN = 0.6
const MIN_FRAMES = 3

/**
 * DRIVE: the ball handler moves toward the basket above a speed threshold
 * while the distance to the basket decreases. Emits one event per drive
 * window (onset → end), never per frame.
 */
export function detectDrive(states: CourtState[], config: DetectorConfig): BasketballEvent[] {
  const events: BasketballEvent[] = []
  let active: {
    handler: string
    startIndex: number
    peakSpeed: number
    startDistance: number
    frames: number
  } | null = null

  const close = (endIndex: number) => {
    if (!active) return
    if (active.frames >= MIN_FRAMES) {
      const start = states[active.startIndex]
      const end = states[endIndex]
      const handlerEnd = playerById(end, active.handler)
      const endDistance = handlerEnd ? distanceToBasket(handlerEnd) : active.startDistance
      const distanceGained = active.startDistance - endDistance
      const speedMargin = active.peakSpeed / config.driveSpeedThreshold
      events.push({
        id: `drive_${events.length + 1}`,
        type: "DRIVE",
        timestamp: start.timestamp,
        endTimestamp: end.timestamp,
        actor: active.handler,
        evidence: {
          player: active.handler,
          speed: round(active.peakSpeed),
          speed_threshold: config.driveSpeedThreshold,
          distance_to_basket_start: round(active.startDistance),
          distance_to_basket_end: round(endDistance),
          distance_to_basket_change: round(-distanceGained),
          direction: "toward_basket",
          duration: round(end.timestamp - start.timestamp),
        },
        confidence: clamp(0.55 + 0.25 * (speedMargin - 1) + 0.05 * distanceGained),
      })
    }
    active = null
  }

  for (let i = 0; i < states.length; i++) {
    const state = states[i]
    const holderId = state.ball.possessor
    const holder = holderId ? playerById(state, holderId) : undefined

    if (!holder) {
      close(Math.max(0, i - 1))
      continue
    }

    const heading = headingToward(holder, COURT_M.basket)
    const prev = states[i - 1] && holderId ? playerById(states[i - 1], holderId) : undefined
    const closing = prev ? distanceToBasket(holder) < distanceToBasket(prev) - 0.05 : false
    const driving = holder.speed >= config.driveSpeedThreshold && heading >= HEADING_MIN && closing

    if (driving) {
      if (!active || active.handler !== holderId) {
        close(Math.max(0, i - 1))
        active = {
          handler: holderId!,
          startIndex: i,
          peakSpeed: holder.speed,
          startDistance: distanceToBasket(holder),
          frames: 1,
        }
      } else {
        active.frames += 1
        active.peakSpeed = Math.max(active.peakSpeed, holder.speed)
      }
    } else if (active) {
      close(Math.max(0, i - 1))
    }
  }
  close(states.length - 1)
  return events
}

function round(v: number, p = 2) {
  const f = 10 ** p
  return Math.round(v * f) / f
}

function clamp(v: number) {
  return Math.min(0.99, Math.max(0.2, round(v)))
}
