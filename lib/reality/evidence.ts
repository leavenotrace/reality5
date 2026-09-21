import type { BasketballEvent, Evidence, EventType, Localized } from "./types"

interface EvidenceSpec {
  key: string
  label: Localized
  unit: string
  precision: number
  description: Localized
}

/**
 * Which evidence keys are promoted to first-class Evidence items the UI can
 * hover, measure, and cite. Everything else stays in the raw event record.
 */
const PROMOTED: Partial<Record<EventType, EvidenceSpec[]>> = {
  DRIVE: [
    {
      key: "speed",
      label: { zh: "突破速度", en: "Drive Speed" },
      unit: "m/s",
      precision: 1,
      description: {
        zh: "持球人在突破窗口内的峰值水平速度，由相邻帧位置差分计算。",
        en: "Peak horizontal speed of the ball handler in the drive window, from frame-to-frame displacement.",
      },
    },
    {
      key: "distance_to_basket_change",
      label: { zh: "篮下距离变化", en: "Basket Approach" },
      unit: "m",
      precision: 1,
      description: {
        zh: "突破起止之间持球人到篮筐距离的变化量。",
        en: "Change in the handler's distance to the rim between drive onset and end.",
      },
    },
  ],
  HELP_DEFENSE: [
    {
      key: "defender_shift",
      label: { zh: "防守位移", en: "Defender Shift" },
      unit: "m",
      precision: 1,
      description: {
        zh: "协防者从原对位点向禁区/持球人移动的距离。",
        en: "Distance the help defender moved from his assignment toward the paint / ball handler.",
      },
    },
    {
      key: "peak_shift",
      label: { zh: "峰值位移", en: "Peak Shift" },
      unit: "m",
      precision: 1,
      description: {
        zh: "协防窗口内协防者距离起始点的最大位移。",
        en: "Largest displacement from the starting spot during the help window.",
      },
    },
    {
      key: "duration",
      label: { zh: "协防时长", en: "Help Duration" },
      unit: "s",
      precision: 1,
      description: {
        zh: "协防状态从开始到结束的持续时间。",
        en: "Time from help onset to the defender settling.",
      },
    },
    {
      key: "reaction_time",
      label: { zh: "反应时间", en: "Reaction Time" },
      unit: "s",
      precision: 1,
      description: {
        zh: "突破启动到协防者开始移动之间的时间。",
        en: "Time between the drive onset and the help defender's first movement.",
      },
    },
  ],
  DEFENSIVE_COLLAPSE: [
    {
      key: "defenders_collapsing",
      label: { zh: "收缩人数", en: "Collapsing Defenders" },
      unit: "",
      precision: 0,
      description: {
        zh: "突破窗口内向篮筐方向明显移动的防守者数量。",
        en: "Number of defenders whose distance to the rim shrank meaningfully during the drive.",
      },
    },
  ],
  OPEN_SPACE: [
    {
      key: "peak_open_distance",
      label: { zh: "空位距离", en: "Open Distance" },
      unit: "m",
      precision: 1,
      description: {
        zh: "该球员与最近防守者之间的最大距离（空位窗口内）。",
        en: "Largest distance between the player and his nearest defender while open.",
      },
    },
    {
      key: "duration",
      label: { zh: "空位时长", en: "Open Duration" },
      unit: "s",
      precision: 1,
      description: {
        zh: "从越过进入阈值到跌破退出阈值之间的持续时间（带滞回）。",
        en: "Time between crossing the enter threshold and dropping below the exit threshold (hysteresis).",
      },
    },
    {
      key: "threshold",
      label: { zh: "空位阈值", en: "Open Threshold" },
      unit: "m",
      precision: 1,
      description: {
        zh: "判定空位的最近防守者距离阈值（可配置）。",
        en: "Configurable nearest-defender distance above which a player is considered open.",
      },
    },
  ],
  PASS: [
    {
      key: "creation_lead",
      label: { zh: "创造领先", en: "Creation Lead" },
      unit: "s",
      precision: 1,
      description: {
        zh: "空位形成到传球到位之间的时间差：空位不是传球造成的，而是突破造成的。",
        en: "Time between the space forming and the pass arriving. The drive, not the pass, created the shot.",
      },
    },
    {
      key: "pass_distance",
      label: { zh: "传球距离", en: "Pass Distance" },
      unit: "m",
      precision: 1,
      description: {
        zh: "出球点到接球点的直线距离。",
        en: "Straight-line distance from release to catch.",
      },
    },
  ],
  OPEN_THREE: [
    {
      key: "contest_distance",
      label: { zh: "干扰距离", en: "Contest Distance" },
      unit: "m",
      precision: 1,
      description: {
        zh: "出手瞬间射手与最近防守者的距离。",
        en: "Distance from the shooter to the nearest defender at release.",
      },
    },
  ],
}

export function promoteEvidence(events: BasketballEvent[]): Evidence[] {
  const items: Evidence[] = []
  for (const event of events) {
    for (const spec of PROMOTED[event.type] ?? []) {
      const raw = event.evidence[spec.key]
      if (typeof raw !== "number") continue
      items.push({
        id: `${event.id}.${spec.key}`,
        key: spec.key,
        label: spec.label,
        value: raw,
        unit: spec.unit,
        precision: spec.precision,
        sourceEventId: event.id,
        description: spec.description,
      })
    }
  }
  return items
}

export function evidenceId(eventId: string, key: string) {
  return `${eventId}.${key}`
}
