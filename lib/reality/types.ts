/**
 * Reality Engine data model.
 *
 * Reality       -> CourtState[]        physical state only (positions, velocity, ball)
 * Structure     -> BasketballEvent[]   discovered by detectors
 * Understanding -> Evidence / PlayGraph measured values and causal edges
 * Story         -> Commentary          language grounded in evidence
 *
 * Units: meters, meters/second, seconds (clip-relative).
 */

import type { CausalGraph, CausalTrace } from "./causal"
import type { CausalStory } from "./causal-story"
import type { BasketSide } from "./court"
import type { RealityIntegrity } from "./integrity"

export type Team = "offense" | "defense"

export interface PlayerState {
  id: string
  team: Team
  x: number
  y: number
  vx: number
  vy: number
  speed: number
}

export interface BallState {
  x: number
  y: number
  z?: number
  possessor?: string
}

export interface CourtState {
  timestamp: number
  gameClock: string
  players: PlayerState[]
  ball: BallState
}

export interface RosterEntry {
  id: string
  team: Team
  number: number
  name: string
  role: string
}

export type EventType =
  | "DRIVE"
  | "HELP_DEFENSE"
  | "DEFENSIVE_COLLAPSE"
  | "OPEN_SPACE"
  | "PASS"
  | "OPEN_THREE"

export type EvidenceValue = number | string

export interface BasketballEvent {
  id: string
  type: EventType
  /** Onset time, seconds. */
  timestamp: number
  /** End of the event window when the detector tracks one. */
  endTimestamp?: number
  /** Time at which the measured quantity peaked, for stateful events. */
  peakTimestamp?: number
  /** endTimestamp - timestamp, seconds, for stateful events. */
  duration?: number
  actor?: string
  target?: string
  evidence: Record<string, EvidenceValue>
  /** 0..1 */
  confidence: number
}

export interface Localized {
  zh: string
  en: string
}

/** A single measured value, promoted from an event's evidence record. */
export interface Evidence {
  id: string
  /** Key inside the source event's evidence record. */
  key: string
  label: Localized
  value: number
  unit: string
  precision: number
  sourceEventId: string
  description: Localized
}

export type Relationship =
  | "TRIGGERED"
  | "CREATED"
  | "ENABLED"
  | "CONSTRAINED"
  | "PRECEDED"

export interface PlayGraphNode {
  id: string
  eventId: string
  type: EventType
  timestamp: number
}

export interface PlayGraphEdge {
  source: string
  target: string
  relationship: Relationship
  evidence: Record<string, EvidenceValue>
}

export interface PlayGraph {
  nodes: PlayGraphNode[]
  edges: PlayGraphEdge[]
}

export type CommentaryAudience = "public" | "pro" | "coach"

export type CommentarySegment =
  | { kind: "text"; value: string }
  | { kind: "evidence"; evidenceId: string; value: string }
  | { kind: "event"; eventId: string; value: string }

export interface Commentary {
  audience: CommentaryAudience
  label: Localized
  segments: CommentarySegment[]
  /** Same claims, same grounding, English wording. */
  segmentsEn: CommentarySegment[]
  /** Evidence ids to surface as chips beneath the text. */
  chips: string[]
}

export interface DetectorConfig {
  /** Which basket the offense attacks. Set by the adapter from the data, never assumed. */
  attackingBasket: BasketSide
  /** Nearest-defender distance (m) at which an offensive player ENTERS the OPEN state. */
  openSpaceThreshold: number
  /** Nearest-defender distance (m) below which an OPEN player returns to COVERED (hysteresis). */
  openSpaceExitThreshold: number
  /** Gap (s) under which two windows of the same stateful event are one continuous state. */
  eventMergeGap: number
  /** Minimum ball-handler speed (m/s) toward the basket to call a DRIVE. */
  driveSpeedThreshold: number
  /** Minimum displacement (m) toward the paint/handler to call HELP_DEFENSE. */
  helpShiftThreshold: number
  /** Minimum basket-distance decrease (m) for a defender to count as collapsing. */
  collapseShiftThreshold: number
  /** Minimum number of collapsing defenders for DEFENSIVE_COLLAPSE. */
  collapseMinDefenders: number
  /** Nearest-defender distance (m) at release below which a three is contested. */
  contestDistance: number
}

/** Values the commentary layer is allowed to talk about. Nothing else. */
export type CommentaryContext = Record<string, EvidenceValue | undefined>

export interface PossessionAnalysis {
  states: CourtState[]
  events: BasketballEvent[]
  /** Causal view: edges with a causal relation only (derived from `causal`). */
  graph: PlayGraph
  /** Every evaluated candidate edge with its tests, factors and counterfactual. */
  causal: CausalGraph
  /** WHAT CREATED THE SHOT? — backward walk over SUPPORTED edges. */
  trace: CausalTrace
  causalStory: CausalStory
  evidence: Evidence[]
  commentaryContext: CommentaryContext
  commentary: Commentary[]
  config: DetectorConfig
  engine: { name: string; version: string }
  /** The physical validation the analysis was gated on. */
  integrity: RealityIntegrity
}
