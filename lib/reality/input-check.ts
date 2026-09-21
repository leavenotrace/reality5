import type { AdapterResult, InputIssue, NormalizedTracking } from "@/lib/adapters/types"

export interface InputCheckRow {
  label: string
  value: string
  status: "ok" | "warn" | "fail"
}

export interface RealityInputCheck {
  sufficient: boolean
  rows: InputCheckRow[]
  errors: InputIssue[]
  warnings: InputIssue[]
}

/**
 * REALITY INPUT CHECK. Reports what the adapter could read. When required
 * physical data is missing the result is INSUFFICIENT REALITY — the engine
 * refuses to guess.
 */
export function checkRealityInput(result: AdapterResult): RealityInputCheck {
  if (!result.ok) {
    return {
      sufficient: false,
      rows: [],
      errors: result.errors,
      warnings: result.warnings,
    }
  }
  const t = result.tracking
  const offense = t.roster.filter((p) => p.team === "offense").length
  const defense = t.roster.filter((p) => p.team === "defense").length
  const possessedFrames = t.states.filter((s) => s.ball.possessor).length
  const hasWarning = (code: string) => result.warnings.some((w) => w.code === code)

  const rows: InputCheckRow[] = [
    { label: "Frames", value: String(t.states.length), status: "ok" },
    { label: "Duration", value: `${t.meta.duration.toFixed(1)}s`, status: "ok" },
    {
      label: "Sample rate",
      value: `${Math.round(1 / t.meta.sampleRate)} Hz`,
      status: hasWarning("FPS_MISMATCH") ? "warn" : "ok",
    },
    { label: "Players detected", value: String(t.roster.length), status: "ok" },
    { label: "Offense", value: String(offense), status: offense === 5 ? "ok" : "warn" },
    { label: "Defense", value: String(defense), status: defense === 5 ? "ok" : "warn" },
    { label: "Ball tracking", value: "OK", status: "ok" },
    {
      label: "Possession data",
      value: possessedFrames === t.states.length ? "OK" : `${possessedFrames}/${t.states.length} frames`,
      status: "ok",
    },
    { label: "Coordinate system", value: "OK · meters", status: "ok" },
    {
      label: "Game clock",
      value: t.meta.clockDerived ? "derived" : "OK",
      status: t.meta.clockDerived ? "warn" : "ok",
    },
  ]

  return { sufficient: true, rows, errors: [], warnings: result.warnings }
}

export function describeTracking(t: NormalizedTracking) {
  return `${t.states.length} frames · ${t.meta.duration.toFixed(1)}s · ${t.roster.length} players`
}
