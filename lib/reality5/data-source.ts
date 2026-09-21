import sample01 from "@/data/sample-possession-01.json"
import sample02 from "@/data/sample-possession-02.json"
import { adaptTracking } from "@/lib/adapters"
import { analyzePossession } from "@/lib/reality/analyze"
import { resolveDetectorConfig } from "@/lib/reality/config"
import type { DetectorConfig } from "@/lib/reality/types"
import { buildPossession } from "./build-possession"
import type { Possession } from "./types"

/**
 * Server-side data access for Reality5.
 *
 * Sample possessions go through the SAME adapter as uploaded JSON: external
 * tracking → TrackingInputAdapter → CourtState[] → Reality Engine. Nothing
 * downstream knows which path produced the Possession.
 */
export interface SamplePossessionSource {
  id: string
  label: string
  description: string
  raw: unknown
}

export const SAMPLE_SOURCES: SamplePossessionSource[] = [
  {
    id: "sample-01",
    label: "Sample Possession 01",
    description: "P23 drives, weak-side defender helps, corner opens.",
    raw: sample01,
  },
  {
    id: "sample-02",
    label: "Sample Possession 02",
    description: "P23 drives, weak-side defender stays home, corner stays covered.",
    raw: sample02,
  },
]

export interface RealityWorkspaceData {
  possessions: Possession[]
  /** Resolved detector thresholds so client-side analysis uses the same rules. */
  config: DetectorConfig
  samples: { id: string; label: string; description: string }[]
}

export function getDetectorEnv() {
  return { OPEN_SPACE_THRESHOLD: process.env.OPEN_SPACE_THRESHOLD }
}

export async function getWorkspaceData(): Promise<RealityWorkspaceData> {
  const config = resolveDetectorConfig(getDetectorEnv())

  const possessions = SAMPLE_SOURCES.map((sample) => {
    const adapted = adaptTracking(sample.raw)
    if (!adapted.ok) {
      throw new Error(
        `Sample ${sample.id} failed the input adapter: ${adapted.errors.map((e) => e.message.en).join("; ")}`,
      )
    }
    const analysis = analyzePossession(adapted.tracking.states, {
      config,
      roster: adapted.tracking.roster,
    })
    return buildPossession(adapted.tracking, analysis, {
      id: sample.id,
      label: sample.label,
      source: "SAMPLE TRACKING",
    })
  })

  return {
    possessions,
    config,
    samples: SAMPLE_SOURCES.map(({ id, label, description }) => ({ id, label, description })),
  }
}
