import { evidenceId } from "@/lib/reality/evidence"
import type {
  BasketballEvent,
  PossessionAnalysis,
  RosterEntry,
} from "@/lib/reality/types"
import { basketFor } from "@/lib/reality/court"
import { formatClock, parseClock } from "./tracking"
import type { Localized, OverlaySpec, PresentedEvent } from "./types"

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0))
const fmt = (v: unknown, p = 1) => num(v).toFixed(p)

/**
 * Turns engine events into displayable events. Titles, summaries and overlay
 * geometry are derived from each event's actors and evidence — the rules are
 * per event TYPE, never per hand-picked moment.
 */
export function presentEvents(
  analysis: PossessionAnalysis,
  roster: RosterEntry[],
  clockAtStart: string,
): PresentedEvent[] {
  const base = parseClock(clockAtStart)
  const jersey = (id?: string) => {
    const p = roster.find((r) => r.id === id)
    return p ? `#${p.number}` : (id ?? "")
  }
  const drive = analysis.events.find((e) => e.type === "DRIVE")

  return analysis.events.map((event, i) => {
    const { title, summary, actors, overlay } = describe(event, { jersey, drive, analysis })
    return {
      ...event,
      index: i + 1,
      t: event.timestamp,
      clock: formatClock(base + event.timestamp),
      title,
      summary,
      actors,
      evidenceIds: analysis.evidence.filter((ev) => ev.sourceEventId === event.id).map((ev) => ev.id),
      overlay,
    }
  })
}

interface Ctx {
  jersey: (id?: string) => string
  drive?: BasketballEvent
  analysis: PossessionAnalysis
}

