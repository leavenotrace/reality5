import type { CausalEdge, CausalGraph, CausalTrace, ClaimType } from "./causal"
import { evidenceId } from "./evidence"
import type { BasketballEvent, Localized, RosterEntry } from "./types"

/**
 * CAUSAL STORY MODE. The story is not written first and justified later — it
 * is assembled from the SUPPORTED edges of the causal trace, one sentence per
 * event, each sentence carrying the evidence ids it is grounded in and the
 * type of claim it makes.
 */
export interface CausalStorySentence {
  eventId: string
  eventType: BasketballEvent["type"]
  claim: ClaimType
  text: Localized
  /** Promoted evidence ids (Evidence panel) backing the sentence. */
  evidenceIds: string[]
  /** Edge this sentence realizes, when it is a causal step. */
  edgeId?: string
}

export interface CausalStory {
  sentences: CausalStorySentence[]
  /** Reason the story stops early, when the trace hit an unsupported link. */
  stopped?: Localized
  /** How many causal steps are SUPPORTED. */
  supportedEdges: number
}

const fmt = (v: unknown, p = 1) => (typeof v === "number" ? v.toFixed(p) : "—")
const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0)

export function buildCausalStory(
  events: BasketballEvent[],
  causal: CausalGraph,
  trace: CausalTrace,
  roster: RosterEntry[],
): CausalStory {
  const byId = new Map(events.map((e) => [e.id, e]))
  const jersey = (id: string | undefined) => {
    const p = roster.find((r) => r.id === id)
    return p ? `#${p.number}` : String(id ?? "")
  }

  const sentences: CausalStorySentence[] = []

  const first = trace.chain[0]
  const rootEvent = trace.rootEventId ? byId.get(trace.rootEventId) : undefined

  // Opening observation: the first cause in the chain (or the root if none).
  const opener = first ? byId.get(first.fromEventId) : rootEvent
  if (opener) sentences.push(observe(opener, jersey))

  for (const edge of trace.chain) {
    const effect = byId.get(edge.toEventId)
    if (!effect) continue
    sentences.push(realize(edge, effect, byId, jersey))
  }

  let stopped: Localized | undefined
  if (trace.stoppedAt && trace.chain.length > 0) {
    const at = byId.get(trace.stoppedAt.eventId)
    if (trace.stoppedAt.reason === "TEMPORAL_ONLY") {
      stopped = {
        zh: `${at?.type ?? ""} 之前的事件只有时间先后，没有可测量的机制。因果解释在此停止。`,
        en: `Events before ${at?.type ?? ""} share only temporal order; no mechanism was measured. The causal explanation stops here.`,
      }
    } else if (trace.stoppedAt.reason === "WEAK") {
      stopped = {
        zh: `${at?.type ?? ""} 的前因证据不足（WEAK），Reality5 不假装确定。`,
        en: `The cause of ${at?.type ?? ""} is WEAK on evidence; Reality5 does not pretend certainty.`,
      }
    }
  } else if (trace.chain.length === 0 && rootEvent) {
    const weak = causal.edges.find((e) => e.toEventId === rootEvent.id && e.status === "WEAK")
    stopped = weak
      ? {
          zh: `唯一的候选前因 ${weak.fromType} → ${weak.toType} 证据不足（WEAK）。没有可支持的因果链。`,
          en: `The only candidate cause ${weak.fromType} → ${weak.toType} is WEAK. No supported causal chain.`,
        }
      : {
          zh: "没有任何 SUPPORTED 的因果边通向这个事件。它发生了，但 Reality5 无法用证据解释它为什么发生。",
          en: "No SUPPORTED causal edge leads to this event. It happened, but Reality5 cannot explain why with evidence.",
        }
  }

  return { sentences, stopped, supportedEdges: trace.chain.length }
}

function observe(e: BasketballEvent, jersey: (id?: string) => string): CausalStorySentence {
  const ev = (k: string) => evidenceId(e.id, k)
  switch (e.type) {
    case "DRIVE":
      return {
        eventId: e.id,
        eventType: e.type,
        claim: "OBSERVATION",
        text: {
          zh: `${jersey(e.actor)} 以 ${fmt(e.evidence.speed)} m/s 攻击禁区，篮下距离缩短 ${fmt(Math.abs(num(e.evidence.distance_to_basket_change)))} m。`,
          en: `${jersey(e.actor)} attacked the paint at ${fmt(e.evidence.speed)} m/s, cutting basket distance by ${fmt(Math.abs(num(e.evidence.distance_to_basket_change)))} m.`,
        },
        evidenceIds: [ev("speed"), ev("distance_to_basket_change")],
      }
    case "PASS":
      return {
        eventId: e.id,
        eventType: e.type,
        claim: "OBSERVATION",
        text: {
          zh: `${jersey(e.actor)} 传球 ${fmt(e.evidence.pass_distance)} m 给 ${jersey(e.target)}。`,
          en: `${jersey(e.actor)} passed ${fmt(e.evidence.pass_distance)} m to ${jersey(e.target)}.`,
        },
        evidenceIds: [ev("pass_distance")],
      }
    case "OPEN_THREE":
      return {
        eventId: e.id,
        eventType: e.type,
        claim: "OBSERVATION",
        text: {
          zh: `${jersey(e.actor)} 在 ${fmt(e.evidence.shot_distance)} m 处出手，最近防守者 ${fmt(e.evidence.contest_distance)} m。`,
          en: `${jersey(e.actor)} released from ${fmt(e.evidence.shot_distance)} m with a ${fmt(e.evidence.contest_distance)} m contest.`,
        },
        evidenceIds: [ev("contest_distance")],
      }
    default:
      return {
        eventId: e.id,
        eventType: e.type,
        claim: "OBSERVATION",
        text: { zh: `${e.type} 被检测到。`, en: `${e.type} detected.` },
        evidenceIds: [],
      }
  }
}

