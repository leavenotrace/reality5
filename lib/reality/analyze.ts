import { runDetectors } from "@/lib/detectors"
import { buildPlayGraph } from "@/lib/reasoning/play-graph"
import { buildCommentary, buildCommentaryContext } from "./commentary"
import { DEFAULT_DETECTOR_CONFIG } from "./config"
import { deriveKinematics } from "./court-state"
import { promoteEvidence } from "./evidence"
import type { CourtState, DetectorConfig, PossessionAnalysis, RosterEntry } from "./types"

export const ENGINE = { name: "REALITY ENGINE", version: "V0.3" } as const

/**
 * Mock Tracking Data → Court State → Detectors → Events → Play Graph →
 * Evidence → Commentary. The UI only visualizes this result.
 */
export function analyzePossession(
  rawStates: CourtState[],
  options: { config?: Partial<DetectorConfig>; roster?: RosterEntry[] } = {},
): PossessionAnalysis {
  const config: DetectorConfig = { ...DEFAULT_DETECTOR_CONFIG, ...options.config }
  const roster = options.roster ?? rosterFromStates(rawStates)

  const states = deriveKinematics(rawStates)
  const events = runDetectors(states, config)
  const graph = buildPlayGraph(events)
  const evidence = promoteEvidence(events)
  const commentaryContext = buildCommentaryContext(events, config)
  const commentary = buildCommentary(events, commentaryContext, roster)

  return { states, events, graph, evidence, commentaryContext, commentary, config, engine: ENGINE }
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
