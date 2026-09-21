import {
  dist,
  frameIndexAt,
  nearestDefenderDistance,
  playerById,
  stateAt,
} from "./court-state"
import type {
  BasketballEvent,
  CourtState,
  DetectorConfig,
  EventType,
  Localized,
  PlayGraph,
  PlayGraphNode,
} from "./types"

/**
 * CAUSAL REALITY ENGINE (V0.4)
 *
 * Correlation is not causation. A happened before B does NOT mean A caused B.
 * Every candidate edge between two detected events runs an explicit set of
 * physical tests against the tracking states. Only when the mechanism is
 * measurable does the edge get a causal relation; otherwise it is recorded as
 * TEMPORAL_ONLY and never enters the causal chain or the explanation.
 *
 * Reality first. Evidence second. Causality third. Language last.
 */

export type CausalRelation =
  | "TRIGGERED"
  | "CREATED"
  | "ENABLED"
  | "CONSTRAINED"
  | "PRECEDED"
  | "TEMPORAL_ONLY"

export type CausalStatus = "SUPPORTED" | "WEAK" | "TEMPORAL_ONLY"

export type ClaimType = "OBSERVATION" | "INFERENCE" | "CAUSAL_CLAIM"

export interface CausalEvidence {
  metric: string
  label: Localized
  before?: number
  after?: number
  delta?: number
  value?: number
  unit?: string
  timestamp?: number
  frameRange?: [number, number]
  rule?: string
  /** Player(s) the measurement is about, for the reality jump. */
  players?: string[]
}

export interface CausalTest {
  id: string
  label: Localized
  result: "PASS" | "FAIL" | "N/A"
  detail: string
}

/** Interpretable component of the combined confidence. */
export interface CausalFactor {
  id: string
  label: Localized
  score: number
  detail: string
}

export interface Counterfactual {
  premise: Localized
  observed: { label: Localized; value: number; unit: string }[]
  estimated: { label: Localized; value: number; unit: string }[]
  threshold: number
  thresholdReached: boolean
  supports: boolean
  conclusion: Localized
}

/** What JUMP TO REALITY should show on the court. */
export interface CausalJump {
  time: number
  players: string[]
  /** Hollow marker at `from`, filled marker at `to`, movement vector between. */
  movements: { playerId: string; from: number; to: number; label: string }[]
  /** Dashed distance measurement between two players at a fixed time. */
  measures: { from: string; to: string; t: number; label: string }[]
}

export interface CausalClaims {
  observation: Localized[]
  inference: Localized
  causalClaim: Localized
}

export interface CausalEdge {
  id: string
  fromEventId: string
  toEventId: string
  fromType: EventType
  toType: EventType
  /** Relation the rule would assign if supported. */
  candidateRelation: Exclude<CausalRelation, "TEMPORAL_ONLY">
  /** Relation actually assigned after the tests. */
  relation: CausalRelation
  confidence: number
  status: CausalStatus
  evidence: CausalEvidence[]
  tests: CausalTest[]
  factors: CausalFactor[]
  counterfactual?: Counterfactual
  alternativeExplanation?: Localized
  claims: CausalClaims
  jump: CausalJump
  /** Pairs that only share a timeline get no rule; they are listed for debug. */
  ruleless?: boolean
}

export interface CausalGraph {
  nodes: PlayGraphNode[]
  /** Every candidate that was evaluated, including TEMPORAL_ONLY rejections. */
  edges: CausalEdge[]
}

export interface CausalChainStep {
  edge: CausalEdge
}

export interface CausalTrace {
  /** Event the question is about (the last detected event, normally the shot). */
  rootEventId: string | null
  /** Edges walked backwards from the root, in chronological order (cause → effect). */
  chain: CausalEdge[]
  /** Why the walk stopped. */
  stoppedAt: { eventId: string; reason: "NO_INCOMING" | "TEMPORAL_ONLY" | "WEAK" } | null
}

// ---------------------------------------------------------------------------

type Ctx = {
  states: CourtState[]
  config: DetectorConfig
}

const num = (v: unknown, fallback = 0) => (typeof v === "number" ? v : Number(v ?? fallback) || fallback)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const round = (v: number, p = 2) => Math.round(v * 10 ** p) / 10 ** p
const L = (zh: string, en: string): Localized => ({ zh, en })

function frames(ctx: Ctx, from: number, to = from): [number, number] {
  return [frameIndexAt(ctx.states, from), frameIndexAt(ctx.states, to)]
}

function pass(id: string, label: Localized, detail: string): CausalTest {
  return { id, label, result: "PASS", detail }
}
function fail(id: string, label: Localized, detail: string): CausalTest {
  return { id, label, result: "FAIL", detail }
}

/** Temporal factor: 1.0 for an immediate follow-up, decays to 0 at `horizon` seconds. */
function temporalScore(lag: number, horizon: number) {
  if (lag < -0.05) return 0
  return clamp01(1 - Math.max(0, lag) / horizon)
}

function combine(factors: CausalFactor[]) {
  if (factors.length === 0) return 0
  return round(factors.reduce((s, f) => s + f.score, 0) / factors.length)
}

interface RuleResult {
  candidateRelation: Exclude<CausalRelation, "TEMPORAL_ONLY">
  evidence: CausalEvidence[]
  tests: CausalTest[]
  factors: CausalFactor[]
  counterfactual?: Counterfactual
  alternativeExplanation?: Localized
  claims: CausalClaims
  jump: CausalJump
  /** Tests that must all PASS for SUPPORTED. */
  required: string[]
  /** Tests of which at least one must PASS (with all required) for SUPPORTED. */
  partial: string[]
  /**
   * The test that proves a PHYSICAL mechanism. If it fails the pair is
   * TEMPORAL_ONLY no matter how good the timing looks.
   */
  mechanism: string
}

interface CausalRule {
  from: EventType
  to: EventType
  /** Max seconds between onsets for the pair to be considered at all. */
  window: number
  evaluate: (a: BasketballEvent, b: BasketballEvent, ctx: Ctx) => RuleResult | null
}

// ---------------------------------------------------------------------------
// DRIVE → HELP_DEFENSE  (TRIGGERED)
// ---------------------------------------------------------------------------

