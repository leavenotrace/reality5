import trackingOriginal from "@/data/mock-tracking.json"
import trackingNoHelp from "@/data/mock-tracking-no-help.json"
import { analyzePossession } from "@/lib/reality/analyze"
import { resolveDetectorConfig } from "@/lib/reality/config"
import { runRealityTest, type RealityTestResult } from "@/lib/reality/reality-test"
import type { CourtState, RosterEntry, TrackingDataset } from "@/lib/reality/types"
import { presentEvents } from "./presentation"
import type { Possession } from "./types"

/**
 * Data access boundary for Reality5.
 *
 * V0.2 loads MOCK TRACKING (physical state only) and runs the Reality Engine
 * on the server. Swapping the dataset for NBA / AWS tracking means replacing
 * `loadTracking()` — nothing downstream changes.
 */
export type ScenarioId = "original" | "reality-test-no-help"

export interface Scenario {
  id: ScenarioId
  label: { zh: string; en: string }
  description: string
  possession: Possession
}

export interface RealityWorkspaceData {
  scenarios: Scenario[]
  /** Comparison of the test scenario against the original reality. */
  realityTest: RealityTestResult
}

const SCENARIO_META: Record<ScenarioId, { label: { zh: string; en: string } }> = {
  original: { label: { zh: "原始现实", en: "ORIGINAL REALITY" } },
  "reality-test-no-help": { label: { zh: "无协防现实", en: "NO HELP REALITY" } },
}

async function loadTracking(id: ScenarioId): Promise<TrackingDataset> {
  const raw = id === "original" ? trackingOriginal : trackingNoHelp
  return raw as unknown as TrackingDataset
}

export function buildPossession(
  dataset: TrackingDataset,
  env: Record<string, string | undefined> = {},
): Possession {
  const config = resolveDetectorConfig(env)
  const roster = dataset.roster as RosterEntry[]
  const analysis = analyzePossession(dataset.states as CourtState[], { config, roster })
  const clockAtStart = dataset.meta.clockAtStart

  return {
    id: `demo-q2-0738-${dataset.meta.scenario ?? "original"}`,
    game: {
      home: "LAC",
      away: "DEN",
      label: `${analysis.engine.name} ${analysis.engine.version}`,
      quarter: "Q2",
    },
    video: {
      src: null,
      poster: "/video/court-poster.png",
      clipStart: 458,
      duration: dataset.meta.duration,
      clockAtStart,
    },
    players: roster,
    dataSource: {
      source: dataset.meta.source,
      engine: `${analysis.engine.name} ${analysis.engine.version}`,
      sampleRateHz: Math.round(1 / dataset.meta.sampleRate),
      frames: dataset.states.length,
    },
    analysis,
    events: presentEvents(analysis, roster, clockAtStart),
    evidence: analysis.evidence,
    playGraph: analysis.graph,
    commentary: analysis.commentary,
  }
}

/**
 * Weak-side defender displacement — the only physical difference between the
 * scenarios. Uses the HELP_DEFENSE measurement when the engine produced one,
 * otherwise the raw displacement from the defender's starting spot before
 * the ball leaves the handler.
 */
function defenderShift(dataset: TrackingDataset, possession: Possession, id: string) {
  const help = possession.analysis.events.find((e) => e.type === "HELP_DEFENSE" && e.actor === id)
  if (typeof help?.evidence.defender_shift === "number") return help.evidence.defender_shift

  const pass = possession.analysis.events.find((e) => e.type === "PASS")
  const until = pass?.timestamp ?? dataset.meta.duration
  const origin = dataset.states[0].players.find((p) => p.id === id)
  if (!origin) return 0
  return Math.max(
    ...dataset.states
      .filter((s) => s.timestamp <= until)
      .map((s) => {
        const p = s.players.find((q) => q.id === id)
        return p ? Math.hypot(p.x - origin.x, p.y - origin.y) : 0
      }),
  )
}

export async function getWorkspaceData(): Promise<RealityWorkspaceData> {
  const env = { OPEN_SPACE_THRESHOLD: process.env.OPEN_SPACE_THRESHOLD }
  const ids: ScenarioId[] = ["original", "reality-test-no-help"]
  const datasets = await Promise.all(ids.map(loadTracking))

  const scenarios = ids.map((id, i) => {
    const possession = buildPossession(datasets[i], env)
    return {
      id,
      label: SCENARIO_META[id].label,
      description: `Defender shift ≈ ${defenderShift(datasets[i], possession, "D4").toFixed(1)}m`,
      possession,
    }
  })

  return {
    scenarios,
    realityTest: runRealityTest(scenarios[0].possession.analysis, scenarios[1].possession.analysis),
  }
}
