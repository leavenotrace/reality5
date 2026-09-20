import { demoPossession } from "./data/demo-possession"
import type { Possession } from "./types"

/**
 * Data access boundary for Reality5.
 *
 * V0.1 serves local mock data. Swap the body of these functions for a fetch
 * against the Reality Engine API without touching any UI component.
 */
export interface PossessionSummary {
  id: string
  label: string
  clock: string
}

export async function listPossessions(): Promise<PossessionSummary[]> {
  return [
    {
      id: demoPossession.id,
      label: `${demoPossession.game.away} @ ${demoPossession.game.home} · ${demoPossession.game.quarter}`,
      clock: demoPossession.video.clockAtStart,
    },
  ]
}

export async function getPossession(id: string): Promise<Possession | null> {
  if (id === demoPossession.id) return demoPossession
  return null
}

export async function getDefaultPossession(): Promise<Possession> {
  return demoPossession
}
