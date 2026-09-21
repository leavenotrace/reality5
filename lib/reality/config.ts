import type { DetectorConfig } from "./types"

export const DEFAULT_DETECTOR_CONFIG: DetectorConfig = {
  attackingBasket: "right",
  openSpaceThreshold: 3.0,
  openSpaceExitThreshold: 2.7,
  eventMergeGap: 0.3,
  driveSpeedThreshold: 3.0,
  helpShiftThreshold: 1.2,
  collapseShiftThreshold: 0.6,
  collapseMinDefenders: 3,
  contestDistance: 1.5,
}

function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** Server-side: overrides from environment (e.g. OPEN_SPACE_THRESHOLD). */
export function resolveDetectorConfig(
  env: Record<string, string | undefined> = {},
): DetectorConfig {
  const openSpaceThreshold = numberFromEnv(
    env.OPEN_SPACE_THRESHOLD,
    DEFAULT_DETECTOR_CONFIG.openSpaceThreshold,
  )
  // Keep the hysteresis band proportional when the enter threshold is overridden.
  const band = DEFAULT_DETECTOR_CONFIG.openSpaceThreshold - DEFAULT_DETECTOR_CONFIG.openSpaceExitThreshold
  return {
    ...DEFAULT_DETECTOR_CONFIG,
    openSpaceThreshold,
    openSpaceExitThreshold: Math.max(0, openSpaceThreshold - band),
  }
}