function driveTriggeredHelp(drive: BasketballEvent, help: BasketballEvent, ctx: Ctx): RuleResult | null {
  const handler = drive.actor
  const defender = help.actor
  if (!handler || !defender) return null

  const reaction = round(help.timestamp - drive.timestamp)
  const driveEnd = drive.endTimestamp ?? drive.timestamp
  const basketDelta = num(drive.evidence.distance_to_basket_change)
  const toHandlerBefore = num(help.evidence.distance_to_ball_handler_before)
  const toHandlerAfter = num(help.evidence.distance_to_ball_handler_after)
  const toHandlerDelta = round(toHandlerAfter - toHandlerBefore)
  const basketShift = num(help.evidence.distance_to_basket_change)
  const assignBefore = num(help.evidence.assignment_distance_before)
  const assignAfter = num(help.evidence.assignment_distance_after)
  const assignDelta = round(assignAfter - assignBefore)
  const shift = num(help.evidence.peak_shift, num(help.evidence.defender_shift))
  const helpEnd = help.endTimestamp ?? help.timestamp

  const tests: CausalTest[] = []
  const inWindow = reaction >= 0 && help.timestamp <= driveEnd + 0.6
  tests.push(
    (inWindow ? pass : fail)(
      "temporal",
      L("时间窗口", "Temporal"),
      `help onset +${reaction.toFixed(1)}s after drive onset (drive ends +${(driveEnd - drive.timestamp).toFixed(1)}s)`,
    ),
  )
  tests.push(
    (basketDelta < -0.5 ? pass : fail)(
      "handler_approach",
      L("持球人逼近篮筐", "Handler toward basket"),
      `basket distance ${basketDelta.toFixed(1)} m`,
    ),
  )
  const towardStimulus = toHandlerDelta < -0.3 || basketShift < -0.3
  tests.push(
    (towardStimulus ? pass : fail)(
      "defender_toward",
      L("防守者向球/禁区移动", "Defender toward ball / paint"),
      `to handler ${toHandlerDelta.toFixed(1)} m · to basket ${basketShift.toFixed(1)} m`,
    ),
  )
  tests.push(
    (assignDelta > 0.3 ? pass : fail)(
      "assignment_separation",
      L("离开原防守对象", "Leaves assignment"),
      `assignment distance ${assignBefore.toFixed(1)} → ${assignAfter.toFixed(1)} m`,
    ),
  )

  const factors: CausalFactor[] = [
    { id: "temporal", label: L("反应时间", "Reaction time"), score: temporalScore(reaction, 2.0), detail: `+${reaction.toFixed(1)}s` },
    { id: "stimulus", label: L("突破强度", "Drive stimulus"), score: clamp01(Math.abs(basketDelta) / 4), detail: `${basketDelta.toFixed(1)} m` },
    { id: "response", label: L("防守响应位移", "Defender response"), score: clamp01(shift / (ctx.config.helpShiftThreshold * 1.5)), detail: `${shift.toFixed(1)} m` },
    { id: "assignment", label: L("离开原位", "Assignment separation"), score: clamp01(assignDelta / 2), detail: `+${assignDelta.toFixed(1)} m` },
  ]

  const evidence: CausalEvidence[] = [
    { metric: "drive_speed", label: L("突破速度", "Drive speed"), value: num(drive.evidence.speed), unit: "m/s", timestamp: drive.timestamp, frameRange: frames(ctx, drive.timestamp, driveEnd), players: [handler] },
    { metric: "basket_distance_change", label: L("持球人篮下距离变化", "Handler basket distance"), before: num(drive.evidence.distance_to_basket_start), after: num(drive.evidence.distance_to_basket_end), delta: basketDelta, unit: "m", frameRange: frames(ctx, drive.timestamp, driveEnd), players: [handler] },
    { metric: "defender_shift", label: L("防守者位移", "Defender shift"), value: shift, unit: "m", timestamp: help.timestamp, frameRange: frames(ctx, help.timestamp, helpEnd), players: [defender], rule: `shift >= ${ctx.config.helpShiftThreshold.toFixed(1)} m` },
    { metric: "distance_to_handler", label: L("与持球人距离", "Distance to handler"), before: toHandlerBefore, after: toHandlerAfter, delta: toHandlerDelta, unit: "m", frameRange: frames(ctx, help.timestamp, helpEnd), players: [defender, handler] },
    { metric: "assignment_distance", label: L("与原防守对象距离", "Assignment distance"), before: assignBefore, after: assignAfter, delta: assignDelta, unit: "m", frameRange: frames(ctx, help.timestamp, helpEnd), players: [defender, help.target ?? ""].filter(Boolean) },
    { metric: "reaction_time", label: L("反应时间", "Reaction time"), value: reaction, unit: "s", timestamp: help.timestamp },
  ]

  return {
    candidateRelation: "TRIGGERED",
    evidence,
    tests,
    factors,
    required: ["temporal", "handler_approach", "defender_toward"],
    partial: ["assignment_separation"],
    mechanism: "defender_toward",
    alternativeExplanation: L(
      `${defender} 可能按预设轮转协防，而非对本次突破做出反应；但反应时间 +${reaction.toFixed(1)}s 与移动方向支持“对突破做出响应”。`,
      `${defender} may have rotated on a pre-set scheme rather than in reaction to this drive; the +${reaction.toFixed(1)}s reaction time and direction favor a response to the drive.`,
    ),
    claims: {
      observation: [
        L(`${handler} 以 ${num(drive.evidence.speed).toFixed(1)} m/s 向篮筐推进，篮下距离变化 ${basketDelta.toFixed(1)} m。`, `${handler} moved toward the basket at ${num(drive.evidence.speed).toFixed(1)} m/s; basket distance ${basketDelta.toFixed(1)} m.`),
        L(`${defender} 在 +${reaction.toFixed(1)}s 后位移 ${shift.toFixed(1)} m，与原防守对象距离 ${assignBefore.toFixed(1)} → ${assignAfter.toFixed(1)} m。`, `${defender} shifted ${shift.toFixed(1)} m after +${reaction.toFixed(1)}s; assignment distance ${assignBefore.toFixed(1)} → ${assignAfter.toFixed(1)} m.`),
      ],
      inference: L(`${defender} 进入了协防位置。`, `${defender} entered a help position.`),
      causalClaim: L(`${handler} 的突破触发了 ${defender} 的协防。`, `${handler}'s drive triggered ${defender}'s help.`),
    },
    jump: {
      time: helpEnd,
      players: [handler, defender],
      movements: [
        { playerId: handler, from: drive.timestamp, to: driveEnd, label: `${basketDelta.toFixed(1)} m` },
        { playerId: defender, from: help.timestamp, to: helpEnd, label: `${shift.toFixed(1)} m` },
      ],
      measures: [{ from: defender, to: handler, t: helpEnd, label: `${toHandlerAfter.toFixed(1)} m` }],
    },
  }
}

