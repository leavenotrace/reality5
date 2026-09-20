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

  const publicSegments: CommentarySegment[] = [
    text("持球人的"),
    ev(drive, "突破"),
    text("吸引了"),
    ev(help ?? collapse, "协防"),
    text("，弱侧底角因此出现"),
    ev(open, "空位"),
    text("，随后完成"),
    ev(pass, "分球"),
    text("和"),
    ev(three, "三分出手"),
    text("。"),
  ]

  const proSegments: CommentarySegment[] = [
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

  const coachSegments: CommentarySegment[] = [
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

  const compact = (ids: (string | null)[]) => ids.filter((v): v is string => Boolean(v))

  return [
    {
      audience: "public",
      label: { zh: "大众版", en: "Fan" },
      segments: publicSegments,
      chips: compact([shiftId, openId]),
    },
    {
      audience: "pro",
      label: { zh: "专业版", en: "Analyst" },
      segments: proSegments,
      chips: compact([shiftId, openId, leadId]),
    },
    {
      audience: "coach",
      label: { zh: "教练版", en: "Coach" },
      segments: coachSegments,
      chips: compact([speedId, shiftId, openId, leadId, contestId]),
    },
  ]
}
