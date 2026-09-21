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

export interface CausalComparison {
  /** Event-type chain of the supported trace, cause → effect. */
  chainA: string[]
  chainB: string[]
  /** Every rule-covered pair seen in either reality with its status on each side. */
  edges: {
    key: string
    label: string
    relationA: string | null
    statusA: string | null
    relationB: string | null
    statusB: string | null
    differs: boolean
    consequence: string | null
  }[]
  /** Physical facts that explain why the structures differ. */
  facts: ComparisonRow[]
}

export function compareCausalStructure(
  first: PossessionAnalysis,
  second: PossessionAnalysis,
): CausalComparison {
  const fa = measureFacts(first)
  const fb = measureFacts(second, { defender: fa.weakSideDefender, spacing: fa.spacingPlayer })
  const threshold = first.config.openSpaceThreshold

  const chainOf = (a: PossessionAnalysis) => {
    if (a.trace.chain.length === 0) {
      const root = a.causal.nodes.find((n) => n.eventId === a.trace.rootEventId)
      return root ? [root.type] : []
    }
    return [...a.trace.chain.map((e) => e.fromType), a.trace.chain[a.trace.chain.length - 1].toType]
  }

  const keyOf = (e: { fromType: string; toType: string }) => `${e.fromType}->${e.toType}`
  const relevant = (a: PossessionAnalysis) =>
    a.causal.edges.filter((e) => !e.ruleless)
  const keys = new Set<string>([...relevant(first).map(keyOf), ...relevant(second).map(keyOf)])

  const edges = [...keys].map((key) => {
    const ea = relevant(first).find((e) => keyOf(e) === key)
    const eb = relevant(second).find((e) => keyOf(e) === key)
    const statusA = ea?.status ?? null
    const statusB = eb?.status ?? null
    const differs = statusA !== statusB || (ea?.relation ?? null) !== (eb?.relation ?? null)
    let consequence: string | null = null
    if (differs) {
      const [from, to] = key.split("->")
      const short = (t: string) => t.replace("_DEFENSE", "").replace("_SPACE", "").replace("DEFENSIVE_", "")
      if (statusA === "SUPPORTED" && statusB !== "SUPPORTED") {
        consequence = `${short(from)} → ${short(to)} edge ${statusB ? `degrades to ${statusB}` : "disappears"}`
      } else if (statusB === "SUPPORTED" && statusA !== "SUPPORTED") {
        consequence = `${short(from)} → ${short(to)} edge appears`
      } else {
        consequence = `${short(from)} → ${short(to)} ${statusA ?? "—"} → ${statusB ?? "—"}`
      }
    }
    return {
      key,
      label: key.replace("->", " → ").replace(/_/g, " "),
      relationA: ea?.relation ?? null,
      statusA,
      relationB: eb?.relation ?? null,
      statusB,
      differs,
      consequence,
    }
  })

  const m = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}m`)
  const reached = (v: number | null) => (v === null ? "—" : v >= threshold ? "REACHED" : "NOT REACHED")
  const facts: ComparisonRow[] = [
    { label: `${fa.weakSideDefender ?? "Defender"} shift`, a: m(fa.defenderShift), b: m(fb.defenderShift) },
    { label: `${fa.spacingPlayer ?? "Shooter"} max defender distance`, a: m(fa.maxOpenDistance), b: m(fb.maxOpenDistance) },
    { label: `OPEN_SPACE threshold (${threshold.toFixed(1)}m)`, a: reached(fa.maxOpenDistance), b: reached(fb.maxOpenDistance) },
    { label: "Supported causal edges", a: String(first.trace.chain.length), b: String(second.trace.chain.length) },
  ].map((r) => ({ ...r, differs: r.a !== r.b }))

  return { chainA: chainOf(first), chainB: chainOf(second), edges, facts }
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