// ---------------------------------------------------------------------------
// HELP_DEFENSE → OPEN_SPACE  (CREATED) — the most important relation
// ---------------------------------------------------------------------------

function helpCreatedOpen(help: BasketballEvent, open: BasketballEvent, ctx: Ctx): RuleResult | null {
  const defender = help.actor
  const receiver = open.actor
  if (!defender || !receiver) return null
  const { states, config } = ctx
  const threshold = config.openSpaceThreshold

  const helpEnd = help.endTimestamp ?? help.timestamp
  const peakT = open.peakTimestamp ?? open.timestamp
  const beforeState = stateAt(states, help.timestamp)
  const afterState = stateAt(states, Math.max(peakT, help.timestamp))

  const nearestBefore = nearestDefenderDistance(beforeState, receiver)
  const nearestAfter = nearestDefenderDistance(afterState, receiver)
  if (!nearestBefore || !nearestAfter) return null
  const before = round(nearestBefore.distance)
  const after = round(nearestAfter.distance)
  const delta = round(after - before)

  const defBefore = playerById(beforeState, defender)
  const defAfter = playerById(afterState, defender)
  const recBefore = playerById(beforeState, receiver)
  const recAfter = playerById(afterState, receiver)
  if (!defBefore || !defAfter || !recBefore || !recAfter) return null
  const shift = round(dist(defBefore, defAfter))
  const lag = round(open.timestamp - help.timestamp)

  // Assignment link: the helper was guarding the receiver, or was the
  // receiver's nearest defender when help began.
  const linked = help.target === receiver || nearestBefore.id === defender

  // Counterfactual: freeze the helper at its pre-help spot and re-measure the
  // receiver's nearest defender at the open-space peak.
  const frozenDistance = dist(recAfter, defBefore)
  const othersAtPeak = afterState.players
    .filter((p) => p.team === "defense" && p.id !== defender)
    .map((p) => dist(p, recAfter))
  const estimated = round(Math.min(frozenDistance, ...(othersAtPeak.length ? othersAtPeak : [Infinity])))
  const cfReached = estimated >= threshold
  const counterfactual: Counterfactual = {
    premise: L(`若 ${defender} 停留在协防前的位置`, `If ${defender} had remained at its pre-help position`),
    observed: [
      { label: L(`${defender} 协防位移`, `${defender} help shift`), value: shift, unit: "m" },
      { label: L(`${receiver} 最近防守者距离`, `${receiver} nearest defender`), value: after, unit: "m" },
    ],
    estimated: [{ label: L(`${receiver} 估计防守者距离`, `${receiver} estimated defender distance`), value: estimated, unit: "m" }],
    threshold,
    thresholdReached: cfReached,
    supports: !cfReached,
    conclusion: cfReached
      ? L(`即使没有协防，${receiver} 仍会越过 ${threshold.toFixed(1)} m 空位阈值。`, `Without help, ${receiver} would still cross the ${threshold.toFixed(1)} m threshold.`)
      : L(`没有协防，${receiver} 不会越过 ${threshold.toFixed(1)} m 空位阈值。`, `Without help, OPEN_SPACE threshold would NOT be reached.`),
  }

  // Alternative: did the receiver create part of the gap by moving away?
  const receiverMove = round(dist(recBefore, recAfter))
  const alternative =
    receiverMove >= 0.5
      ? L(`${receiver} 自身移动了 ${receiverMove.toFixed(1)} m，保持底角间距，是一个次要贡献因素。`, `${receiver} moved ${receiverMove.toFixed(1)} m and maintained spacing — a contributing factor.`)
      : L(`${receiver} 几乎未移动（${receiverMove.toFixed(1)} m），空位主要由防守者离开造成。`, `${receiver} barely moved (${receiverMove.toFixed(1)} m); the gap came from the defender leaving.`)

  const tests: CausalTest[] = [
    (lag >= -0.05 && lag <= 1.5 ? pass : fail)("temporal", L("时间对齐", "Temporal"), `open space begins ${lag >= 0 ? "+" : ""}${lag.toFixed(1)}s after help begins`),
    (shift >= config.helpShiftThreshold ? pass : fail)("spatial", L("空间位移", "Spatial"), `${defender} displaced ${shift.toFixed(1)} m (>= ${config.helpShiftThreshold.toFixed(1)} m)`),
    (linked ? pass : fail)("assignment", L("防守关系", "Assignment link"), linked ? `${defender} was guarding ${receiver} at help onset` : `${defender} was not ${receiver}'s defender`),
    (delta >= 0.5 ? pass : fail)("distance_change", L("防守距离变化", "Defender distance change"), `${before.toFixed(1)} → ${after.toFixed(1)} m (Δ ${delta >= 0 ? "+" : ""}${delta.toFixed(1)})`),
    (after >= threshold ? pass : fail)("threshold", L("阈值穿越", "Threshold crossing"), `${after.toFixed(1)} m ${after >= threshold ? ">=" : "<"} ${threshold.toFixed(1)} m`),
    (!cfReached ? pass : fail)("counterfactual", L("反事实检验", "Counterfactual"), `without help: est. ${estimated.toFixed(1)} m → threshold ${cfReached ? "still reached" : "NOT reached"}`),
  ]

  const factors: CausalFactor[] = [
    { id: "temporal", label: L("时间接近度", "Temporal proximity"), score: temporalScore(lag, 2.0), detail: `+${lag.toFixed(1)}s` },
    { id: "spatial", label: L("空间位移", "Spatial displacement"), score: clamp01(shift / (config.helpShiftThreshold * 1.6)), detail: `${shift.toFixed(1)} m` },
    { id: "assignment", label: L("防守关系分离", "Assignment separation"), score: linked ? clamp01(delta / 2.0) : 0, detail: `Δ ${delta >= 0 ? "+" : ""}${delta.toFixed(1)} m` },
    { id: "threshold", label: L("阈值穿越", "Threshold crossing"), score: after >= threshold ? 1 : clamp01(after / threshold), detail: `${after.toFixed(1)} / ${threshold.toFixed(1)} m` },
    { id: "counterfactual", label: L("反事实支持", "Counterfactual support"), score: cfReached ? 0.2 : clamp01((threshold - estimated) / threshold + 0.5), detail: `est. ${estimated.toFixed(1)} m` },
  ]

  const evidence: CausalEvidence[] = [
    { metric: "help_shift", label: L(`${defender} 向禁区位移`, `${defender} shift toward paint`), value: shift, unit: "m", frameRange: frames(ctx, help.timestamp, helpEnd), players: [defender], rule: `shift >= ${config.helpShiftThreshold.toFixed(1)} m` },
    { metric: "receiver_defender_distance", label: L(`${receiver} 最近防守者距离`, `${receiver} nearest defender`), before, after, delta, unit: "m", frameRange: frames(ctx, help.timestamp, peakT), players: [receiver, defender], rule: `defenderDistance >= ${threshold.toFixed(1)} m` },
    { metric: "timing", label: L("时间对齐", "Timing"), value: lag, unit: "s", timestamp: open.timestamp, frameRange: frames(ctx, help.timestamp, open.timestamp) },
    { metric: "receiver_movement", label: L(`${receiver} 自身移动`, `${receiver} own movement`), value: receiverMove, unit: "m", frameRange: frames(ctx, help.timestamp, peakT), players: [receiver] },
  ]

  return {
    candidateRelation: "CREATED",
    evidence,
    tests,
    factors,
    counterfactual,
    alternativeExplanation: alternative,
    required: ["temporal", "spatial", "assignment", "distance_change", "threshold"],
    partial: ["counterfactual"],
    mechanism: "distance_change",
    claims: {
      observation: [
        L(`${defender} 向禁区移动 ${shift.toFixed(1)} m。`, `${defender} moved ${shift.toFixed(1)} m toward the paint.`),
        L(`${receiver} 最近防守者距离 ${before.toFixed(1)} → ${after.toFixed(1)} m（+${delta.toFixed(1)} m）。`, `${receiver} nearest defender ${before.toFixed(1)} → ${after.toFixed(1)} m (+${delta.toFixed(1)} m).`),
      ],
      inference: L(`${defender} 进入协防位置，离开了 ${receiver}。`, `${defender} entered help position, leaving ${receiver}.`),
      causalClaim: L(`${defender} 的协防创造了 ${receiver} 的空位。`, `${defender}'s help created ${receiver}'s open space.`),
    },
    jump: {
      time: peakT,
      players: [defender, receiver],
      movements: [{ playerId: defender, from: help.timestamp, to: peakT, label: `${shift.toFixed(1)} m` }],
      measures: [
        { from: receiver, to: nearestBefore.id, t: help.timestamp, label: `${before.toFixed(1)} m` },
        { from: receiver, to: nearestAfter.id, t: peakT, label: `${after.toFixed(1)} m` },
      ],
    },
  }
}