function realize(
  edge: CausalEdge,
  effect: BasketballEvent,
  byId: Map<string, BasketballEvent>,
  jersey: (id?: string) => string,
): CausalStorySentence {
  const cause = byId.get(edge.fromEventId)
  const ev = (k: string) => evidenceId(effect.id, k)
  const metric = (m: string) => edge.evidence.find((x) => x.metric === m)
  const conf = ` [${edge.relation} ${edge.confidence.toFixed(2)}]`

  switch (`${edge.fromType}->${edge.toType}`) {
    case "DRIVE->HELP_DEFENSE": {
      const shift = metric("defender_shift")?.value
      const assign = metric("assignment_distance")
      return {
        eventId: effect.id,
        eventType: effect.type,
        claim: "CAUSAL_CLAIM",
        edgeId: edge.id,
        text: {
          zh: `${jersey(effect.actor)} 离开弱侧防守对象 ${jersey(effect.target)}（距离 ${fmt(assign?.before)} → ${fmt(assign?.after)} m），向禁区移动 ${fmt(shift)} m —— 这是对突破的响应。${conf}`,
          en: `${jersey(effect.actor)} left the weak-side assignment ${jersey(effect.target)} (${fmt(assign?.before)} → ${fmt(assign?.after)} m) and shifted ${fmt(shift)} m toward the paint — a response to the drive.${conf}`,
        },
        evidenceIds: [ev("defender_shift"), ev("reaction_time")],
      }
    }
    case "HELP_DEFENSE->OPEN_SPACE": {
      const d = metric("receiver_defender_distance")
      return {
        eventId: effect.id,
        eventType: effect.type,
        claim: "CAUSAL_CLAIM",
        edgeId: edge.id,
        text: {
          zh: `这次移动把 ${jersey(effect.actor)} 的最近防守者距离从 ${fmt(d?.before)} m 拉大到 ${fmt(d?.after)} m。${conf}`,
          en: `That movement increased ${jersey(effect.actor)}'s nearest-defender distance from ${fmt(d?.before)} m to ${fmt(d?.after)} m.${conf}`,
        },
        evidenceIds: [ev("peak_open_distance")],
      }
    }
    case "OPEN_SPACE->PASS": {
      const lead = metric("creation_lead")?.value
      return {
        eventId: effect.id,
        eventType: effect.type,
        claim: "CAUSAL_CLAIM",
        edgeId: edge.id,
        text: {
          zh: `传球窗口在出球前 ${fmt(lead)} 秒就已存在；${jersey(effect.actor)} 把球送到 ${jersey(effect.target)}。${conf}`,
          en: `The passing window existed ${fmt(lead)} seconds before the release; ${jersey(effect.actor)} delivered to ${jersey(effect.target)}.${conf}`,
        },
        evidenceIds: [ev("creation_lead"), ev("pass_distance")],
      }
    }
    case "HELP_DEFENSE->PASS": {
      const d = metric("distance_to_handler")
      return {
        eventId: effect.id,
        eventType: effect.type,
        claim: "CAUSAL_CLAIM",
        edgeId: edge.id,
        text: {
          zh: `${jersey(cause?.actor)} 逼近至 ${fmt(d?.after)} m，压缩了持球人的选择，${jersey(effect.actor)} 出球。${conf}`,
          en: `${jersey(cause?.actor)} closed to ${fmt(d?.after)} m, narrowing the handler's options; ${jersey(effect.actor)} passed.${conf}`,
        },
        evidenceIds: [ev("pass_distance")],
      }
    }
    case "PASS->OPEN_THREE": {
      const c = metric("contest_distance")?.value
      const ctr = metric("catch_to_release")?.value
      return {
        eventId: effect.id,
        eventType: effect.type,
        claim: "CAUSAL_CLAIM",
        edgeId: edge.id,
        text: {
          zh: `${jersey(effect.actor)} 接球后 ${fmt(ctr)} 秒出手，最近防守者 ${fmt(c)} m。${conf}`,
          en: `${jersey(effect.actor)} then received the ball and released within ${fmt(ctr)} s with a ${fmt(c)} m contest.${conf}`,
        },
        evidenceIds: [ev("contest_distance"), ev("catch_to_release")],
      }
    }
    case "DRIVE->PASS": {
      const gap = metric("drive_to_pass")?.value
      return {
        eventId: effect.id,
        eventType: effect.type,
        claim: "CAUSAL_CLAIM",
        edgeId: edge.id,
        text: {
          zh: `突破结束 ${fmt(gap)} 秒后，${jersey(effect.actor)} 出球给 ${jersey(effect.target)}（仅先后关系）。${conf}`,
          en: `${fmt(gap)} s after the drive ended, ${jersey(effect.actor)} passed to ${jersey(effect.target)} (precedence only).${conf}`,
        },
        evidenceIds: [ev("pass_distance")],
      }
    }
    case "DRIVE->DEFENSIVE_COLLAPSE": {
      const n = metric("defenders_collapsing")?.value
      return {
        eventId: effect.id,
        eventType: effect.type,
        claim: "CAUSAL_CLAIM",
        edgeId: edge.id,
        text: {
          zh: `${fmt(n, 0)} 名防守者向禁区收缩。${conf}`,
          en: `${fmt(n, 0)} defenders collapsed toward the paint.${conf}`,
        },
        evidenceIds: [ev("defenders_collapsing")],
      }
    }
    default:
      return {
        eventId: effect.id,
        eventType: effect.type,
        claim: "INFERENCE",
        edgeId: edge.id,
        text: edge.claims.causalClaim,
        evidenceIds: [],
      }
  }
}
