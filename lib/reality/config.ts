import type { DetectorConfig } from "./types"

export const DEFAULT_DETECTOR_CONFIG: DetectorConfig = {
  openSpaceThreshold: 3.0,
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
  return {
    ...DEFAULT_DETECTOR_CONFIG,
    openSpaceThreshold: numberFromEnv(
      env.OPEN_SPACE_THRESHOLD,
      DEFAULT_DETECTOR_CONFIG.openSpaceThreshold,
    ),
  }
}