// ---------------------------------------------------------------------------
// DRIVE → OPEN_SPACE — candidate that must NOT become causal without a
// direct mechanism (the driver himself getting open).
// ---------------------------------------------------------------------------

function driveOpen(drive: BasketballEvent, open: BasketballEvent, ctx: Ctx): RuleResult | null {
  if (!drive.actor || !open.actor) return null
  const lag = round(open.timestamp - drive.timestamp)
  const direct = drive.actor === open.actor
  const tests: CausalTest[] = [
    (lag >= 0 ? pass : fail)("temporal", L("时间顺序", "Temporal"), `open space +${lag.toFixed(1)}s after drive`),
    (direct ? pass : fail)("direct_mechanism", L("直接空间机制", "Direct spatial mechanism"), direct ? `${drive.actor} is the player who became open` : `${drive.actor} never touched ${open.actor}'s defender — mechanism must run through a defender`),
  ]
  return {
    candidateRelation: "CREATED",
    evidence: [{ metric: "lag", label: L("时间间隔", "Lag"), value: lag, unit: "s", timestamp: open.timestamp }],
    tests,
    factors: [{ id: "temporal", label: L("时间接近度", "Temporal proximity"), score: temporalScore(lag, 2.0), detail: `+${lag.toFixed(1)}s` }],
    required: ["temporal", "direct_mechanism"],
    partial: [],
    mechanism: "direct_mechanism",
    claims: {
      observation: [L(`${open.actor} 在突破开始后 ${lag.toFixed(1)}s 进入空位。`, `${open.actor} became open ${lag.toFixed(1)}s after the drive began.`)],
      inference: L("仅有时间先后，没有直接的物理机制。", "Only temporal order; no direct physical mechanism."),
      causalClaim: L("不成立：时间先后不构成因果。", "Not asserted: temporal order alone is not causation."),
    },
    jump: { time: open.timestamp, players: [drive.actor, open.actor], movements: [], measures: [] },
  }
}

// ---------------------------------------------------------------------------
// HELP_DEFENSE → PASS  (CONSTRAINED) — the helper closes on the handler,
// the handler gives the ball up.
// ---------------------------------------------------------------------------

