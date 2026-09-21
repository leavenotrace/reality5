import type { CausalGraph } from "./causal"
import { evidenceId } from "./evidence"
import type {
  BasketballEvent,
  Commentary,
  CommentaryContext,
  CommentarySegment,
  DetectorConfig,
  RosterEntry,
} from "./types"

/**
 * commentaryContext: the ONLY facts the story layer may mention. Every value
 * is copied from a detected event's evidence — nothing is invented here.
 */
export function buildCommentaryContext(
  events: BasketballEvent[],
  config: DetectorConfig,
): CommentaryContext {
  const drive = events.find((e) => e.type === "DRIVE")
  const help = events.find((e) => e.type === "HELP_DEFENSE")
  const collapse = events.find((e) => e.type === "DEFENSIVE_COLLAPSE")
  const pass = events.find((e) => e.type === "PASS")
  const three = events.find((e) => e.type === "OPEN_THREE")
  const open = events.find(
    (e) => e.type === "OPEN_SPACE" && (pass ? e.actor === pass.target : e.evidence.has_ball === "no"),
  )

  return {
    ball_handler: drive?.actor,
    drive_speed: drive?.evidence.speed,
    drive_basket_change: drive?.evidence.distance_to_basket_change,
    help_defender: help?.actor,
    help_defender_shift: help?.evidence.defender_shift,
    help_reaction_time: help?.evidence.reaction_time,
    help_shift_threshold: config.helpShiftThreshold,
    defenders_collapsing: collapse?.evidence.defenders_collapsing,
    shooter: open?.actor ?? pass?.target,
    open_distance: open?.evidence.peak_open_distance,
    open_threshold: config.openSpaceThreshold,
    creation_lead: pass?.evidence.creation_lead,
    pass_distance: pass?.evidence.pass_distance,
    contest_distance: three?.evidence.contest_distance,
    shot_zone: three?.evidence.zone,
    event_ids: events.map((e) => e.id).join(","),
  }
}

const fmt = (v: unknown, p = 1) => (typeof v === "number" ? v.toFixed(p) : "—")

/**
 * Deterministic template commentary. Segments reference the event / evidence
 * ids they are grounded in so the UI can link each claim back to Reality.
 */