function describe(
  e: BasketballEvent,
  ctx: Ctx,
): { title: Localized; summary: Localized; actors: string[]; overlay: OverlaySpec } {
  const ev = e.evidence
  const start = e.timestamp
  const end = e.endTimestamp ?? e.timestamp
  const actor = e.actor ?? ""
  const target = e.target ?? ""
  const J = ctx.jersey

  switch (e.type) {
    case "DRIVE":
      return {
        title: { zh: `突破启动 ${fmt(ev.speed)} m/s`, en: "Drive" },
        summary: {
          zh: `持球人 ${J(actor)} 以 ${fmt(ev.speed)} m/s 向篮筐切入，篮下距离缩短 ${fmt(-num(ev.distance_to_basket_change))} m。`,
          en: `Ball handler ${J(actor)} attacks the rim at ${fmt(ev.speed)} m/s.`,
        },
        actors: [actor],
        overlay: {
          highlights: [{ playerId: actor, color: "movement", pulse: true }],
          paths: [{ playerId: actor, from: start, to: end, color: "movement" }],
          zones: [{ kind: "defensive", shape: "circle", center: { playerId: actor }, radius: 9 }],
          labels: [
            {
              anchor: { playerId: actor },
              offset: { x: 3, y: -3.5 },
              color: "movement",
              evidenceId: evidenceId(e.id, "speed"),
            },
          ],
        },
      }

    case "HELP_DEFENSE":
      return {
        title: { zh: `协防发生 ${fmt(ev.peak_shift ?? ev.defender_shift)} m`, en: "Help Defense" },
        summary: {
          zh: `弱侧防守者 ${J(actor)} 离开 ${J(target)}，向禁区移动，峰值位移 ${fmt(ev.peak_shift ?? ev.defender_shift)} m，持续 ${fmt(ev.duration)} s（反应 ${fmt(ev.reaction_time)} s）。`,
          en: `Weak-side defender ${J(actor)} leaves ${J(target)}; peak shift ${fmt(ev.peak_shift ?? ev.defender_shift)} m over ${fmt(ev.duration)} s.`,
        },
        actors: [actor, target],
        overlay: {
          highlights: [
            { playerId: actor, color: "tactical", pulse: true },
            ...(ctx.drive?.actor ? [{ playerId: ctx.drive.actor, color: "movement" as const }] : []),
          ],
          paths: ctx.drive?.actor
            ? [
                {
                  playerId: ctx.drive.actor,
                  from: ctx.drive.timestamp,
                  to: ctx.drive.endTimestamp ?? ctx.drive.timestamp,
                  color: "movement",
                },
              ]
            : [],
          arrows: [{ from: { playerId: actor, t: start }, to: { playerId: actor, t: end }, kind: "defense" }],
          measures: [
            {
              from: { playerId: actor, t: start },
              to: { playerId: actor, t: end },
              evidenceId: evidenceId(e.id, "defender_shift"),
              color: "tactical",
            },
          ],
          labels: [{ anchor: { playerId: actor }, offset: { x: -2, y: 4 }, color: "tactical", text: "HELP" }],
        },
      }

    case "DEFENSIVE_COLLAPSE": {
      const defenders = String(ev.defenders ?? "").split(",").filter(Boolean)
      const from = ctx.drive?.timestamp ?? start
      return {
        title: { zh: `防守收缩 ×${fmt(ev.defenders_collapsing, 0)}`, en: "Defensive Collapse" },
        summary: {
          zh: `${defenders.map(J).join("、")} 共 ${fmt(ev.defenders_collapsing, 0)} 名防守者向禁区收缩，累计位移 ${fmt(ev.total_basket_shift)} m。`,
          en: `${defenders.length} defenders collapse toward the paint.`,
        },
        actors: defenders,
        overlay: {
          highlights: defenders.map((id, i) => ({ playerId: id, color: "tactical" as const, pulse: i === 0 })),
          zones:
            defenders.length >= 3
              ? [{ kind: "defensive", shape: "polygon", points: defenders.map((id) => ({ playerId: id })) }]
              : [],
          arrows: defenders.map((id) => ({
            from: { playerId: id, t: from },
            to: { playerId: id, t: start },
            kind: "defense" as const,
          })),
        },
      }
    }

    case "OPEN_SPACE":
      return {
        title: { zh: `空位形成 ${fmt(ev.peak_open_distance)} m`, en: "Open Space" },
        summary: {
          zh: `${J(actor)} 与最近防守者距离越过 ${fmt(ev.threshold)} m 阈值（进入 ${fmt(ev.enter_distance)} m，峰值 ${fmt(ev.peak_open_distance)} m，退出 ${fmt(ev.exit_distance)} m），空位持续 ${fmt(ev.duration)} s。`,
          en: `${J(actor)} is open for ${fmt(ev.duration)} s: enter ${fmt(ev.enter_distance)} m, peak ${fmt(ev.peak_open_distance)} m, exit ${fmt(ev.exit_distance)} m (threshold ${fmt(ev.threshold)} m).`,
        },
        actors: [actor, target],
        overlay: {
          highlights: [
            { playerId: actor, color: "space", pulse: true },
            { playerId: target, color: "tactical" },
          ],
          zones: [
            {
              kind: "open",
              shape: "circle",
              center: { playerId: actor },
              radius: num(ev.threshold),
            },
          ],
          measures: [
            {
              from: { playerId: actor },
              to: { playerId: target },
              evidenceId: evidenceId(e.id, "peak_open_distance"),
              color: "space",
            },
          ],
        },
      }

    case "PASS":
      return {
        title: { zh: `分球 ${fmt(ev.pass_distance)} m`, en: "Pass" },
        summary: {
          zh: `${J(actor)} 分球至 ${J(target)}，飞行 ${fmt(ev.flight_time)} s；接球瞬间最近防守者 ${fmt(ev.receiver_nearest_defender_distance)} m。`,
          en: `${J(actor)} kicks out to ${J(target)}.`,
        },
        actors: [actor, target],
        overlay: {
          highlights: [
            { playerId: actor, color: "movement" },
            { playerId: target, color: "space", pulse: true },
          ],
          zones: [
            {
              kind: "open",
              shape: "circle",
              center: { playerId: target },
              radius: ctx.analysis.config.openSpaceThreshold,
            },
          ],
          arrows: [{ from: { playerId: actor, t: start }, to: { playerId: target, t: end }, kind: "pass" }],
          labels: [
            {
              anchor: { playerId: target },
              offset: { x: -14, y: 6 },
              color: "space",
              evidenceId: evidenceId(e.id, "creation_lead"),
            },
          ],
        },
      }

    case "OPEN_THREE":
      return {
        title: { zh: ev.contested === "yes" ? "受干扰三分出手" : "三分出手", en: "Open Three" },
        summary: {
          zh: `${J(actor)} 在${ev.zone === "corner" ? "底角" : "弧顶"}出手（${fmt(ev.shot_distance)} m），最近防守者 ${fmt(ev.contest_distance)} m，接球到出手 ${fmt(ev.catch_to_release)} s。`,
          en: `${J(actor)} rises for a ${ev.zone === "corner" ? "corner" : "above-the-break"} three.`,
        },
        actors: [actor],
        overlay: {
          highlights: [{ playerId: actor, color: "space", pulse: true }],
          zones: [
            {
              kind: "open",
              shape: "circle",
              center: { playerId: actor, t: start },
              radius: ctx.analysis.config.openSpaceThreshold,
            },
          ],
          arrows: [{ from: { playerId: actor, t: start }, to: basketFor(ctx.analysis.config.attackingBasket), kind: "movement" }],
          labels: [
            {
              anchor: { playerId: actor },
              offset: { x: -9, y: 5 },
              color: "space",
              text: ev.contested === "yes" ? "CONTESTED 3PT" : "OPEN 3PT",
            },
          ],
        },
      }
  }
}