function helpConstrainedPass(help: BasketballEvent, passEv: BasketballEvent, ctx: Ctx): RuleResult | null {
  const defender = help.actor
  const handler = passEv.actor
  if (!defender || !handler) return null
  const toHandlerBefore = num(help.evidence.distance_to_ball_handler_before)
  const toHandlerAfter = num(help.evidence.distance_to_ball_handler_after)
  const closing = round(toHandlerBefore - toHandlerAfter)
  const lag = round(passEv.timestamp - help.timestamp)
  const helpEnd = help.endTimestamp ?? help.timestamp
  const releaseState = stateAt(ctx.states, passEv.timestamp)
  const d = playerById(releaseState, defender)
  const h = playerById(releaseState, handler)
  const atRelease = d && h ? round(dist(d, h)) : NaN

  const tests: CausalTest[] = [
    (lag >= 0 && lag <= 2.5 ? pass : fail)("temporal", L("时间窗口", "Temporal"), `pass released +${lag.toFixed(1)}s after help onset`),
    (closing >= 0.5 ? pass : fail)("closing", L("协防者逼近持球人", "Helper closes on handler"), `${toHandlerBefore.toFixed(1)} → ${toHandlerAfter.toFixed(1)} m`),
    (Number.isFinite(atRelease) && atRelease <= 3.0 ? pass : fail)("pressure", L("出球时的压迫", "Pressure at release"), `${defender} ${Number.isFinite(atRelease) ? atRelease.toFixed(1) : "—"} m from ${handler} at release`),
  ]
  const factors: CausalFactor[] = [
    { id: "temporal", label: L("时间接近度", "Temporal proximity"), score: temporalScore(lag, 3.0), detail: `+${lag.toFixed(1)}s` },
    { id: "closing", label: L("逼近幅度", "Closing distance"), score: clamp01(closing / 2.5), detail: `${closing.toFixed(1)} m` },
    { id: "pressure", label: L("出球压迫", "Release pressure"), score: Number.isFinite(atRelease) ? clamp01(1 - atRelease / 4) : 0, detail: `${Number.isFinite(atRelease) ? atRelease.toFixed(1) : "—"} m` },
  ]
  return {
    candidateRelation: "CONSTRAINED",
    evidence: [
      { metric: "distance_to_handler", label: L("协防者与持球人距离", "Helper to handler"), before: toHandlerBefore, after: toHandlerAfter, delta: -closing, unit: "m", frameRange: frames(ctx, help.timestamp, helpEnd), players: [defender, handler] },
      { metric: "pressure_at_release", label: L("出球时距离", "Distance at release"), value: atRelease, unit: "m", timestamp: passEv.timestamp, players: [defender, handler] },
    ],
    tests,
    factors,
    required: ["temporal", "closing"],
    partial: ["pressure"],
    mechanism: "closing",
    alternativeExplanation: L(`${handler} 也可能是按计划出球，而非被迫；协防只压缩了他的选项。`, `${handler} may have passed by design rather than under duress; the help only narrowed his options.`),
    claims: {
      observation: [L(`${defender} 与 ${handler} 的距离缩短 ${closing.toFixed(1)} m。`, `${defender} closed ${closing.toFixed(1)} m on ${handler}.`)],
      inference: L(`${handler} 的突破路线受到限制。`, `${handler}'s driving lane was constrained.`),
      causalClaim: L(`${defender} 的协防限制了 ${handler}，促使其出球。`, `${defender}'s help constrained ${handler} into the pass.`),
    },
    jump: {
      time: passEv.timestamp,
      players: [defender, handler],
      movements: [{ playerId: defender, from: help.timestamp, to: passEv.timestamp, label: `${closing.toFixed(1)} m` }],
      measures: Number.isFinite(atRelease) ? [{ from: defender, to: handler, t: passEv.timestamp, label: `${atRelease.toFixed(1)} m` }] : [],
    },
  }
}

// ---------------------------------------------------------------------------
// OPEN_SPACE → PASS  (ENABLED) — the open state existed before the decision.
// ---------------------------------------------------------------------------

function openEnabledPass(open: BasketballEvent, passEv: BasketballEvent, ctx: Ctx): RuleResult | null {
  const receiver = passEv.target
  if (!receiver || !open.actor) return null
  const arrive = passEv.endTimestamp ?? passEv.timestamp
  const lead = round(passEv.timestamp - open.timestamp)
  const openEnd = open.endTimestamp ?? Infinity
  const stillOpen = openEnd >= arrive - 0.05
  const receiverLink = open.actor === receiver
  const atCatch = num(passEv.evidence.receiver_nearest_defender_distance)
  const threshold = ctx.config.openSpaceThreshold
  const peak = num(open.evidence.peak_open_distance)
  const nearest = open.target

  const tests: CausalTest[] = [
    (receiverLink ? pass : fail)("receiver", L("接球人匹配", "Receiver match"), receiverLink ? `${receiver} is the open player` : `pass went to ${receiver}, open player was ${open.actor}`),
    (lead >= 0 ? pass : fail)("precedence", L("空位先于出球", "Open before release"), `open space began ${lead.toFixed(1)}s before the pass was released`),
    (stillOpen ? pass : fail)("persistence", L("空位持续到接球", "Open at catch"), stillOpen ? `open window covers the catch at +${(arrive - open.timestamp).toFixed(1)}s` : `open window closed before the catch`),
    (atCatch >= threshold ? pass : fail)("threshold", L("接球瞬间阈值", "Threshold at catch"), `${atCatch.toFixed(1)} m ${atCatch >= threshold ? ">=" : "<"} ${threshold.toFixed(1)} m`),
  ]
  const factors: CausalFactor[] = [
    { id: "lead", label: L("创造领先量", "Creation lead"), score: clamp01(lead / 1.0) * 0.5 + 0.5 * (lead >= 0 ? 1 : 0), detail: `${lead.toFixed(1)}s` },
    { id: "persistence", label: L("空位持续性", "Persistence"), score: stillOpen ? 1 : 0.3, detail: stillOpen ? "open at catch" : "closed" },
    { id: "distance", label: L("接球时防守距离", "Distance at catch"), score: clamp01(atCatch / (threshold * 1.3)), detail: `${atCatch.toFixed(1)} m` },
  ]
  return {
    candidateRelation: "ENABLED",
    evidence: [
      { metric: "creation_lead", label: L("空位领先出球", "Creation lead"), value: lead, unit: "s", timestamp: passEv.timestamp, frameRange: frames(ctx, open.timestamp, passEv.timestamp) },
      { metric: "receiver_open_distance", label: L(`${receiver} 空位距离（峰值）`, `${receiver} open distance (peak)`), value: peak, unit: "m", timestamp: open.peakTimestamp ?? open.timestamp, players: [receiver, nearest ?? ""].filter(Boolean), rule: `>= ${threshold.toFixed(1)} m` },
      { metric: "receiver_distance_at_catch", label: L("接球时最近防守者", "Nearest defender at catch"), value: atCatch, unit: "m", timestamp: arrive, players: [receiver] },
    ],
    tests,
    factors,
    required: ["receiver", "precedence", "persistence"],
    partial: ["threshold"],
    mechanism: "receiver",
    alternativeExplanation: L("这不代表空位在心理上“导致”了传球决定；它只说明空位状态在物理上使这次传球机会成立。", "This does not claim the open space psychologically caused the pass; it means the open-space condition physically enabled the passing opportunity."),
    claims: {
      observation: [L(`空位在出球前 ${lead.toFixed(1)}s 已存在；接球时最近防守者 ${atCatch.toFixed(1)} m。`, `The open state existed ${lead.toFixed(1)}s before release; nearest defender at catch ${atCatch.toFixed(1)} m.`)],
      inference: L(`传球窗口在球到达前已经打开。`, `The passing window was open before the ball arrived.`),
      causalClaim: L(`${receiver} 的空位使这次传球机会成立。`, `${receiver}'s open space enabled the passing opportunity.`),
    },
    jump: {
      time: passEv.timestamp,
      players: [passEv.actor ?? "", receiver].filter(Boolean),
      movements: [],
      measures: nearest ? [{ from: receiver, to: nearest, t: passEv.timestamp, label: `${atCatch.toFixed(1)} m` }] : [],
    },
  }
}

