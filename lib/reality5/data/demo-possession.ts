import type { Possession } from "../types"

/**
 * Demo possession: drive → help → collapse → open corner → kick-out → open three.
 * Clip starts at broadcast clock 07:38.0 and runs 10 seconds.
 * Event t values are clip-relative seconds (07:40.1 → t = 2.1).
 */

const T = {
  drive: 2.1,
  help: 2.8,
  collapse: 3.0,
  open: 3.1,
  pass: 3.3,
  shot: 3.5,
  release: 3.7,
  splash: 4.7,
} as const

export const demoPossession: Possession = {
  id: "demo-q2-0738",
  game: {
    home: "LAC",
    away: "DEN",
    label: "DEMO GAME",
    quarter: "Q2",
  },
  video: {
    src: null,
    poster: "/video/court-poster.png",
    clipStart: 458,
    duration: 10,
    clockAtStart: "07:38.0",
  },
  players: [
    { id: "o1", team: "offense", number: 7, name: "持球人", role: "Ball Handler" },
    { id: "o2", team: "offense", number: 23, name: "底角射手", role: "Corner Shooter" },
    { id: "o3", team: "offense", number: 11, name: "左侧翼", role: "Wing" },
    { id: "o4", team: "offense", number: 34, name: "弱侧内线", role: "Dunker" },
    { id: "o5", team: "offense", number: 5, name: "顶弧", role: "Slot" },
    { id: "d1", team: "defense", number: 2, name: "对位防守", role: "On-Ball" },
    { id: "d2", team: "defense", number: 15, name: "弱侧协防", role: "Weak-side" },
    { id: "d3", team: "defense", number: 8, name: "侧翼防守", role: "Wing" },
    { id: "d4", team: "defense", number: 40, name: "低位防守", role: "Low" },
    { id: "d5", team: "defense", number: 31, name: "护框", role: "Rim Protector" },
  ],
  tracks: [
    {
      playerId: "o1",
      keyframes: [
        { t: 0, pos: { x: 25, y: 33 } },
        { t: 1.4, pos: { x: 25, y: 31 } },
        { t: T.drive, pos: { x: 24, y: 29 } },
        { t: 2.6, pos: { x: 22.5, y: 22 } },
        { t: T.collapse, pos: { x: 21, y: 16 } },
        { t: T.pass, pos: { x: 20, y: 13 } },
        { t: 4.0, pos: { x: 19, y: 12 } },
        { t: 10, pos: { x: 19.5, y: 12.5 } },
      ],
    },
    {
      playerId: "o2",
      keyframes: [
        { t: 0, pos: { x: 47.5, y: 3 } },
        { t: 10, pos: { x: 47.5, y: 3 } },
      ],
    },
    {
      playerId: "o3",
      keyframes: [
        { t: 0, pos: { x: 7, y: 24 } },
        { t: T.drive, pos: { x: 7, y: 24 } },
        { t: T.pass, pos: { x: 6, y: 26.5 } },
        { t: 10, pos: { x: 6, y: 26.5 } },
      ],
    },
    {
      playerId: "o4",
      keyframes: [
        { t: 0, pos: { x: 11, y: 6 } },
        { t: 10, pos: { x: 11, y: 6 } },
      ],
    },
    {
      playerId: "o5",
      keyframes: [
        { t: 0, pos: { x: 38, y: 28 } },
        { t: T.drive, pos: { x: 38, y: 28 } },
        { t: T.collapse, pos: { x: 40, y: 26 } },
        { t: 10, pos: { x: 40, y: 26 } },
      ],
    },
    {
      playerId: "d1",
      keyframes: [
        { t: 0, pos: { x: 25, y: 29.5 } },
        { t: T.drive, pos: { x: 24, y: 27 } },
        { t: 2.6, pos: { x: 23, y: 20.5 } },
        { t: T.collapse, pos: { x: 22.5, y: 14.5 } },
        { t: T.pass, pos: { x: 21.5, y: 12 } },
        { t: 10, pos: { x: 21, y: 11.5 } },
      ],
    },
    {
      playerId: "d2",
      keyframes: [
        { t: 0, pos: { x: 43.5, y: 7.5 } },
        { t: T.drive, pos: { x: 43.5, y: 7.5 } },
        { t: T.help, pos: { x: 42.5, y: 8 } },
        { t: T.collapse, pos: { x: 38.3, y: 9.3 } },
        { t: T.open, pos: { x: 38.3, y: 9.3 } },
        { t: T.shot, pos: { x: 41, y: 7 } },
        { t: 4.5, pos: { x: 45.5, y: 4.5 } },
        { t: 10, pos: { x: 45.5, y: 4.5 } },
      ],
    },
    {
      playerId: "d3",
      keyframes: [
        { t: 0, pos: { x: 10, y: 22 } },
        { t: T.pass, pos: { x: 9.5, y: 24 } },
        { t: 10, pos: { x: 9.5, y: 24 } },
      ],
    },
    {
      playerId: "d4",
      keyframes: [
        { t: 0, pos: { x: 14, y: 8 } },
        { t: T.collapse, pos: { x: 15.5, y: 9 } },
        { t: 10, pos: { x: 15.5, y: 9 } },
      ],
    },
    {
      playerId: "d5",
      keyframes: [
        { t: 0, pos: { x: 35, y: 24 } },
        { t: T.drive, pos: { x: 34, y: 22 } },
        { t: T.collapse, pos: { x: 28, y: 13 } },
        { t: 10, pos: { x: 27.5, y: 12 } },
      ],
    },
  ],
  ball: {
    possession: [
      { from: 0, to: T.pass, playerId: "o1" },
      { from: T.shot, to: T.release, playerId: "o2" },
    ],
    keyframes: [
      { t: T.pass, pos: { x: 20, y: 13 }, z: 4 },
      { t: T.shot, pos: { x: 47.5, y: 3 }, z: 4 },
      { t: T.release, pos: { x: 47.5, y: 3 }, z: 8 },
      { t: 4.2, pos: { x: 36, y: 4 }, z: 16 },
      { t: T.splash, pos: { x: 25, y: 5.25 }, z: 10 },
      { t: 5.0, pos: { x: 25, y: 5.25 }, z: 0 },
      { t: 10, pos: { x: 25, y: 5.25 }, z: 0 },
    ],
  },
  evidence: [
    {
      id: "ev-drive-speed",
      label: { zh: "突破速度", en: "Drive Speed" },
      value: 4.8,
      unit: "m/s",
      precision: 1,
      sourceEventId: "e1",
      description: {
        zh: "持球人突破启动后 0.5 秒内的峰值水平速度。",
        en: "Peak horizontal speed of the ball handler within 0.5s of the drive start.",
      },
    },
    {
      id: "ev-gravity",
      label: { zh: "进攻引力", en: "Gravity" },
      value: 0.72,
      unit: "",
      precision: 2,
      sourceEventId: "e1",
      description: {
        zh: "突破对防守位移的吸引指数（0–1），衡量有多少防守注意力被持球人牵引。",
        en: "Index (0–1) of how much defensive displacement the drive attracts.",
      },
    },
    {
      id: "ev-defender-shift",
      label: { zh: "防守位移", en: "Defender Shift" },
      value: 1.7,
      unit: "m",
      precision: 1,
      sourceEventId: "e3",
      description: {
        zh: "弱侧防守者 #15 从对位点向禁区移动的距离。",
        en: "Distance weak-side defender #15 moved from his assignment toward the paint.",
      },
    },
    {
      id: "ev-open-distance",
      label: { zh: "空位距离", en: "Open Distance" },
      value: 3.4,
      unit: "m",
      precision: 1,
      sourceEventId: "e4",
      description: {
        zh: "底角射手与最近防守者之间的距离。",
        en: "Distance between the corner shooter and his nearest defender.",
      },
    },
    {
      id: "ev-creation-lead",
      label: { zh: "创造领先", en: "Creation Lead" },
      value: 1.2,
      unit: "s",
      precision: 1,
      sourceEventId: "e4",
      description: {
        zh: "空位形成到传球到位之间的时间差，说明空位不是传球造成的，而是突破造成的。",
        en: "Time between the space forming and the pass arriving. The drive, not the pass, created the shot.",
      },
    },
  ],
  events: [
    {
      id: "e1",
      index: 1,
      type: "DRIVE",
      clock: "07:40.1",
      t: T.drive,
      title: { zh: "突破启动", en: "Drive" },
      summary: {
        zh: "持球人 #7 从弧顶启动突破，向左侧肘区切入。",
        en: "Ball handler begins penetration from the top of the key.",
      },
      actors: ["o1", "d1"],
      evidenceIds: ["ev-drive-speed", "ev-gravity"],
      overlay: {
        highlights: [{ playerId: "o1", color: "movement", pulse: true }],
        paths: [{ playerId: "o1", from: T.drive, to: T.pass, color: "movement" }],
        zones: [
          {
            kind: "defensive",
            shape: "circle",
            center: { playerId: "o1" },
            radius: 9,
          },
        ],
        labels: [
          {
            anchor: { playerId: "o1" },
            offset: { x: 3, y: -3.5 },
            color: "movement",
            evidenceId: "ev-drive-speed",
          },
          {
            anchor: { playerId: "o1" },
            offset: { x: 3, y: 1.5 },
            color: "movement",
            evidenceId: "ev-gravity",
          },
        ],
      },
    },
    {
      id: "e2",
      index: 2,
      type: "HELP_DEFENSE",
      clock: "07:40.8",
      t: T.help,
      title: { zh: "协防发生", en: "Help Defense" },
      summary: {
        zh: "弱侧防守者 #15 离开底角射手，向禁区移动。",
        en: "Weak-side defender moves toward the paint.",
      },
      actors: ["d2", "o2"],
      evidenceIds: ["ev-gravity"],
      overlay: {
        highlights: [
          { playerId: "d2", color: "tactical", pulse: true },
          { playerId: "o1", color: "movement" },
        ],
        paths: [{ playerId: "o1", from: T.drive, to: T.pass, color: "movement" }],
        arrows: [
          {
            from: { playerId: "d2", t: T.drive },
            to: { playerId: "d2", t: T.collapse },
            kind: "defense",
          },
        ],
        labels: [
          {
            anchor: { playerId: "d2" },
            offset: { x: -2, y: 4 },
            color: "tactical",
            text: "HELP",
          },
        ],
      },
    },
    {
      id: "e3",
      index: 3,
      type: "DEFENSIVE_COLLAPSE",
      clock: "07:41.0",
      t: T.collapse,
      title: { zh: "防守收缩 1.7m", en: "Defensive Collapse" },
      summary: {
        zh: "三名防守者向禁区收缩，弱侧防守者位移 1.7 m。",
        en: "Three defenders collapse toward the paint; weak-side shift 1.7 m.",
      },
      actors: ["d1", "d2", "d5"],
      evidenceIds: ["ev-defender-shift"],
      overlay: {
        highlights: [
          { playerId: "d2", color: "tactical", pulse: true },
          { playerId: "d5", color: "tactical" },
          { playerId: "d1", color: "tactical" },
        ],
        zones: [
          {
            kind: "defensive",
            shape: "polygon",
            points: [
              { playerId: "d1" },
              { playerId: "d5" },
              { playerId: "d2" },
              { playerId: "d4" },
            ],
          },
        ],
        arrows: [
          {
            from: { playerId: "d2", t: T.drive },
            to: { playerId: "d2", t: T.collapse },
            kind: "defense",
          },
          {
            from: { playerId: "d5", t: T.drive },
            to: { playerId: "d5", t: T.collapse },
            kind: "defense",
          },
        ],
        measures: [
          {
            from: { playerId: "d2", t: T.drive },
            to: { playerId: "d2", t: T.collapse },
            evidenceId: "ev-defender-shift",
            color: "tactical",
          },
        ],
      },
    },
    {
      id: "e4",
      index: 4,
      type: "OPEN_SPACE",
      clock: "07:41.1",
      t: T.open,
      title: { zh: "底角空位 3.4m", en: "Open Space" },
      summary: {
        zh: "底角射手 #23 与最近防守者距离扩大至 3.4 m，空位形成。",
        en: "Corner shooter becomes open; nearest defender 3.4 m away.",
      },
      actors: ["o2", "d2"],
      evidenceIds: ["ev-open-distance", "ev-creation-lead"],
      overlay: {
        highlights: [
          { playerId: "o2", color: "space", pulse: true },
          { playerId: "d2", color: "tactical" },
        ],
        zones: [
          {
            kind: "open",
            shape: "circle",
            center: { playerId: "o2" },
            radius: 10,
          },
        ],
        measures: [
          {
            from: { playerId: "o2" },
            to: { playerId: "d2" },
            evidenceId: "ev-open-distance",
            color: "space",
          },
        ],
        labels: [
          {
            anchor: { playerId: "o2" },
            offset: { x: -4, y: 12 },
            color: "space",
            evidenceId: "ev-creation-lead",
          },
        ],
      },
    },
    {
      id: "e5",
      index: 5,
      type: "PASS",
      clock: "07:41.3",
      t: T.pass,
      title: { zh: "分球", en: "Pass" },
      summary: {
        zh: "持球人 #7 击地分球至右侧底角。",
        en: "Ball handler kicks out to the corner.",
      },
      actors: ["o1", "o2"],
      evidenceIds: ["ev-creation-lead"],
      overlay: {
        highlights: [
          { playerId: "o1", color: "movement" },
          { playerId: "o2", color: "space", pulse: true },
        ],
        zones: [
          {
            kind: "open",
            shape: "circle",
            center: { playerId: "o2" },
            radius: 10,
          },
        ],
        arrows: [
          {
            from: { playerId: "o1", t: T.pass },
            to: { playerId: "o2", t: T.shot },
            kind: "pass",
          },
        ],
        labels: [
          {
            anchor: { x: 34, y: 8 },
            offset: { x: 0, y: -2 },
            color: "movement",
            text: "KICK-OUT",
          },
        ],
      },
    },
    {
      id: "e6",
      index: 6,
      type: "OPEN_THREE",
      clock: "07:41.5",
      t: T.shot,
      title: { zh: "三分出手", en: "Open Three" },
      summary: {
        zh: "底角射手 #23 接球即投，无干扰三分出手。",
        en: "Corner shooter rises for an uncontested three.",
      },
      actors: ["o2"],
      evidenceIds: ["ev-open-distance", "ev-creation-lead"],
      overlay: {
        highlights: [{ playerId: "o2", color: "space", pulse: true }],
        zones: [
          {
            kind: "open",
            shape: "circle",
            center: { playerId: "o2", t: T.shot },
            radius: 10,
          },
        ],
        arrows: [
          {
            from: { playerId: "o2", t: T.shot },
            to: { x: 25, y: 5.25 },
            kind: "movement",
          },
        ],
        labels: [
          {
            anchor: { playerId: "o2" },
            offset: { x: -9, y: 5 },
            color: "space",
            text: "OPEN 3PT",
          },
        ],
      },
    },
  ],
  playGraph: {
    nodeIds: ["e1", "e2", "e3", "e4", "e5", "e6"],
    edges: [
      { from: "e1", to: "e2", relation: "causes" },
      { from: "e2", to: "e3", relation: "leads_to" },
      { from: "e3", to: "e4", relation: "causes" },
      { from: "e4", to: "e5", relation: "enables" },
      { from: "e5", to: "e6", relation: "leads_to" },
    ],
  },
  commentary: [
    {
      audience: "public",
      label: { zh: "大众版", en: "Fan" },
      segments: [
        { kind: "event", eventId: "e1", value: "突破" },
        { kind: "text", value: "吸引" },
        { kind: "event", eventId: "e2", value: "协防" },
        { kind: "text", value: "，为底角创造了" },
        { kind: "event", eventId: "e4", value: "空位" },
        { kind: "text", value: "，随后完成" },
        { kind: "event", eventId: "e5", value: "分球" },
        { kind: "text", value: "和" },
        { kind: "event", eventId: "e6", value: "三分出手" },
        { kind: "text", value: "。" },
      ],
    },
    {
      audience: "pro",
      label: { zh: "专业版", en: "Analyst" },
      segments: [
        { kind: "text", value: "持球人" },
        { kind: "event", eventId: "e1", value: "突破" },
        { kind: "text", value: "后，弱侧防守者向禁区移动 " },
        { kind: "evidence", evidenceId: "ev-defender-shift", value: "1.7 米" },
        { kind: "text", value: "，使底角射手与最近防守者距离扩大到 " },
        { kind: "evidence", evidenceId: "ev-open-distance", value: "3.4 米" },
        { kind: "text", value: "。这个空位在传球到达之前约 " },
        { kind: "evidence", evidenceId: "ev-creation-lead", value: "1.2 秒" },
        { kind: "text", value: " 已经形成。" },
      ],
    },
    {
      audience: "coach",
      label: { zh: "教练版", en: "Coach" },
      segments: [
        { kind: "text", value: "弱侧防守者 #15 面对的是一个结构性取舍：持球人的" },
        { kind: "event", eventId: "e1", value: "突破" },
        { kind: "text", value: "引力达到 " },
        { kind: "evidence", evidenceId: "ev-gravity", value: "0.72" },
        { kind: "text", value: "，速度 " },
        { kind: "evidence", evidenceId: "ev-drive-speed", value: "4.8 m/s" },
        {
          kind: "text",
          value: "——不协防，禁区将被直接攻击；协防，就必须离开底角射手。他选择护框，向禁区位移 ",
        },
        { kind: "evidence", evidenceId: "ev-defender-shift", value: "1.7 m" },
        { kind: "text", value: "，代价是把底角让出 " },
        { kind: "evidence", evidenceId: "ev-open-distance", value: "3.4 m" },
        { kind: "text", value: " 的出手空间。空位比传球早 " },
        { kind: "evidence", evidenceId: "ev-creation-lead", value: "1.2 s" },
        {
          kind: "text",
          value:
            " 形成，说明进攻方是有意识地兑现这一取舍，而非偶然。修正方案：由 #31 提前沉退护框并执行 X-out 轮转，让 #15 保持贴防底角，把取舍从「护框 vs 底角」转移为「沉退 vs 顶弧」。",
        },
      ],
    },
  ],
}
