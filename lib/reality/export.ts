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
      coordinateSystem: tracking.meta.coordinateSystem,
      attackingBasket: tracking.meta.attackingBasket,
    },
    realityIntegrity: {
      valid: analysis.integrity.valid,
      status: analysis.integrity.status,
      coordinateSystem: analysis.integrity.coordinateSystem,
      courtBounds: analysis.integrity.courtBounds === "ok",
      timestampIntegrity: analysis.integrity.timestampIntegrity === "ok",
      playerIdentityIntegrity: analysis.integrity.playerIdentityIntegrity === "ok",
      physicalMovement: analysis.integrity.physicalMovement !== "fail",
      playerCount: analysis.integrity.playerCount === "ok",
      warnings: analysis.integrity.warnings,
      violations: analysis.integrity.violations,
      limits: analysis.integrity.limits,
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
    causalGraph: {
      principle: "CORRELATION IS NOT CAUSATION. TEMPORAL ORDER ALONE MUST NOT CREATE A CAUSAL EDGE.",
      nodes: rest.causal.nodes,
      edges: rest.causal.edges.map((e) => ({
        id: e.id,
        from: e.fromEventId,
        to: e.toEventId,
        fromType: e.fromType,
        toType: e.toType,
        relation: e.relation,
        candidateRelation: e.candidateRelation,
        status: e.status,
        confidence: e.confidence,
        evidence: e.evidence,
        tests: e.tests,
        confidenceFactors: e.factors,
        counterfactual: e.counterfactual ?? null,
        alternativeExplanation: e.alternativeExplanation ?? null,
        claims: e.claims,
      })),
      whatCreatedTheShot: {
        rootEventId: rest.trace.rootEventId,
        chain: rest.trace.chain.map((e) => ({ from: e.fromEventId, to: e.toEventId, relation: e.relation, confidence: e.confidence })),
        stoppedAt: rest.trace.stoppedAt,
      },
    },
    causalStory: rest.causalStory,
    evidence: rest.evidence,
    commentaryContext: rest.commentaryContext,
    commentary: rest.commentary,
  }
}

export function exportFileName(tracking: NormalizedTracking) {
  return `reality5-${tracking.meta.possessionId}-analysis.json`
}