// ---------------------------------------------------------------------------
// PASS → OPEN_THREE  (PRECEDED) — never CREATED without stronger evidence.
// ---------------------------------------------------------------------------

function passPrecededShot(passEv: BasketballEvent, three: BasketballEvent, ctx: Ctx): RuleResult | null {
  const shooter = three.actor
  if (!shooter) return null
  const link = passEv.target === shooter
  const arrive = passEv.endTimestamp ?? passEv.timestamp
  const catchToRelease = num(three.evidence.catch_to_release, round(three.timestamp - arrive))
  const contest = num(three.evidence.contest_distance)
  const zone = String(three.evidence.zone ?? "")
  const tests: CausalTest[] = [
    (link ? pass : fail)("actor", L("接球人即出手人", "Receiver is shooter"), link ? `${shooter} received and shot` : `receiver ${passEv.target} ≠ shooter ${shooter}`),
    (catchToRelease >= 0 && catchToRelease <= 2.0 ? pass : fail)("timing", L("接球到出手", "Catch to release"), `${catchToRelease.toFixed(1)}s`),
  ]
  const factors: CausalFactor[] = [
    { id: "actor", label: L("球权转移", "Possession transfer"), score: link ? 1 : 0, detail: link ? "matched" : "no match" },
    { id: "timing", label: L("接球到出手", "Catch to release"), score: clamp01(1 - catchToRelease / 2.5), detail: `${catchToRelease.toFixed(1)}s` },
    { id: "contest", label: L("干扰距离", "Contest distance"), score: clamp01(contest / (ctx.config.contestDistance * 2)), detail: `${contest.toFixed(1)} m` },
  ]
  return {
    candidateRelation: "PRECEDED",
    evidence: [
      { metric: "receiver", label: L("接球人", "Pass receiver"), value: undefined, timestamp: arrive, players: [passEv.target ?? ""].filter(Boolean) },
      { metric: "catch_to_release", label: L("接球到出手", "Catch to release"), value: catchToRelease, unit: "s", timestamp: three.timestamp, frameRange: frames(ctx, arrive, three.timestamp) },
      { metric: "contest_distance", label: L("出手干扰距离", "Contest distance"), value: contest, unit: "m", timestamp: three.timestamp, players: [shooter, three.target ?? ""].filter(Boolean), rule: `contested if < ${ctx.config.contestDistance.toFixed(1)} m` },
      { metric: "shot_zone", label: L("出手区域", "Shot zone"), value: num(three.evidence.shot_distance), unit: `m · ${zone}`, timestamp: three.timestamp, players: [shooter] },
    ],
    tests,
    factors,
    required: ["actor", "timing"],
    partial: [],
    mechanism: "actor",
    alternativeExplanation: L("传球先于出手，但出手决定属于射手；这里只断言先后与球权转移，不断言“创造”。", "The pass preceded the shot, but the decision to shoot belongs to the shooter; only precedence and possession transfer are asserted, not creation."),
    claims: {
      observation: [L(`${shooter} 接球后 ${catchToRelease.toFixed(1)}s 出手，最近防守者 ${contest.toFixed(1)} m。`, `${shooter} released ${catchToRelease.toFixed(1)}s after the catch with a ${contest.toFixed(1)} m contest.`)],
      inference: L("接球即投。", "Catch-and-shoot."),
      causalClaim: L(`传球先于并送出了这次出手（PRECEDED，非 CREATED）。`, `The pass preceded and delivered the shot (PRECEDED, not CREATED).`),
    },
    jump: {
      time: three.timestamp,
      players: [shooter, passEv.actor ?? ""].filter(Boolean),
      movements: [],
      measures: three.target ? [{ from: shooter, to: three.target, t: three.timestamp, label: `${contest.toFixed(1)} m` }] : [],
    },
  }
}

// ---------------------------------------------------------------------------
// DRIVE → DEFENSIVE_COLLAPSE  (TRIGGERED)
// ---------------------------------------------------------------------------

function driveTriggeredCollapse(drive: BasketballEvent, collapse: BasketballEvent, ctx: Ctx): RuleResult | null {
  if (!drive.actor) return null
  const lag = round(collapse.timestamp - drive.timestamp)
  const driveEnd = drive.endTimestamp ?? drive.timestamp
  const count = num(collapse.evidence.defenders_collapsing)
  const total = num(collapse.evidence.total_basket_shift)
  const basketDelta = num(drive.evidence.distance_to_basket_change)
  const tests: CausalTest[] = [
    (lag >= 0 && collapse.timestamp <= driveEnd + 1.2 ? pass : fail)("temporal", L("时间窗口", "Temporal"), `collapse +${lag.toFixed(1)}s after drive onset`),
    (basketDelta < -0.5 ? pass : fail)("handler_approach", L("持球人逼近篮筐", "Handler toward basket"), `${basketDelta.toFixed(1)} m`),
    (count >= ctx.config.collapseMinDefenders ? pass : fail)("mass", L("收缩人数", "Collapsing defenders"), `${count} defenders · total ${total.toFixed(1)} m toward basket`),
  ]
  return {
    candidateRelation: "TRIGGERED",
    evidence: [
      { metric: "defenders_collapsing", label: L("收缩防守人数", "Defenders collapsing"), value: count, unit: "", timestamp: collapse.timestamp, players: String(collapse.evidence.defenders ?? "").split(",").filter(Boolean) },
      { metric: "total_basket_shift", label: L("总篮下位移", "Total basket shift"), value: total, unit: "m", timestamp: collapse.timestamp },
    ],
    tests,
    factors: [
      { id: "temporal", label: L("时间接近度", "Temporal proximity"), score: temporalScore(lag, 2.5), detail: `+${lag.toFixed(1)}s` },
      { id: "mass", label: L("收缩强度", "Collapse mass"), score: clamp01(total / 6), detail: `${total.toFixed(1)} m` },
      { id: "stimulus", label: L("突破强度", "Drive stimulus"), score: clamp01(Math.abs(basketDelta) / 4), detail: `${basketDelta.toFixed(1)} m` },
    ],
    required: ["temporal", "handler_approach", "mass"],
    partial: [],
    mechanism: "mass",
    claims: {
      observation: [L(`${count} 名防守者共向篮筐移动 ${total.toFixed(1)} m。`, `${count} defenders moved a combined ${total.toFixed(1)} m toward the basket.`)],
      inference: L("防守阵型向禁区收缩。", "The defense collapsed toward the paint."),
      causalClaim: L(`${drive.actor} 的突破触发了防守收缩。`, `${drive.actor}'s drive triggered the collapse.`),
    },
    jump: {
      time: collapse.timestamp,
      players: [drive.actor, ...String(collapse.evidence.defenders ?? "").split(",").filter(Boolean)],
      movements: String(collapse.evidence.defenders ?? "").split(",").filter(Boolean).map((id) => ({ playerId: id, from: drive.timestamp, to: collapse.timestamp, label: "" })),
      measures: [],
    },
  }
}

