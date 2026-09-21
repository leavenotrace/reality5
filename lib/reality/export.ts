import type { NormalizedTracking, TrackingSourceKind } from "@/lib/adapters/types"
import type { PossessionAnalysis } from "./types"

/**
 * Reality5's structured understanding of a possession. Raw tracking frames
 * are intentionally excluded — this file is what the engine CONCLUDED, with
 * every value traceable to a detector and a frame range.
 */
export function exportAnalysis(
  tracking: NormalizedTracking,
  analysis: PossessionAnalysis,
  source: TrackingSourceKind,
) {
  const { states, ...rest } = analysis
  const offense = tracking.roster.filter((p) => p.team === "offense").length
  return {
    metadata: {
      exportedAt: new Date().toISOString(),
      engine: analysis.engine,
      source,
      adapter: tracking.meta.adapter,
      gameId: tracking.meta.gameId,
      possessionId: tracking.meta.possessionId,
      unit: tracking.meta.unit,
    },
    normalizedSummary: {
      frames: states.length,
      sampleRate: tracking.meta.sampleRate,
      duration: tracking.meta.duration,
      clockAtStart: tracking.meta.clockAtStart,
      players: tracking.roster.length,
      offense,
      defense: tracking.roster.length - offense,
      roster: tracking.roster,
    },
    detectorConfig: rest.config,
    events: rest.events.map((e) => ({
      ...e,
      frames: {
        from: Math.round(e.timestamp / tracking.meta.sampleRate),
        to: Math.round((e.endTimestamp ?? e.timestamp) / tracking.meta.sampleRate),
      },
    })),
    playGraph: rest.graph,
    evidence: rest.evidence,
    commentaryContext: rest.commentaryContext,
    commentary: rest.commentary,
  }
}

export function exportFileName(tracking: NormalizedTracking) {
  return `reality5-${tracking.meta.possessionId}-analysis.json`
}
