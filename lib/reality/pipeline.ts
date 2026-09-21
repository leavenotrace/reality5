import type { NormalizedTracking } from "@/lib/adapters/types"
import { runDetectors } from "@/lib/detectors"
import { buildPlayGraph } from "@/lib/reasoning/play-graph"
import { ENGINE } from "./analyze"
import { buildCommentary, buildCommentaryContext } from "./commentary"
import { DEFAULT_DETECTOR_CONFIG } from "./config"
import { deriveKinematics } from "./court-state"
import { promoteEvidence } from "./evidence"
import type { DetectorConfig, PossessionAnalysis } from "./types"

export type PipelineStageId =
  | "reading"
  | "normalizing"
  | "detecting"
  | "graph"
  | "evidence"
  | "explanation"

export interface PipelineStage {
  id: PipelineStageId
  label: string
}

export const PIPELINE_STAGES: PipelineStage[] = [
  { id: "reading", label: "READING REALITY" },
  { id: "normalizing", label: "NORMALIZING COURT STATE" },
  { id: "detecting", label: "DETECTING EVENTS" },
  { id: "graph", label: "BUILDING PLAY GRAPH" },
  { id: "evidence", label: "LINKING EVIDENCE" },
  { id: "explanation", label: "GENERATING EXPLANATION" },
]

export interface StageReport {
  id: PipelineStageId
  /** Real wall-clock time of the stage, ms. */
  ms: number
  detail: string
}

const nextFrame = () =>
  new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve())
    else setTimeout(resolve, 0)
  })

/**
 * The same functions `analyzePossession` calls, exposed one stage at a time so
 * the UI can show real progress. `onStage` fires after each stage completes;
 * a frame is yielded between stages so the browser can paint. No artificial
 * delays.
 */
export async function runPipeline(
  tracking: NormalizedTracking,
  options: { config?: Partial<DetectorConfig>; onStage?: (report: StageReport) => void } = {},
): Promise<PossessionAnalysis> {
  const config: DetectorConfig = { ...DEFAULT_DETECTOR_CONFIG, ...options.config }
  const report = async (id: PipelineStageId, started: number, detail: string) => {
    options.onStage?.({ id, ms: performance.now() - started, detail })
    await nextFrame()
  }

  let t = performance.now()
  await report(
    "reading",
    t,
    `${tracking.states.length} frames · ${tracking.roster.length} players · ${tracking.meta.adapter}`,
  )

  t = performance.now()
  const states = deriveKinematics(tracking.states)
  await report("normalizing", t, `velocity derived for ${states.length} frames`)

  t = performance.now()
  const events = runDetectors(states, config)
  await report(
    "detecting",
    t,
    events.length ? events.map((e) => e.type).join(", ") : "no events met thresholds",
  )

  t = performance.now()
  const graph = buildPlayGraph(events)
  await report("graph", t, `${graph.nodes.length} nodes · ${graph.edges.length} edges`)

  t = performance.now()
  const evidence = promoteEvidence(events)
  await report("evidence", t, `${evidence.length} measured values`)

  t = performance.now()
  const commentaryContext = buildCommentaryContext(events, config)
  const commentary = buildCommentary(events, commentaryContext, tracking.roster)
  await report("explanation", t, `${commentary.length} audiences`)

  return { states, events, graph, evidence, commentaryContext, commentary, config, engine: ENGINE }
}
