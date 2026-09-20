import { dist, playerById } from "./court-state"
import type { CourtState, PossessionAnalysis } from "./types"

export interface RealityTestStep {
  id: "tracking" | "events" | "graph" | "explanation"
  label: { zh: string; en: string }
  changed: boolean
  detail: string
}

export interface RealityTestResult {
  pass: boolean
  steps: RealityTestStep[]
}

const eventSignature = (a: PossessionAnalysis) =>
  a.events.map((e) => `${e.type}@${e.timestamp.toFixed(1)}:${e.actor}`).sort().join("|")

const graphSignature = (a: PossessionAnalysis) =>
  a.graph.edges.map((e) => `${e.source}->${e.target}:${e.relationship}`).sort().join("|")

const commentarySignature = (a: PossessionAnalysis) =>
  a.commentary.map((c) => c.segments.map((s) => s.value).join("")).join("\n")

/** Max distance any player moves between the two datasets at the same frame. */
function trackingDelta(a: CourtState[], b: CourtState[]) {
  let maxDelta = 0
  let playerId = ""
  const frames = Math.min(a.length, b.length)
  for (let i = 0; i < frames; i++) {
    for (const p of a[i].players) {
      const q = playerById(b[i], p.id)
      if (!q) continue
      const d = dist(p, q)
      if (d > maxDelta) {
        maxDelta = d
        playerId = p.id
      }
    }
  }
  return { maxDelta, playerId }
}

/**
 * PASS only when a change in physical coordinates propagates all the way to
 * a different explanation. If tracking changed but the story did not, the
 * engine is narrating from something other than Reality — that is a FAIL.
 */
export function runRealityTest(
  baseline: PossessionAnalysis,
  variant: PossessionAnalysis,
): RealityTestResult {
  const delta = trackingDelta(baseline.states, variant.states)
  const trackingChanged = delta.maxDelta > 0.05

  const baseTypes = baseline.events.map((e) => e.type)
  const varTypes = new Set(variant.events.map((e) => e.type))
  const removed = baseTypes.filter((t) => !varTypes.has(t))
  const added = [...varTypes].filter((t) => !baseTypes.includes(t))
  const eventsChanged = eventSignature(baseline) !== eventSignature(variant)

  const graphChanged = graphSignature(baseline) !== graphSignature(variant)
  const explanationChanged = commentarySignature(baseline) !== commentarySignature(variant)

  const steps: RealityTestStep[] = [
    {
      id: "tracking",
      label: { zh: "追踪数据改变", en: "Tracking changed" },
      changed: trackingChanged,
      detail: trackingChanged
        ? `${delta.playerId} Δ ${delta.maxDelta.toFixed(2)} m`
        : "no coordinate delta",
    },
    {
      id: "events",
      label: { zh: "事件改变", en: "Events changed" },
      changed: eventsChanged,
      detail: eventsChanged
        ? `${baseline.events.length} → ${variant.events.length}${
            removed.length ? ` · -${removed.join(", -")}` : ""
          }${added.length ? ` · +${added.join(", +")}` : ""}`
        : "identical events",
    },
    {
      id: "graph",
      label: { zh: "图谱改变", en: "Graph changed" },
      changed: graphChanged,
      detail: graphChanged
        ? `${baseline.graph.edges.length} → ${variant.graph.edges.length} edges`
        : "identical edges",
    },
    {
      id: "explanation",
      label: { zh: "解说改变", en: "Explanation changed" },
      changed: explanationChanged,
      detail: explanationChanged ? "all 3 audiences re-derived" : "identical commentary",
    },
  ]

  return { pass: steps.every((s) => s.changed), steps }
}
