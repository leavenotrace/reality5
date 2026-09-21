import type { NormalizedTracking, TrackingSourceKind } from "@/lib/adapters/types"
import type { PossessionAnalysis } from "@/lib/reality/types"
import { presentEvents } from "./presentation"
import type { Possession } from "./types"

/**
 * Wraps engine output in the Possession envelope the workspace renders.
 * Pure and client-safe: the same function serves sample data on the server
 * and uploaded JSON in the browser. The UI never learns where data came from
 * beyond the `dataSource.source` label.
 */
export function buildPossession(
  tracking: NormalizedTracking,
  analysis: PossessionAnalysis,
  options: { label: string; source: TrackingSourceKind; id?: string },
): Possession {
  const engine = `${analysis.engine.name} ${analysis.engine.version}`
  const clockAtStart = tracking.meta.clockAtStart

  return {
    id: options.id ?? `${tracking.meta.gameId}:${tracking.meta.possessionId}`,
    label: options.label,
    game: {
      home: "LAC",
      away: "DEN",
      label: engine,
      quarter: "Q2",
    },
    tracking,
    video: {
      src: null,
      poster: "/video/court-poster.png",
      clipStart: 458,
      duration: tracking.meta.duration,
      clockAtStart,
    },
    players: tracking.roster,
    dataSource: {
      source: options.source,
      engine,
      sampleRateHz: Math.round(1 / tracking.meta.sampleRate),
      frames: tracking.states.length,
      adapter: tracking.meta.adapter,
    },
    analysis,
    events: presentEvents(analysis, tracking.roster, clockAtStart),
    evidence: analysis.evidence,
    playGraph: analysis.graph,
    commentary: analysis.commentary,
  }
}