// ---------------------------------------------------------------------------
// DRIVE → PASS  (PRECEDED) — same actor gives the ball up after the drive.
// ---------------------------------------------------------------------------

function drivePrecededPass(drive: BasketballEvent, passEv: BasketballEvent, ctx: Ctx): RuleResult | null {
  if (!drive.actor) return null
  const same = drive.actor === passEv.actor
  const driveEnd = drive.endTimestamp ?? drive.timestamp
  const gap = round(passEv.timestamp - driveEnd)
  const tests: CausalTest[] = [
    (same ? pass : fail)("actor", L("同一持球人", "Same handler"), same ? `${drive.actor} drove and passed` : `driver ${drive.actor} ≠ passer ${passEv.actor}`),
    (gap >= -0.2 && gap <= 2.0 ? pass : fail)("timing", L("突破结束到出球", "Drive end to release"), `${gap.toFixed(1)}s`),
  ]
  return {
    candidateRelation: "PRECEDED",
    evidence: [{ metric: "drive_to_pass", label: L("突破结束到出球", "Drive end to pass"), value: gap, unit: "s", timestamp: passEv.timestamp, frameRange: frames(ctx, driveEnd, passEv.timestamp), players: [drive.actor] }],
    tests,
    factors: [
      { id: "actor", label: L("球权连续", "Possession continuity"), score: same ? 1 : 0, detail: same ? "same handler" : "different" },
      { id: "timing", label: L("时间接近度", "Temporal proximity"), score: temporalScore(Math.max(0, gap), 2.5), detail: `${gap.toFixed(1)}s` },
    ],
    required: ["actor", "timing"],
    partial: [],
    mechanism: "actor",
    claims: {
      observation: [L(`${drive.actor} 在突破结束后 ${gap.toFixed(1)}s 出球。`, `${drive.actor} released the ball ${gap.toFixed(1)}s after the drive ended.`)],
      inference: L("突破以传球收尾。", "The drive ended in a pass."),
      causalClaim: L("突破先于传球（仅断言先后与球权连续）。", "The drive preceded the pass (precedence and continuity only)."),
    },
    jump: { time: passEv.timestamp, players: [drive.actor, passEv.target ?? ""].filter(Boolean), movements: [{ playerId: drive.actor, from: drive.timestamp, to: passEv.timestamp, label: "" }], measures: [] },
  }
}

const RULES: CausalRule[] = [
  { from: "DRIVE", to: "HELP_DEFENSE", window: 3, evaluate: driveTriggeredHelp },
  { from: "DRIVE", to: "DEFENSIVE_COLLAPSE", window: 3, evaluate: driveTriggeredCollapse },
  { from: "DRIVE", to: "OPEN_SPACE", window: 3, evaluate: driveOpen },
  { from: "HELP_DEFENSE", to: "OPEN_SPACE", window: 2, evaluate: helpCreatedOpen },
  { from: "HELP_DEFENSE", to: "PASS", window: 3, evaluate: helpConstrainedPass },
  { from: "OPEN_SPACE", to: "PASS", window: 4, evaluate: openEnabledPass },
  { from: "DRIVE", to: "PASS", window: 3, evaluate: drivePrecededPass },
  { from: "PASS", to: "OPEN_THREE", window: 3, evaluate: passPrecededShot },
]

function decide(result: RuleResult): { status: CausalStatus; relation: CausalRelation; confidence: number } {
  const byId = new Map(result.tests.map((t) => [t.id, t.result]))
  const requiredOk = result.required.every((id) => byId.get(id) === "PASS")
  const partialOk = result.partial.length === 0 || result.partial.some((id) => byId.get(id) === "PASS")
  const temporalOk = byId.get("temporal") !== "FAIL"
  const mechanismOk = byId.get(result.mechanism) === "PASS"
  const combined = combine(result.factors)

  // No physical mechanism → time alone. Never a causal edge.
  if (!temporalOk || !mechanismOk) {
    const temporal = result.factors.find((f) => f.id === "temporal")
    return { status: "TEMPORAL_ONLY", relation: "TEMPORAL_ONLY", confidence: round(temporal?.score ?? 0) }
  }
  if (requiredOk && partialOk) {
    return { status: "SUPPORTED", relation: result.candidateRelation, confidence: Math.max(0.5, combined) }
  }
  // The mechanism is measurable but some supporting test failed: acknowledge
  // the ambiguity instead of pretending certainty.
  return { status: "WEAK", relation: result.candidateRelation, confidence: Math.min(0.6, combined) }
}

function temporalOnly(a: BasketballEvent, b: BasketballEvent, ctx: Ctx): CausalEdge {
  const lag = round(b.timestamp - a.timestamp)
  return {
    id: `${a.id}->${b.id}`,
    fromEventId: a.id,
    toEventId: b.id,
    fromType: a.type,
    toType: b.type,
    candidateRelation: "PRECEDED",
    relation: "TEMPORAL_ONLY",
    status: "TEMPORAL_ONLY",
    confidence: 0,
    evidence: [{ metric: "lag", label: L("时间间隔", "Lag"), value: lag, unit: "s", timestamp: b.timestamp, frameRange: frames(ctx, a.timestamp, b.timestamp) }],
    tests: [
      pass("temporal", L("时间顺序", "Temporal"), `+${lag.toFixed(1)}s`),
      fail("mechanism", L("物理机制", "Physical mechanism"), "no rule measures a mechanism between these events"),
    ],
    factors: [],
    claims: {
      observation: [L(`${b.type} 发生在 ${a.type} 之后 ${lag.toFixed(1)}s。`, `${b.type} occurred ${lag.toFixed(1)}s after ${a.type}.`)],
      inference: L("无可测量的机制。", "No measurable mechanism."),
      causalClaim: L("不成立：仅时间顺序。", "Not asserted: temporal order only."),
    },
    jump: { time: b.timestamp, players: [a.actor ?? "", b.actor ?? ""].filter(Boolean), movements: [], measures: [] },
    ruleless: true,
  }
}

