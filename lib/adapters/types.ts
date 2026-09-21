import type { BasketSide } from "@/lib/reality/court"
import type { RealityIntegrity } from "@/lib/reality/integrity"
import type { CourtState, RosterEntry } from "@/lib/reality/types"

/**
 * Input boundary of the Reality Engine.
 *
 * External data (uploaded JSON, sample files, later NBA / AWS feeds) is
 * translated by an adapter into NormalizedTracking. Detectors never see the
 * source format — they only see CourtState[].
 */

export type TrackingSourceKind = "SAMPLE TRACKING" | "UPLOADED JSON" | "PASTED JSON" | "NBA / AWS"

export interface NormalizedTracking {
  meta: {
    gameId: string
    possessionId: string
    /** Seconds between frames. */
    sampleRate: number
    duration: number
    clockAtStart: string
    /** True when the input had no game clock and labels were derived from timestamps. */
    clockDerived: boolean
    unit: "meters"
    /** Always the shared contract in lib/reality/court.ts. */
    coordinateSystem: "NBA_METRIC"
    /** Which basket the offense attacks, from metadata or inferred from the ball. */
    attackingBasket: BasketSide
    adapter: string
  }
  roster: RosterEntry[]
  /** Physical state only. Velocity is filled in by deriveKinematics. */
  states: CourtState[]
  /** Physical validation result. Analysis must refuse anything not `valid`. */
  integrity: RealityIntegrity
}

export interface InputIssue {
  code: string
  message: { zh: string; en: string }
  /** Path into the source document, e.g. frames[3].ball */
  path?: string
}

export type AdapterResult =
  | { ok: true; tracking: NormalizedTracking; warnings: InputIssue[] }
  | {
      ok: false
      errors: InputIssue[]
      warnings: InputIssue[]
      /** Present when the schema parsed but physical validation vetoed the data. */
      integrity?: RealityIntegrity
      /** Frame/roster summary so the input check can still show counts. */
      summary?: { frames: number; duration: number; offense: number; defense: number; possessed: number }
    }

export interface TrackingInputAdapter {
  id: string
  label: string
  /** Cheap structural test so a registry can pick an adapter. */
  canHandle(raw: unknown): boolean
  parse(raw: unknown): AdapterResult
}
