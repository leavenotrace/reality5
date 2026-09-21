/**
 * Generates data/mock-tracking.json — ~10 s of simulated tracking data.
 *
 * The output contains ONLY physical state: positions (m), velocity (m/s),
 * ball position/height and ball possessor, sampled every 100 ms.
 * No basketball events are encoded here. Detectors discover them.
 *
 * Keyframes are AUTHORED in attacking-half coordinates for readability:
 * hx along the baseline (0..15.24), hy from baseline toward half court.
 * They are EMITTED in the NBA_METRIC full-court contract (lib/reality/court.ts):
 * x = 0..28.65 baseline→baseline, y = 0..15.24 sideline→sideline, offense
 * attacking the RIGHT basket at (27.075, 7.62). Mapping: x = 28.65 - hy, y = hx.
 *
 * Run: node scripts/generate-mock-tracking.mjs            → data/sample-possession-01.json
 *      node scripts/generate-mock-tracking.mjs --scenario reality-test-no-help
 *                                                        → data/sample-possession-02.json
 *
 * Scenarios change ONLY physical coordinates. Nothing downstream is authored.
 */
import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const DT = 0.1
const DURATION = 10
const CLOCK_AT_START = "07:38.0"

const scenarioArg = process.argv.indexOf("--scenario")
const SCENARIO = scenarioArg >= 0 ? process.argv[scenarioArg + 1] : "original"

const SCENARIOS = {
  original: {
    file: "sample-possession-01.json",
    possessionId: "sample_possession_01",
    // P23 kicks to the corner; P15 catches and shoots
    possession: [
      { from: 0, to: 3.3, playerId: "P23" },
      { from: 3.75, to: 4.05, playerId: "P15" },
    ],
    ballFree: [
      [3.3, 5.9, 3.8, 1.5],
      [3.75, 14.6, 1.0, 1.4],
      [4.05, 14.5, 1.1, 2.3],
      [4.5, 11.0, 1.4, 5.0],
      [5.0, 7.62, 1.575, 3.05],
      [5.4, 7.62, 1.575, 0.0],
      [10, 7.62, 1.575, 0.0],
    ],
    // D4 helps: ~1.7 m toward the paint
    d4Keys: [
      [0, 13.2, 1.5],
      [2.15, 13.2, 1.5],
      [2.65, 11.5, 2.1],
      [3.0, 11.4, 2.12],
      [3.75, 11.4, 2.12],
      [4.1, 12.2, 1.8],
      [4.7, 13.6, 1.3],
      [10, 13.6, 1.3],
    ],
  },
  "reality-test-no-help": {
    file: "sample-possession-02.json",
    possessionId: "sample_possession_02",
    // Corner stays covered, so P23 kicks to the wing (P7) who holds the ball
    possession: [
      { from: 0, to: 3.3, playerId: "P23" },
      { from: 3.9, to: 10.01, playerId: "P7" },
    ],
    ballFree: [
      [3.3, 5.9, 3.8, 1.5],
      [3.9, 1.9, 8.0, 1.4],
    ],
    // D4 only stunts: ~0.3 m toward the paint, then stays home on P15
    d4Keys: [
      [0, 13.2, 1.5],
      [2.15, 13.2, 1.5],
      [2.65, 12.92, 1.6],
      [3.0, 12.9, 1.6],
      [3.75, 12.9, 1.6],
      [4.1, 13.2, 1.5],
      [4.7, 13.6, 1.3],
      [10, 13.6, 1.3],
    ],
  },
}

const scenario = SCENARIOS[SCENARIO]
if (!scenario) {
  console.error(`unknown scenario "${SCENARIO}" (${Object.keys(SCENARIOS).join(", ")})`)
  process.exit(1)
}

// Piecewise-linear keyframes: constant speed within each segment so the
// derived velocity is easy to reason about and edit.
const PLAYERS = [
  {
    id: "P23",
    team: "offense",
    keys: [
      [0, 7.6, 10.0],
      [1.2, 7.5, 9.4],
      [2.0, 7.5, 9.0],
      [3.05, 6.1, 4.2], // drive: 5.0 m in 1.05 s ≈ 4.8 m/s
      [3.35, 5.9, 3.8],
      [10, 5.8, 3.7],
    ],
  },
  {
    id: "P15",
    team: "offense",
    keys: [
      [0, 14.6, 1.0],
      [3.75, 14.6, 1.0],
      [3.95, 14.5, 1.1],
      [10, 14.5, 1.1],
    ],
  },
  {
    id: "P7",
    team: "offense",
    keys: [
      [0, 2.1, 7.3],
      [2.0, 2.1, 7.3],
      [3.3, 1.9, 8.0],
      [10, 1.9, 8.0],
    ],
  },
  {
    id: "P34",
    team: "offense",
    keys: [
      [0, 3.4, 1.8],
      [10, 3.4, 1.8],
    ],
  },
  {
    id: "P5",
    team: "offense",
    keys: [
      [0, 11.8, 8.4],
      [2.0, 11.8, 8.4],
      [3.0, 12.1, 7.8],
      [10, 12.1, 7.8],
    ],
  },
  {
    id: "D1",
    team: "defense",
    keys: [
      [0, 7.6, 9.0],
      [2.0, 7.4, 8.2],
      [3.05, 6.6, 4.6],
      [3.35, 6.5, 3.9],
      [10, 6.5, 3.9],
    ],
  },
  {
    id: "D2",
    team: "defense",
    keys: [
      [0, 4.3, 2.4],
      [10, 4.3, 2.4],
    ],
  },
  {
    id: "D3",
    team: "defense",
    keys: [
      [0, 2.9, 6.6],
      [2.0, 2.9, 6.6],
      [3.3, 2.7, 7.3],
      [10, 2.7, 7.3],
    ],
  },
  {
    id: "D4",
    team: "defense",
    keys: scenario.d4Keys,
  },
  {
    id: "D5",
    team: "defense",
    keys: [
      [0, 10.4, 7.0],
      [2.1, 10.4, 7.0],
      [3.0, 9.9, 6.2],
      [10, 9.9, 6.2],
    ],
  },
]