/**
 * Evaluate every rule-covered pair and every adjacent pair. Rule-covered pairs
 * produce a full test record; adjacent pairs without a rule are recorded as
 * TEMPORAL_ONLY so the debug view can show what was NOT inferred.
 */
export function buildCausalGraph(
  events: BasketballEvent[],
  states: CourtState[],
  config: DetectorConfig,
): CausalGraph {
  const ctx: Ctx = { states, config }
  const ordered = [...events].sort((a, b) => a.timestamp - b.timestamp)
  const nodes: PlayGraphNode[] = ordered.map((e) => ({ id: e.id, eventId: e.id, type: e.type, timestamp: e.timestamp }))
  const edges: CausalEdge[] = []
  const seen = new Set<string>()

  for (let i = 0; i < ordered.length; i++) {
    for (let j = i + 1; j < ordered.length; j++) {
      const a = ordered[i]
      const b = ordered[j]
      const key = `${a.id}->${b.id}`
      for (const rule of RULES) {
        if (rule.from !== a.type || rule.to !== b.type) continue
        if (b.timestamp - a.timestamp > rule.window) continue
        if (seen.has(key)) continue
        const result = rule.evaluate(a, b, ctx)
        if (!result) continue
        const verdict = decide(result)
        seen.add(key)
        edges.push({
          id: key,
          fromEventId: a.id,
          toEventId: b.id,
          fromType: a.type,
          toType: b.type,
          candidateRelation: result.candidateRelation,
          relation: verdict.relation,
          status: verdict.status,
          confidence: verdict.confidence,
          evidence: result.evidence,
          tests: result.tests,
          factors: result.factors,
          counterfactual: result.counterfactual,
          alternativeExplanation: result.alternativeExplanation,
          claims: result.claims,
          jump: result.jump,
        })
      }
      if (j === i + 1 && !seen.has(key)) {
        seen.add(key)
        edges.push(temporalOnly(a, b, ctx))
      }
    }
  }

  return { nodes, edges }
}

/** The legacy Play Graph view: only edges with a causal relation. */
export function toPlayGraph(causal: CausalGraph): PlayGraph {
  return {
    nodes: causal.nodes,
    edges: causal.edges
      .filter((e) => e.status !== "TEMPORAL_ONLY")
      .map((e) => ({
        source: e.fromEventId,
        target: e.toEventId,
        relationship: e.relation as Exclude<CausalRelation, "TEMPORAL_ONLY">,
        evidence: Object.fromEntries(
          e.evidence
            .filter((ev) => typeof (ev.delta ?? ev.value) === "number" && Number.isFinite(ev.delta ?? ev.value))
            .map((ev) => [ev.metric, (ev.delta ?? ev.value) as number]),
        ),
      })),
  }
}

/**
 * WHAT CREATED THE SHOT? Walk backwards from the final event along SUPPORTED
 * edges only. A WEAK or TEMPORAL_ONLY link ends the causal explanation there.
 */
export function traceCause(causal: CausalGraph, rootEventId?: string): CausalTrace {
  const root =
    rootEventId ??
    causal.nodes.find((n) => n.type === "OPEN_THREE")?.eventId ??
    causal.nodes[causal.nodes.length - 1]?.eventId ??
    null
  if (!root) return { rootEventId: null, chain: [], stoppedAt: null }

  const chain: CausalEdge[] = []
  const visited = new Set<string>([root])
  let current = root
  let stoppedAt: CausalTrace["stoppedAt"] = null

  while (true) {
    const incoming = causal.edges
      .filter((e) => e.toEventId === current && !visited.has(e.fromEventId))
      .sort((a, b) => rank(b) - rank(a))
    const best = incoming[0]
    if (!best) {
      stoppedAt = { eventId: current, reason: "NO_INCOMING" }
      break
    }
    if (best.status !== "SUPPORTED") {
      stoppedAt = { eventId: current, reason: best.status === "WEAK" ? "WEAK" : "TEMPORAL_ONLY" }
      break
    }
    chain.unshift(best)
    visited.add(best.fromEventId)
    current = best.fromEventId
  }
  return { rootEventId: root, chain, stoppedAt }
}

/** Stronger mechanisms outrank weaker ones; PRECEDED is the weakest causal claim. */
const RELATION_STRENGTH: Record<CausalRelation, number> = {
  CREATED: 5,
  TRIGGERED: 4,
  ENABLED: 3,
  CONSTRAINED: 2,
  PRECEDED: 1,
  TEMPORAL_ONLY: 0,
}

function rank(e: CausalEdge) {
  const s = e.status === "SUPPORTED" ? 2 : e.status === "WEAK" ? 1 : 0
  return s * 100 + RELATION_STRENGTH[e.relation] * 10 + e.confidence
}

/** "DRIVE → HELP → OPEN → PASS → THREE" for compare views. */
export function chainSignature(trace: CausalTrace, nodes: PlayGraphNode[]): string[] {
  if (trace.chain.length === 0) {
    const root = nodes.find((n) => n.eventId === trace.rootEventId)
    return root ? [root.type] : []
  }
  const types = trace.chain.map((e) => e.fromType)
  types.push(trace.chain[trace.chain.length - 1].toType)
  return types
}

export const RELATION_LABEL: Record<CausalRelation, Localized> = {
  TRIGGERED: L("触发", "Triggered"),
  CREATED: L("创造", "Created"),
  ENABLED: L("使成立", "Enabled"),
  CONSTRAINED: L("限制", "Constrained"),
  PRECEDED: L("先于", "Preceded"),
  TEMPORAL_ONLY: L("仅时间先后", "Temporal only"),
}

export const STATUS_LABEL: Record<CausalStatus, Localized> = {
  SUPPORTED: L("成立", "Supported"),
  WEAK: L("证据不足", "Weak"),
  TEMPORAL_ONLY: L("仅时间先后", "Temporal only"),
}
