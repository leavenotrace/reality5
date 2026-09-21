import type { BasketballEvent, DetectorConfig, EventType } from "@/lib/reality/types"

/** Event types that describe a continuous physical state rather than an instant. */
const STATEFUL: ReadonlySet<EventType> = new Set(["OPEN_SPACE", "HELP_DEFENSE", "DRIVE"])

/** Evidence keys where the merged value is the max of both windows. */
const PEAK_KEYS = ["peak_open_distance", "peak_shift", "speed", "defender_shift"] as const
/** Evidence keys carried from the later window when merging. */
const TAIL_KEYS = ["exit_distance", "distance_to_basket_end", "distance_to_ball_handler_after", "assignment_distance_after"] as const

/**
 * Generic deduplication: two events of the same type and actor whose windows
 * overlap or sit closer than `eventMergeGap` seconds are one continuous
 * physical state, so they become one event. The merged event keeps the
 * earliest start, latest end, and the higher peak.
 */
export function dedupeEvents(events: BasketballEvent[], config: DetectorConfig): BasketballEvent[] {
  const out: BasketballEvent[] = []
  const lastByKey = new Map<string, BasketballEvent>()

  for (const ev of [...events].sort((a, b) => a.timestamp - b.timestamp)) {
    if (!STATEFUL.has(ev.type) || !ev.actor) {
      out.push(ev)
      continue
    }
    const key = `${ev.type}:${ev.actor}`
    const prev = lastByKey.get(key)
    const prevEnd = prev ? (prev.endTimestamp ?? prev.timestamp) : -Infinity
    if (prev && ev.timestamp - prevEnd <= config.eventMergeGap) {
      merge(prev, ev)
      continue
    }
    out.push(ev)
    lastByKey.set(key, ev)
  }

  return out.sort((a, b) => a.timestamp - b.timestamp)
}

function merge(into: BasketballEvent, next: BasketballEvent) {
  const start = into.timestamp
  const end = Math.max(into.endTimestamp ?? into.timestamp, next.endTimestamp ?? next.timestamp)
  into.endTimestamp = end
  into.duration = round(end - start)
  into.evidence.duration = round(end - start)

  for (const key of PEAK_KEYS) {
    const a = into.evidence[key]
    const b = next.evidence[key]
    if (typeof a === "number" && typeof b === "number" && b > a) {
      into.evidence[key] = b
      if (key === "peak_open_distance") {
        into.evidence.peak_open_at = next.evidence.peak_open_at
        into.peakTimestamp = next.peakTimestamp
        into.target = next.target
      }
      if (key === "peak_shift") {
        into.evidence.peak_shift_at = next.evidence.peak_shift_at
        into.peakTimestamp = next.peakTimestamp
      }
    }
  }
  for (const key of TAIL_KEYS) {
    if (key in next.evidence) into.evidence[key] = next.evidence[key]
  }
  into.confidence = Math.max(into.confidence, next.confidence)
  into.evidence.merged_windows = (Number(into.evidence.merged_windows) || 1) + 1
}

function round(v: number, p = 2) {
  const f = 10 ** p
  return Math.round(v * f) / f
}
