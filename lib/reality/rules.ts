import type { BasketballEvent, DetectorConfig, EventType } from "./types"

/**
 * Human-readable statement of each detector's rule, plus which evidence keys
 * hold the observed value and the threshold it was compared against. Used by
 * the Evidence Trace so every event can show RULE / OBSERVED / THRESHOLD.
 */
export interface DetectorRule {
  rule: (config: DetectorConfig) => string
  observedKey: string
  thresholdKey?: string
  unit: string
}

export const DETECTOR_RULES: Record<EventType, DetectorRule> = {
  DRIVE: {
    rule: (c) => `handler speed toward basket > ${c.driveSpeedThreshold.toFixed(1)} m/s`,
    observedKey: "speed",
    thresholdKey: "speed_threshold",
    unit: "m/s",
  },
  HELP_DEFENSE: {
    rule: (c) => `peak defender shift toward paint > ${c.helpShiftThreshold.toFixed(1)} m (stateful: start → peak → end)`,
    observedKey: "peak_shift",
    thresholdKey: "shift_threshold",
    unit: "m",
  },
  DEFENSIVE_COLLAPSE: {
    rule: (c) =>
      `≥ ${c.collapseMinDefenders} defenders move > ${c.collapseShiftThreshold.toFixed(1)} m toward basket`,
    observedKey: "defenders_collapsing",
    unit: "",
  },
  OPEN_SPACE: {
    rule: (c) =>
      `COVERED → OPEN when nearestDefenderDistance ≥ ${c.openSpaceThreshold.toFixed(2)} m; OPEN → COVERED when < ${c.openSpaceExitThreshold.toFixed(2)} m (one event per state)`,
    observedKey: "peak_open_distance",
    unit: "m",
  },
  PASS: {
    rule: () => "ball possessor changes between two offensive players",
    observedKey: "pass_distance",
    unit: "m",
  },
  OPEN_THREE: {
    rule: (c) =>
      `shot released beyond the arc; contested if nearest defender < ${c.contestDistance.toFixed(1)} m`,
    observedKey: "contest_distance",
    thresholdKey: "contest_threshold",
    unit: "m",
  },
}

export interface EventTrace {
  rule: string
  observed: string
  threshold: string
  /** Inclusive tracking frame range the detector measured. */
  frames: { from: number; to: number }
}

export function traceEvent(
  event: BasketballEvent,
  config: DetectorConfig,
  sampleRate: number,
): EventTrace {
  const spec = DETECTOR_RULES[event.type]
  const observed = event.evidence[spec.observedKey]
  const threshold = spec.thresholdKey ? event.evidence[spec.thresholdKey] : undefined
  const fmt = (v: unknown) =>
    typeof v === "number" ? `${v.toFixed(spec.unit ? 1 : 0)}${spec.unit ? ` ${spec.unit}` : ""}` : v ? String(v) : "—"

  const fallbackThreshold =
    event.type === "OPEN_SPACE"
      ? `${config.openSpaceThreshold.toFixed(1)} m`
      : event.type === "DEFENSIVE_COLLAPSE"
        ? `${config.collapseMinDefenders} defenders`
        : "—"

  const from = Math.round(event.timestamp / sampleRate)
  const to = Math.round((event.endTimestamp ?? event.timestamp) / sampleRate)

  return {
    rule: spec.rule(config),
    observed: fmt(observed),
    threshold: threshold !== undefined ? fmt(threshold) : fallbackThreshold,
    frames: { from, to: Math.max(from, to) },
  }
}
