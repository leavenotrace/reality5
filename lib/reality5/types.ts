/**
 * Reality5 presentation model.
 *
 * Engine types (physical state, events, evidence, graph, commentary) live in
 * lib/reality/types. This file adds only what the UI needs to VISUALIZE an
 * analysis: overlay specs, localized titles, and the Possession envelope.
 *
 * Overlay positions are in court meters (NBA_METRIC; projected by ./court.ts);
 * the engine works in meters and the tracking helpers convert.
 */

import type { NormalizedTracking, TrackingSourceKind } from "@/lib/adapters/types"
import type {
  BasketballEvent as EngineEvent,
  Commentary,
  Evidence,
  Localized,
  PlayGraph,
  PossessionAnalysis,
  RosterEntry,
} from "@/lib/reality/types"

export type {
  Commentary,
  CommentaryAudience,
  CommentarySegment,
  Evidence,
  EventType,
  Localized,
  PlayGraph,
  PlayGraphEdge,
  PlayGraphNode,
  PossessionAnalysis,
  Relationship,
} from "@/lib/reality/types"

export type {
  CausalEdge,
  CausalEvidence,
  CausalFactor,
  CausalGraph,
  CausalJump,
  CausalRelation,
  CausalStatus,
  CausalTest,
  CausalTrace,
  ClaimType,
  Counterfactual,
} from "@/lib/reality/causal"
export type { CausalStory, CausalStorySentence } from "@/lib/reality/causal-story"

export type Vec2 = { x: number; y: number }
export type PlayerId = string
export type Player = RosterEntry

/** Court snapshot resolved for the overlay, in court meters. */
export interface OverlayCourtState {
  t: number
  players: Record<PlayerId, Vec2>
  ball: Vec2 & { z: number }
  possessor?: PlayerId
}

export type OverlayColor = "movement" | "tactical" | "space" | "neutral"

/** A point on the court: either a player (at a given time) or a fixed coordinate (meters). */
export type Anchor = { playerId: PlayerId; t?: number } | Vec2

export interface OverlayHighlight {
  playerId: PlayerId
  color: OverlayColor
  pulse?: boolean
}

export interface OverlayPath {
  playerId: PlayerId
  from: number
  to: number
  color: OverlayColor
}

export interface OverlayArrow {
  from: Anchor
  to: Anchor
  kind: "pass" | "defense" | "movement"
}

export type OverlayZone =
  | { kind: "defensive" | "open"; shape: "circle"; center: Anchor; radius: number }
  | { kind: "defensive" | "open"; shape: "polygon"; points: Anchor[] }

export interface OverlayLabel {
  anchor: Anchor
  offset?: Vec2
  color: OverlayColor
  evidenceId?: string
  text?: string
}

export interface OverlayMeasure {
  from: Anchor
  to: Anchor
  evidenceId: string
  color: OverlayColor
}

export interface OverlaySpec {
  highlights?: OverlayHighlight[]
  paths?: OverlayPath[]
  arrows?: OverlayArrow[]
  zones?: OverlayZone[]
  labels?: OverlayLabel[]
  measures?: OverlayMeasure[]
}

/** A detected event decorated for display. */
export interface PresentedEvent extends EngineEvent {
  index: number
  /** Clip-relative seconds (alias of timestamp). */
  t: number
  /** Broadcast clock label. */
  clock: string
  title: Localized
  summary: Localized
  actors: PlayerId[]
  evidenceIds: string[]
  overlay: OverlaySpec
}

export interface VideoSource {
  src: string | null
  poster: string
  clipStart: number
  duration: number
  clockAtStart: string
}

export interface DataSourceInfo {
  source: TrackingSourceKind
  engine: string
  sampleRateHz: number
  frames: number
  adapter: string
}

export interface Possession {
  id: string
  /** Display name, e.g. "Sample Possession 01" or the uploaded file name. */
  label: string
  game: { home: string; away: string; label: string; quarter: string }
  /** Adapter output the analysis was computed from. */
  tracking: NormalizedTracking
  video: VideoSource
  players: Player[]
  dataSource: DataSourceInfo
  /** Raw engine output — the single source of truth. */
  analysis: PossessionAnalysis
  /** Derived views of `analysis` for the UI. */
  events: PresentedEvent[]
  evidence: Evidence[]
  playGraph: PlayGraph
  commentary: Commentary[]
}
