/**
 * Reality5 core data model.
 *
 * Reality  -> CourtState / PlayerTrack   (what physically happened)
 * Structure -> BasketballEvent / PlayGraph (how the moments relate)
 * Understanding -> Evidence               (measurable proof)
 * Story -> Commentary                     (language, grounded in evidence)
 *
 * All positions are in court feet. Origin is the left corner of the baseline
 * (looking from the offensive half toward the basket), x runs along the
 * baseline (0..50), y runs from the baseline toward half court (0..47).
 * All times are seconds relative to the start of the video clip.
 */

export type Vec2 = { x: number; y: number }

export type Team = "offense" | "defense"

export type PlayerId = string

export interface Player {
  id: PlayerId
  team: Team
  number: number
  name: string
  role: string
}

export interface TrackKeyframe {
  t: number
  pos: Vec2
  /** Optional height in feet, used for the ball during a shot arc. */
  z?: number
}

export interface PlayerTrack {
  playerId: PlayerId
  keyframes: TrackKeyframe[]
}

export interface BallTrack {
  keyframes: TrackKeyframe[]
  /** Player in possession per time range, used to snap the ball to the handler. */
  possession: { from: number; to: number; playerId: PlayerId }[]
}

/** Resolved snapshot of the court at a single instant. */
export interface CourtState {
  t: number
  players: Record<PlayerId, Vec2>
  ball: Vec2 & { z: number }
}

export type EventType =
  | "DRIVE"
  | "HELP_DEFENSE"
  | "DEFENSIVE_COLLAPSE"
  | "OPEN_SPACE"
  | "PASS"
  | "OPEN_THREE"

export type OverlayColor = "movement" | "tactical" | "space" | "neutral"

/** A point on the court: either a player (at a given time) or a fixed coordinate. */
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
  | {
      kind: "defensive" | "open"
      shape: "circle"
      center: Anchor
      radius: number
    }
  | {
      kind: "defensive" | "open"
      shape: "polygon"
      points: Anchor[]
    }

export interface OverlayLabel {
  anchor: Anchor
  offset?: Vec2
  color: OverlayColor
  /** Reference an Evidence item to render its value, or supply raw text. */
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

export interface Localized {
  zh: string
  en: string
}

export interface BasketballEvent {
  id: string
  index: number
  type: EventType
  /** Broadcast clock label, e.g. "07:40.1". */
  clock: string
  /** Seconds relative to clip start. */
  t: number
  title: Localized
  summary: Localized
  actors: PlayerId[]
  evidenceIds: string[]
  overlay: OverlaySpec
}

export interface Evidence {
  id: string
  label: Localized
  value: number
  unit: string
  precision: number
  sourceEventId: string
  description: Localized
}

export interface PlayGraphEdge {
  from: string
  to: string
  relation: "causes" | "enables" | "leads_to"
}

export interface PlayGraph {
  nodeIds: string[]
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
}

export interface VideoSource {
  /** Real clip URL. When null the workspace runs on an internal clock. */
  src: string | null
  poster: string
  /** Seconds into the source video where the possession clip starts. */
  clipStart: number
  duration: number
  /** Broadcast clock at t = 0. */
  clockAtStart: string
}

export interface Possession {
  id: string
  game: {
    home: string
    away: string
    label: string
    quarter: string
  }
  video: VideoSource
  players: Player[]
  tracks: PlayerTrack[]
  ball: BallTrack
  events: BasketballEvent[]
  evidence: Evidence[]
  playGraph: PlayGraph
  commentary: Commentary[]
}
