import { runDetectors } from "@/lib/detectors"
import { buildPlayGraph } from "@/lib/reasoning/play-graph"
import { buildCommentary, buildCommentaryContext } from "./commentary"
import { DEFAULT_DETECTOR_CONFIG } from "./config"
import { deriveKinematics } from "./court-state"
import { promoteEvidence } from "./evidence"
import { validateRealityIntegrity, type RealityIntegrity } from "./integrity"
import type { CourtState, DetectorConfig, PossessionAnalysis, RosterEntry } from "./types"

export const ENGINE = { name: "REALITY ENGINE", version: "V0.3.1" } as const

export class InvalidRealityError extends Error {
  constructor(public readonly integrity: RealityIntegrity) {
    super(
      `INVALID REALITY: ${integrity.violations
        .filter((v) => v.severity === "error")
        .map((v) => v.message.en)
        .join("; ")}`,
    )
    this.name = "InvalidRealityError"
  }
}

/**
 * Reality has veto power. Any caller that reaches the detectors must have a
 * valid integrity result; if none is supplied we validate here and refuse
 * INVALID data instead of interpreting it.
 */
export function assertValidReality(
  states: CourtState[],
  integrity?: RealityIntegrity,
): RealityIntegrity {
  const result = integrity ?? validateRealityIntegrity(states)
  if (!result.valid) throw new InvalidRealityError(result)
  return result
}

/**
 * Mock Tracking Data → Reality Integrity → Court State → Detectors → Events →
 * Play Graph → Evidence → Commentary. The UI only visualizes this result.
 */
export function analyzePossession(
  rawStates: CourtState[],
  options: {
    config?: Partial<DetectorConfig>
    roster?: RosterEntry[]
    integrity?: RealityIntegrity
  } = {},
): PossessionAnalysis {
  const integrity = assertValidReality(rawStates, options.integrity)
  const config: DetectorConfig = {
    ...DEFAULT_DETECTOR_CONFIG,
    attackingBasket: integrity.attackingBasket,
    ...options.config,
  }
  const roster = options.roster ?? rosterFromStates(rawStates)

  const states = deriveKinematics(rawStates)
  const events = runDetectors(states, config)
  const graph = buildPlayGraph(events)
  const evidence = promoteEvidence(events)
  const commentaryContext = buildCommentaryContext(events, config)
  const commentary = buildCommentary(events, commentaryContext, roster)

  return {
    states,
    events,
    graph,
    evidence,
    commentaryContext,
    commentary,
    config,
    engine: ENGINE,
    integrity,
  }
}

function rosterFromStates(states: CourtState[]): RosterEntry[] {
  const first = states[0]
  if (!first) return []
  return first.players.map((p, i) => ({
    id: p.id,
    team: p.team,
    number: Number(p.id.replace(/\D/g, "")) || i + 1,
    name: p.id,
    role: p.team,
  }))
}
