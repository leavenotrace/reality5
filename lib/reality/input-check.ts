import type { AdapterResult, InputIssue, NormalizedTracking } from "@/lib/adapters/types"
import { NBA_COURT } from "./court"
import type { CheckState, IntegrityViolation, RealityIntegrity } from "./integrity"

export interface InputCheckRow {
  label: string
  value: string
  status: CheckState
}

export interface RealityInputCheck {
  /** Schema parsed AND reality is physically valid: analysis may run. */
  sufficient: boolean
  /** "INSUFFICIENT" = schema/structure missing; "INVALID" = physics vetoed it. */
  verdict: "VALID" | "WARNING" | "INSUFFICIENT" | "INVALID"
  rows: InputCheckRow[]
  integrity?: RealityIntegrity
  /** The violation to explain first (errors before warnings, earliest frame first). */
  primaryViolation?: IntegrityViolation
  errors: InputIssue[]
  warnings: InputIssue[]
}

const mark = (s: CheckState) => (s === "ok" ? "✓" : s === "warn" ? "⚠" : "✕")

function integrityRows(i: RealityIntegrity): InputCheckRow[] {
  return [
    { label: "Coordinate System", value: i.coordinateSystem, status: "ok" },
    { label: "Court Bounds", value: mark(i.courtBounds), status: i.courtBounds },
    { label: "Timestamp Integrity", value: mark(i.timestampIntegrity), status: i.timestampIntegrity },
    { label: "Player Identity", value: mark(i.playerIdentityIntegrity), status: i.playerIdentityIntegrity },
    { label: "Physical Movement", value: mark(i.physicalMovement), status: i.physicalMovement },
  ]
}

export function primaryViolation(i?: RealityIntegrity): IntegrityViolation | undefined {
  if (!i) return undefined
  return [...i.violations].sort(
    (a, b) =>
      Number(a.severity === "warn") - Number(b.severity === "warn") || (a.frame ?? 0) - (b.frame ?? 0),
  )[0]
}

/**
 * REALITY INPUT CHECK. Reports what the adapter could read and whether the
 * physical reality it describes is valid. Missing data is INSUFFICIENT
 * REALITY; physically impossible data is INVALID REALITY. In both cases the
 * engine refuses to interpret.
 */
export function checkRealityInput(result: AdapterResult): RealityInputCheck {
  if (!result.ok) {
    const { integrity, summary } = result
    if (!integrity) {
      return {
        sufficient: false,
        verdict: "INSUFFICIENT",
        rows: [{ label: "Schema", value: "✕", status: "fail" }],
        errors: result.errors,
        warnings: result.warnings,
      }
    }
    const rows: InputCheckRow[] = [
      { label: "Schema", value: "✓", status: "ok" },
      ...(summary
        ? [
            { label: "Frames", value: String(summary.frames), status: "ok" as CheckState },
            { label: "Duration", value: `${summary.duration.toFixed(1)} s`, status: "ok" as CheckState },
            { label: "Players", value: String(summary.offense + summary.defense), status: "ok" as CheckState },
            { label: "Offense", value: String(summary.offense), status: integrity.playerCount },
            { label: "Defense", value: String(summary.defense), status: integrity.playerCount },
          ]
        : []),
      ...integrityRows(integrity),
    ]
    return {
      sufficient: false,
      verdict: "INVALID",
      rows,
      integrity,
      primaryViolation: primaryViolation(integrity),
      errors: result.errors,
      warnings: result.warnings,
    }
  }

  const t = result.tracking
  const i = t.integrity
  const offense = t.roster.filter((p) => p.team === "offense").length
  const defense = t.roster.filter((p) => p.team === "defense").length
  const possessedFrames = t.states.filter((s) => s.ball.possessor).length
  const hasWarning = (code: string) => result.warnings.some((w) => w.code === code)

  const rows: InputCheckRow[] = [
    { label: "Schema", value: "✓", status: "ok" },
    { label: "Frames", value: String(t.states.length), status: "ok" },
    { label: "Duration", value: `${t.meta.duration.toFixed(1)} s`, status: "ok" },
    {
      label: "Sample Rate",
      value: `${Math.round(1 / t.meta.sampleRate)} Hz`,
      status: hasWarning("FPS_MISMATCH") ? "warn" : "ok",
    },
    { label: "Players", value: String(t.roster.length), status: "ok" },
    { label: "Offense", value: String(offense), status: offense === 5 ? "ok" : "warn" },
    { label: "Defense", value: String(defense), status: defense === 5 ? "ok" : "warn" },
    { label: "Ball Tracking", value: "✓", status: "ok" },
    {
      label: "Possession",
      value: possessedFrames === t.states.length ? "✓" : `${possessedFrames}/${t.states.length} frames`,
      status: "ok",
    },
    ...integrityRows(i),
    {
      label: "Attacking Basket",
      value: `${t.meta.attackingBasket.toUpperCase()} (${NBA_COURT[t.meta.attackingBasket === "left" ? "leftBasket" : "rightBasket"].x} m)`,
      status: "ok",
    },
    {
      label: "Game Clock",
      value: t.meta.clockDerived ? "derived" : "✓",
      status: t.meta.clockDerived ? "warn" : "ok",
    },
  ]

  return {
    sufficient: true,
    verdict: i.status === "WARNING" ? "WARNING" : "VALID",
    rows,
    integrity: i,
    primaryViolation: primaryViolation(i),
    errors: [],
    warnings: result.warnings,
  }
}

export function describeTracking(t: NormalizedTracking) {
  return `${t.states.length} frames · ${t.meta.duration.toFixed(1)}s · ${t.roster.length} players`
}