export function buildCommentary(
  events: BasketballEvent[],
  ctx: CommentaryContext,
  roster: RosterEntry[],
  causal?: CausalGraph,
): Commentary[] {
  const byType = (type: BasketballEvent["type"], actor?: string) =>
    events.find((e) => e.type === type && (actor ? e.actor === actor : true))
  const drive = byType("DRIVE")
  const help = byType("HELP_DEFENSE")
  const collapse = byType("DEFENSIVE_COLLAPSE")
  const open = events.find((e) => e.type === "OPEN_SPACE" && e.actor === ctx.shooter)
  const pass = byType("PASS")
  const three = byType("OPEN_THREE")

  const jersey = (id: unknown) => {
    const p = roster.find((r) => r.id === id)
    return p ? `#${p.number}` : String(id ?? "")
  }

  const text = (value: string): CommentarySegment => ({ kind: "text", value })
  const ev = (e: BasketballEvent | undefined, value: string): CommentarySegment =>
    e ? { kind: "event", eventId: e.id, value } : text(value)
  const chip = (e: BasketballEvent | undefined, key: string, value: string): CommentarySegment =>
    e ? { kind: "evidence", evidenceId: evidenceId(e.id, key), value } : text(value)

  const shiftId = help ? evidenceId(help.id, "defender_shift") : null
  const openId = open ? evidenceId(open.id, "peak_open_distance") : null
  const leadId = pass ? evidenceId(pass.id, "creation_lead") : null
  const speedId = drive ? evidenceId(drive.id, "speed") : null
  const contestId = three ? evidenceId(three.id, "contest_distance") : null

  // The "drive drew help, help opened the corner" story is only allowed when
  // the causal engine SUPPORTS HELP_DEFENSE → OPEN_SPACE. Co-occurrence of the
  // two events is not enough — correlation is not causation.
  const helpCreatedOpen = causal
    ? causal.edges.some(
        (e) =>
          e.fromType === "HELP_DEFENSE" &&
          e.toType === "OPEN_SPACE" &&
          e.toEventId === open?.id &&
          e.status === "SUPPORTED",
      )
    : Boolean(help && open)
  const contested = three?.evidence.contested === "yes"
  const shotWord = three ? (contested ? "受干扰的三分出手" : "三分出手") : "出手"

  const publicSegments: CommentarySegment[] = helpCreatedOpen
    ? [
        text("持球人的"),
        ev(drive, "突破"),
        text("吸引了"),
        ev(help, "协防"),
        text("，弱侧底角因此出现"),
        ev(open, "空位"),
        text("，随后完成"),
        ev(pass, "分球"),
        text("和"),
        ev(three, "三分出手"),
        text("。"),
      ]
    : [
        text("持球人的"),
        ev(drive, "突破"),
        text("没有吸引到协防，弱侧防守者守住了底角。球虽然"),
        ev(pass, "传到"),
        text("了底角，但射手并没有真正的空位，最终只能完成一次"),
        ev(three, shotWord),
        text("。"),
      ]

  const proSegments: CommentarySegment[] = helpCreatedOpen
    ? [
        text(`持球人 ${jersey(ctx.ball_handler)} `),
        ev(drive, "突破"),
        text("后，弱侧防守者 "),
        text(jersey(ctx.help_defender)),
        text(" 向禁区移动约 "),
        chip(help, "defender_shift", `${fmt(ctx.help_defender_shift)} 米`),
        text(`，使底角射手 ${jersey(ctx.shooter)} 与最近防守者距离扩大到约 `),
        chip(open, "peak_open_distance", `${fmt(ctx.open_distance)} 米`),
        text("。这个投篮机会在传球到达之前 "),
        chip(pass, "creation_lead", `${fmt(ctx.creation_lead)} 秒`),
        text(" 已经形成。"),
      ]
    : [
        text(`持球人 ${jersey(ctx.ball_handler)} `),
        ev(drive, "突破"),
        text("时速度达到 "),
        chip(drive, "speed", `${fmt(ctx.drive_speed)} m/s`),
        text(
          `，但弱侧防守者没有离开底角射手 ${jersey(ctx.shooter)}，其最近防守者距离始终低于 ${fmt(ctx.open_threshold)} 米的空位阈值。`,
        ),
        ev(pass, "传球"),
        text("到达时接球者并未处于空位，出手瞬间最近防守者距离仅 "),
        chip(three, "contest_distance", `${fmt(ctx.contest_distance)} 米`),
        text(contested ? "，属于受干扰出手。" : "。"),
      ]

  const coachSegments: CommentarySegment[] = helpCreatedOpen
    ? [
        text(`${jersey(ctx.help_defender)} 面对的是一个结构性取舍：${jersey(ctx.ball_handler)} 的`),
        ev(drive, "突破"),
        text("速度达到 "),
        chip(drive, "speed", `${fmt(ctx.drive_speed)} m/s`),
        text(
          `，共 ${fmt(ctx.defenders_collapsing, 0)} 名防守者向禁区收缩。不协防，禁区将被直接攻击；协防，就必须离开底角射手。他选择护框，向禁区位移 `,
        ),
        chip(help, "defender_shift", `${fmt(ctx.help_defender_shift)} m`),
        text("，代价是把底角让出 "),
        chip(open, "peak_open_distance", `${fmt(ctx.open_distance)} m`),
        text(` 的出手空间（阈值 ${fmt(ctx.open_threshold)} m）。空位比传球早 `),
        chip(pass, "creation_lead", `${fmt(ctx.creation_lead)} s`),
        text(" 形成，出手瞬间最近防守者距离 "),
        chip(three, "contest_distance", `${fmt(ctx.contest_distance)} m`),
        text("，说明进攻方是有意识地兑现这一取舍，而非偶然。"),
      ]
    : [
        text(`防守方在这一回合没有付出结构性代价：${jersey(ctx.ball_handler)} 的`),
        ev(drive, "突破"),
        text("速度达到 "),
        chip(drive, "speed", `${fmt(ctx.drive_speed)} m/s`),
        text(
          `，篮筐距离缩短 ${fmt(typeof ctx.drive_basket_change === "number" ? Math.abs(ctx.drive_basket_change) : undefined)} m，但弱侧防守者选择留守底角，没有发生达到 ${fmt(ctx.help_shift_threshold)} m 阈值的协防位移，也没有形成防守收缩。`,
        ),
        ev(pass, "传球"),
        text("因此没有兑现任何提前形成的空位，出手瞬间最近防守者距离 "),
        chip(three, "contest_distance", `${fmt(ctx.contest_distance)} m`),
        text(
          contested
            ? "，低于干扰阈值。进攻方应当在突破未吸引协防时选择攻击禁区���重新组织，而不是把球传向一个被守住的底角。"
            : "。进攻方应当重新组织，而不是把球传向一个被守住的底角。",
        ),
      ]

  const shotWordEn = three ? (contested ? "contested three" : "three") : "shot"
  const basketChange = fmt(typeof ctx.drive_basket_change === "number" ? Math.abs(ctx.drive_basket_change) : undefined)

  const publicSegmentsEn: CommentarySegment[] = helpCreatedOpen
    ? [
        text("The ball handler's "),
        ev(drive, "drive"),
        text(" pulled in the "),
        ev(help, "help defender"),
        text(", which opened the weak-side "),
        ev(open, "corner"),
        text(". The "),
        ev(pass, "kick-out"),
        text(" followed and the "),
        ev(three, "three"),
        text(" went up."),
      ]
    : [
        text("The ball handler's "),
        ev(drive, "drive"),
        text(" did not draw help; the weak-side defender stayed home in the corner. The ball was "),
        ev(pass, "passed"),
        text(" to the corner, but the shooter was never truly open and had to settle for a "),
        ev(three, shotWordEn),
        text("."),
      ]

  const proSegmentsEn: CommentarySegment[] = helpCreatedOpen
    ? [
        text(`After ${jersey(ctx.ball_handler)}'s `),
        ev(drive, "drive"),
        text(`, weak-side defender ${jersey(ctx.help_defender)} shifted about `),
        chip(help, "defender_shift", `${fmt(ctx.help_defender_shift)} m`),
        text(` toward the paint, stretching corner shooter ${jersey(ctx.shooter)}'s nearest-defender distance to about `),
        chip(open, "peak_open_distance", `${fmt(ctx.open_distance)} m`),
        text(". The look existed "),
        chip(pass, "creation_lead", `${fmt(ctx.creation_lead)} s`),
        text(" before the pass arrived."),
      ]
    : [
        text(`${jersey(ctx.ball_handler)}'s `),
        ev(drive, "drive"),
        text(" reached "),
        chip(drive, "speed", `${fmt(ctx.drive_speed)} m/s`),
        text(
          `, but the weak-side defender never left corner shooter ${jersey(ctx.shooter)}; the nearest-defender distance stayed below the ${fmt(ctx.open_threshold)} m open-space threshold. `,
        ),
        ev(pass, "The pass"),
        text(" arrived to a covered receiver, with the nearest defender only "),
        chip(three, "contest_distance", `${fmt(ctx.contest_distance)} m`),
        text(contested ? " away at release — a contested shot." : " away at release."),
      ]

  const coachSegmentsEn: CommentarySegment[] = helpCreatedOpen
    ? [
        text(`${jersey(ctx.help_defender)} faced a structural trade-off: ${jersey(ctx.ball_handler)}'s `),
        ev(drive, "drive"),
        text(" hit "),
        chip(drive, "speed", `${fmt(ctx.drive_speed)} m/s`),
        text(
          ` with ${fmt(ctx.defenders_collapsing, 0)} defenders collapsing on the paint. No help means the rim is attacked directly; helping means leaving the corner shooter. He chose the rim, shifting `,
        ),
        chip(help, "defender_shift", `${fmt(ctx.help_defender_shift)} m`),
        text(" toward the paint at the cost of "),
        chip(open, "peak_open_distance", `${fmt(ctx.open_distance)} m`),
        text(` of shooting space in the corner (threshold ${fmt(ctx.open_threshold)} m). The space existed `),
        chip(pass, "creation_lead", `${fmt(ctx.creation_lead)} s`),
        text(" before the pass, and the nearest defender was "),
        chip(three, "contest_distance", `${fmt(ctx.contest_distance)} m`),
        text(" away at release — the offense cashed in the trade-off deliberately, not by accident."),
      ]
    : [
        text(`The defense paid no structural price on this possession: ${jersey(ctx.ball_handler)}'s `),
        ev(drive, "drive"),
        text(" reached "),
        chip(drive, "speed", `${fmt(ctx.drive_speed)} m/s`),
        text(
          ` and cut the distance to the rim by ${basketChange} m, but the weak-side defender stayed home — no help shift reached the ${fmt(ctx.help_shift_threshold)} m threshold and no collapse formed. `,
        ),
        ev(pass, "The pass"),
        text(" therefore cashed in no pre-existing space; the nearest defender was "),
        chip(three, "contest_distance", `${fmt(ctx.contest_distance)} m`),
        text(
          contested
            ? " away at release, inside the contest threshold. When a drive draws no help, attack the rim or reset — do not kick to a covered corner."
            : " away at release. The offense should reset rather than kick to a covered corner.",
        ),
      ]

  const compact = (ids: (string | null)[]) => ids.filter((v): v is string => Boolean(v))

  return [
    {
      audience: "public",
      label: { zh: "大众版", en: "Fan" },
      segments: publicSegments,
      segmentsEn: publicSegmentsEn,
      chips: compact([shiftId, openId]),
    },
    {
      audience: "pro",
      label: { zh: "专业版", en: "Analyst" },
      segments: proSegments,
      segmentsEn: proSegmentsEn,
      chips: compact([shiftId, openId, leadId]),
    },
    {
      audience: "coach",
      label: { zh: "教练版", en: "Coach" },
      segments: coachSegments,
      segmentsEn: coachSegmentsEn,
      chips: compact([speedId, shiftId, openId, leadId, contestId]),
    },
  ]
}