const POSSESSION = scenario.possession

// Ball keyframes while NOT in a player's hands: [t, x, y, z]
const BALL_FREE = scenario.ballFree

function lerpKeys(keys, t) {
  if (t <= keys[0][0]) return keys[0].slice(1)
  const last = keys[keys.length - 1]
  if (t >= last[0]) return last.slice(1)
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]
    const b = keys[i + 1]
    if (t >= a[0] && t <= b[0]) {
      const u = (t - a[0]) / (b[0] - a[0] || 1)
      return a.slice(1).map((v, k) => v + (b[k + 1] - v) * u)
    }
  }
  return last.slice(1)
}

function possessorAt(t) {
  const p = POSSESSION.find((s) => t >= s.from && t < s.to)
  return p ? p.playerId : null
}

function formatClock(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds - m * 60
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`
}

function parseClock(label) {
  const [m, s] = label.split(":")
  return Number(m) * 60 + Number(s)
}

const r = (v) => Math.round(v * 1000) / 1000

const frameCount = Math.round(DURATION / DT) + 1
const positions = Array.from({ length: frameCount }, (_, i) => {
  const t = r(i * DT)
  return PLAYERS.map((p) => {
    const [x, y] = lerpKeys(p.keys, t)
    return { id: p.id, team: p.team, x, y }
  })
})

// Frames carry PHYSICAL state only: positions and the ball. No velocity, no
// events. The Reality Engine derives everything else.
const COURT_LENGTH = 28.65
/** Authored half-court (hx, hy) → NBA_METRIC full court attacking the right basket. */
const toFullCourt = (hx, hy) => ({ x: r(COURT_LENGTH - hy), y: r(hx) })

const frames = positions.map((frame, i) => {
  const t = r(i * DT)
  const players = frame.map((p) => ({ id: p.id, team: p.team, ...toFullCourt(p.x, p.y) }))

  const holder = possessorAt(t)
  let ball
  if (holder) {
    const h = players.find((p) => p.id === holder)
    ball = { x: h.x, y: h.y, z: 1.0, possessor: holder }
  } else {
    const [hx, hy, z] = lerpKeys(BALL_FREE, t)
    ball = { ...toFullCourt(hx, hy), z: r(z) }
  }

  return {
    timestamp: t,
    gameClock: formatClock(parseClock(CLOCK_AT_START) + t),
    players,
    ball,
  }
})

const out = {
  metadata: {
    game_id: "demo_game",
    possession_id: scenario.possessionId,
    fps: Math.round(1 / DT),
    court_unit: "meters",
    coordinate_system: "NBA_METRIC",
    attacking_basket: "right",
    generator: "scripts/generate-mock-tracking.mjs",
    court: { length: COURT_LENGTH, width: 15.24, basket: { x: 27.075, y: 7.62 } },
  },
  roster: [
    { id: "P23", team: "offense", number: 23, name: "持球人", role: "Ball Handler" },
    { id: "P15", team: "offense", number: 15, name: "底角射手", role: "Corner Shooter" },
    { id: "P7", team: "offense", number: 7, name: "左侧翼", role: "Wing" },
    { id: "P34", team: "offense", number: 34, name: "弱侧内线", role: "Dunker" },
    { id: "P5", team: "offense", number: 5, name: "顶弧", role: "Slot" },
    { id: "D1", team: "defense", number: 1, name: "对位防守", role: "On-Ball" },
    { id: "D2", team: "defense", number: 2, name: "低位防守", role: "Low" },
    { id: "D3", team: "defense", number: 3, name: "侧翼防守", role: "Wing" },
    { id: "D4", team: "defense", number: 4, name: "弱侧防守", role: "Weak-side" },
    { id: "D5", team: "defense", number: 5, name: "护框", role: "Rim Protector" },
  ],
  frames,
}

const here = dirname(fileURLToPath(import.meta.url))
const target = join(here, "..", "data", scenario.file)
writeFileSync(target, JSON.stringify(out, null, 1))
console.log(`[${SCENARIO}] wrote ${frames.length} frames → ${target}`)
