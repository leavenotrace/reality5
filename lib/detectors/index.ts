import type { BasketballEvent, CourtState, DetectorConfig } from "@/lib/reality/types"
import { dedupeEvents } from "./dedupe"
import { detectDrive } from "./drive"
import { detectHelpDefense } from "./help-defense"
import { detectOpenSpace } from "./open-space"
import { detectPass, detectShot } from "./pass-shot"

/** Run every detector over the tracking data and return events in time order. */
export function runDetectors(states: CourtState[], config: DetectorConfig): BasketballEvent[] {
  const drives = dedupeEvents(detectDrive(states, config), config)
  const help = dedupeEvents(detectHelpDefense(states, config, drives), config)
  const open = dedupeEvents(detectOpenSpace(states, config), config)
  const passes = detectPass(states, config, open)
  const shots = detectShot(states, config)

  return [...drives, ...help, ...open, ...passes, ...shots].sort(
    (a, b) => a.timestamp - b.timestamp || rank(a) - rank(b),
  )
}

const ORDER: Record<BasketballEvent["type"], number> = {
  DRIVE: 0,
  HELP_DEFENSE: 1,
  DEFENSIVE_COLLAPSE: 2,
  OPEN_SPACE: 3,
  PASS: 4,
  OPEN_THREE: 5,
}

function rank(e: BasketballEvent) {
  return ORDER[e.type]
}

export { detectDrive, detectHelpDefense, detectOpenSpace, detectPass, detectShot }
