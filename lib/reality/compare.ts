import { dist, nearestDefenderDistance, playerById } from "./court-state"
import type { EventType, PossessionAnalysis } from "./types"

export interface RealityFacts {
  /** Weak-side defender under analysis and its max displacement before the ball leaves the handler. */
  weakSideDefender: string | null
  defenderShift: number | null
  /** Offensive player whose openness is under analysis and its peak nearest-defender distance. */
  spacingPlayer: string | null
  maxOpenDistance: number | null
  detected: Record<EventType, boolean>
  nodes: number
  edges: number
  evidence: number
  shot: "open" | "contested" | "none"
}

const TYPES: EventType[] = [
  "DRIVE",
  "HELP_DEFENSE",
  "DEFENSIVE_COLLAPSE",
  "OPEN_SPACE",
  "PASS",
  "OPEN_THREE",
]

/**
 * Facts measured directly from an analysis. Used for REALITY COMPARISON; the
 * defender/spacing player can be pinned so two realities compare the same
 * bodies even when only one of them produced a HELP_DEFENSE event.
 */
export function measureFacts(
  a: PossessionAnalysis,
  pin: { defender?: string | null; spacing?: string | null } = {},
): RealityFacts {
  const help = a.events.find((e) => e.type === "HELP_DEFENSE")
  const open = a.events.find((e) => e.type === "OPEN_SPACE")
  const pass = a.events.find((e) => e.type === "PASS")
  const three = a.events.find((e) => e.type === "OPEN_THREE")

  const defender = pin.defender ?? help?.actor ?? null
  const spacing = pin.spacing ?? open?.actor ?? null
  const until = pass?.timestamp ?? a.states[a.states.length - 1]?.timestamp ?? 0

  let defenderShift: number | null = null
  if (defender) {
    const origin = playerById(a.states[0], defender)
    if (origin) {
      defenderShift = Math.max(
        0,
        ...a.states
          .filter((s) => s.timestamp <= until)
          .map((s) => {
            const p = playerById(s, defender)
            return p ? dist(p, origin) : 0
          }),
      )
    }
  }

  let maxOpenDistance: number | null = null
  if (spacing) {
    const ds = a.states.map((s) => nearestDefenderDistance(s, spacing)?.distance ?? 0)
    maxOpenDistance = ds.length ? Math.max(...ds) : null
  }

  const detected = Object.fromEntries(
    TYPES.map((t) => [t, a.events.some((e) => e.type === t)]),
  ) as Record<EventType, boolean>

  return {
    weakSideDefender: defender,
    defenderShift,
    spacingPlayer: spacing,
    maxOpenDistance,
    detected,
    nodes: a.graph.nodes.length,
    edges: a.graph.edges.length,
    evidence: a.evidence.length,
    shot: three ? (three.evidence.contested === "yes" ? "contested" : "open") : "none",
  }
}

export interface ComparisonRow {
  label: string
  a: string
  b: string
  differs: boolean
}

export function compareRealities(
  first: PossessionAnalysis,
  second: PossessionAnalysis,
): ComparisonRow[] {
  const fa = measureFacts(first)
  const fb = measureFacts(second, {
    defender: fa.weakSideDefender,
    spacing: fa.spacingPlayer,
  })
  const m = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}m`)
  const det = (v: boolean) => (v ? "Detected" : "Not detected")

  const rows: ComparisonRow[] = [
    { label: `${fa.weakSideDefender ?? "Defender"} shift`, a: m(fa.defenderShift), b: m(fb.defenderShift) },
    {
      label: `${fa.spacingPlayer ?? "Shooter"} max open distance`,
      a: m(fa.maxOpenDistance),
      b: m(fb.maxOpenDistance),
    },
    ...TYPES.map((t) => ({
      label: t.replace("_", " "),
      a: det(fa.detected[t]),
      b: det(fb.detected[t]),
    })),
    { label: "Play Graph", a: `${fa.nodes} nodes · ${fa.edges} edges`, b: `${fb.nodes} nodes · ${fb.edges} edges` },
    { label: "Evidence", a: `${fa.evidence} values`, b: `${fb.evidence} values` },
    { label: "Shot", a: fa.shot, b: fb.shot },
  ].map((r) => ({ ...r, differs: r.a !== r.b }))

  return rows
}
