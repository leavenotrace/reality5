import {
  dist,
  distanceToBasket as toBasket,
  isBeyondArc,
  isInCorner,
  nearestDefenderDistance,
  playerById,
} from "@/lib/reality/court-state"
import type { BasketballEvent, CourtState, DetectorConfig } from "@/lib/reality/types"

interface Transition {
  from: string
  to?: string
  releaseIndex: number
  arriveIndex: number
}

/** Ball possession transitions: holder → in transit → (new holder | nobody). */
function possessionTransitions(states: CourtState[]): Transition[] {
  const transitions: Transition[] = []
  let holder: string | undefined
  let releaseIndex = -1

  states.forEach((state, i) => {
    const current = state.ball.possessor
    if (holder && !current) {
      releaseIndex = i
      transitions.push({ from: holder, releaseIndex, arriveIndex: -1 })
    } else if (!holder && current && transitions.length) {
      const last = transitions[transitions.length - 1]
      if (last.arriveIndex === -1) {
        last.to = current
        last.arriveIndex = i
      }
    }
    holder = current
  })
  return transitions
}

/**
 * PASS: possession moves from one offensive player, through the air, to a
 * teammate. Evidence measures the pass and how open the receiver was at
 * the catch.
 */
export function detectPass(
  states: CourtState[],
  config: DetectorConfig,
  openEvents: BasketballEvent[],
): BasketballEvent[] {
  const events: BasketballEvent[] = []
  for (const tr of possessionTransitions(states)) {
    if (!tr.to || tr.to === tr.from) continue
    const release = states[tr.releaseIndex]
    const arrive = states[tr.arriveIndex]
    const passer = playerById(release, tr.from)
    const receiver = playerById(arrive, tr.to)
    if (!passer || !receiver || passer.team !== receiver.team) continue

    const flight = arrive.timestamp - release.timestamp
    const passDistance = dist(passer, receiver)
    const receiverOpen = nearestDefenderDistance(arrive, tr.to)
    const open = openEvents.find(
      (e) => e.actor === tr.to && e.timestamp <= arrive.timestamp && (e.evidence.closed_at === undefined || Number(e.evidence.closed_at) >= arrive.timestamp),
    )

    events.push({
      id: `pass_${events.length + 1}`,
      type: "PASS",
      timestamp: release.timestamp,
      endTimestamp: arrive.timestamp,
      actor: tr.from,
      target: tr.to,
      evidence: {
        from: tr.from,
        to: tr.to,
        pass_distance: round(passDistance),
        flight_time: round(flight),
        ball_speed: flight > 0 ? round(passDistance / flight, 1) : 0,
        receiver_nearest_defender_distance: receiverOpen ? round(receiverOpen.distance) : 0,
        receiver_open_at_catch: receiverOpen && receiverOpen.distance >= config.openSpaceThreshold ? "yes" : "no",
        creation_lead: open ? round(arrive.timestamp - open.timestamp) : 0,
      },
      confidence: 0.95,
    })
  }
  return events
}

/**
 * OPEN_THREE: a player releases the ball from beyond the arc and the ball
 * rises and travels toward the basket without a new possessor.
 */
export function detectShot(states: CourtState[], config: DetectorConfig): BasketballEvent[] {
  const events: BasketballEvent[] = []
  const side = config.attackingBasket
  const distanceToBasket = (p: { x: number; y: number }) => toBasket(p, side)
  for (const tr of possessionTransitions(states)) {
    if (tr.to) continue
    const release = states[tr.releaseIndex]
    const shooter = playerById(release, tr.from)
    if (!shooter) continue

    const later = states[Math.min(states.length - 1, tr.releaseIndex + 3)]
    const rising = (later.ball.z ?? 0) > (release.ball.z ?? 0) + 0.3
    const towardBasket = distanceToBasket(later.ball) < distanceToBasket(release.ball) - 0.5
    if (!rising || !towardBasket) continue
    if (!isBeyondArc(shooter, side)) continue

    const contest = nearestDefenderDistance(release, tr.from)
    const contestDistance = contest ? contest.distance : Infinity
    const catchIndex = findCatchIndex(states, tr.releaseIndex, tr.from)
    const catchToRelease = release.timestamp - states[catchIndex].timestamp

    events.push({
      id: `three_${events.length + 1}`,
      type: "OPEN_THREE",
      timestamp: release.timestamp,
      actor: tr.from,
      target: contest?.id,
      evidence: {
        shooter: tr.from,
        shot_distance: round(distanceToBasket(shooter)),
        zone: isInCorner(shooter, side) ? "corner" : "above_break",
        contest_distance: round(contestDistance),
        contest_threshold: config.contestDistance,
        contested: contestDistance < config.contestDistance ? "yes" : "no",
        catch_to_release: round(catchToRelease),
        release_height: round(release.ball.z ?? 0),
      },
      confidence: clamp(0.6 + 0.15 * (contestDistance / config.contestDistance - 1)),
    })
  }
  return events
}

function findCatchIndex(states: CourtState[], releaseIndex: number, shooter: string) {
  let i = releaseIndex - 1
  while (i > 0 && states[i - 1].ball.possessor === shooter) i--
  return Math.max(0, i)
}

function round(v: number, p = 2) {
  const f = 10 ** p
  return Math.round(v * f) / f
}

function clamp(v: number) {
  return Math.min(0.99, Math.max(0.2, round(v)))
}
