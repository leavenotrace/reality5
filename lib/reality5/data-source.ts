import tracking from "@/data/mock-tracking.json"
import { analyzePossession } from "@/lib/reality/analyze"
import { resolveDetectorConfig } from "@/lib/reality/config"
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
async function loadTracking(): Promise<TrackingDataset> {
  return tracking as unknown as TrackingDataset
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
    id: "demo-q2-0738",
    game: { home: "LAC", away: "DEN", label: "DEMO GAME", quarter: "Q2" },
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

export async function getDefaultPossession(): Promise<Possession> {
  const dataset = await loadTracking()
  return buildPossession(dataset, { OPEN_SPACE_THRESHOLD: process.env.OPEN_SPACE_THRESHOLD })
}
