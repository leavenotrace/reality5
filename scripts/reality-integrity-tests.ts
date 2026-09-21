/**
 * REALITY5 V0.3.1 success tests (spec §15).
 * Run: npx tsx scripts/reality-integrity-tests.ts
 */
import sample01 from "../data/sample-possession-01.json"
import { adaptTracking } from "../lib/adapters"
import { detectOpenSpace } from "../lib/detectors/open-space"
import { dedupeEvents } from "../lib/detectors/dedupe"
import { analyzePossession } from "../lib/reality/analyze"
import { DEFAULT_DETECTOR_CONFIG } from "../lib/reality/config"
import { validateRealityIntegrity } from "../lib/reality/integrity"
import type { CourtState } from "../lib/reality/types"

let failures = 0
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`)
  if (!ok) failures++
}

/** Minimal 5v5 frame with one movable offensive player P15 and its defender D4. */
function frame(t: number, p15: { x: number; y: number }, d4: { x: number; y: number }): CourtState {
  const players = [
    { id: "P23", team: "offense", x: 20, y: 7.6 },
    { id: "P15", team: "offense", ...p15 },
    { id: "P7", team: "offense", x: 21, y: 3 },
    { id: "P34", team: "offense", x: 25, y: 10 },
    { id: "P5", team: "offense", x: 19.5, y: 8 },
    { id: "D1", team: "defense", x: 21, y: 7.6 },
    { id: "D2", team: "defense", x: 25.5, y: 9.5 },
    { id: "D3", team: "defense", x: 22, y: 3.5 },
    { id: "D4", team: "defense", ...d4 },
    { id: "D5", team: "defense", x: 25, y: 7.6 },
  ].map((p) => ({ ...p, team: p.team as "offense" | "defense", vx: 0, vy: 0, speed: 0 }))
  return { timestamp: t, gameClock: "07:40.0", players, ball: { x: 20, y: 7.6, z: 1, possessor: "P23" } }
}

// TEST A — player at (20, 10) → VALID
{
  const states = [frame(0, { x: 20, y: 10 }, { x: 21, y: 11 }), frame(0.1, { x: 20, y: 10 }, { x: 21, y: 11 })]
  const r = validateRealityIntegrity(states)
  check("A  player at x=20,y=10 → VALID", r.status === "VALID", r.status)
}

// TEST B — player at (29.2, 10) → INVALID, OUTSIDE COURT
{
  const states = [frame(0, { x: 29.2, y: 10 }, { x: 21, y: 11 }), frame(0.1, { x: 29.2, y: 10 }, { x: 21, y: 11 })]
  const r = validateRealityIntegrity(states)
  const v = r.violations.find((x) => x.code === "OUT_OF_BOUNDS")
  check(
    "B  player at x=29.2 → INVALID OUT_OF_BOUNDS",
    r.status === "INVALID" && r.courtBounds === "fail" && v?.subject === "P15",
    `${r.status} ${v?.observed} / ${v?.allowed}`,
  )
}

// TEST C — 5 m in 0.1 s → PHYSICAL MOVEMENT invalid (teleport)
{
  const states = [frame(0, { x: 20, y: 10 }, { x: 21, y: 11 }), frame(0.1, { x: 25, y: 10 }, { x: 21, y: 11 })]
  const r = validateRealityIntegrity(states)
  check(
    "C  5 m in 0.1 s → physical movement fail",
    r.physicalMovement === "fail" && r.status === "INVALID" && r.violations.some((v) => v.code === "TELEPORT"),
    `${r.status} ${r.violations.map((v) => v.code).join(",")}`,
  )
}

// TEST D — distance series 2.8 3.05 3.2 3.4 3.3 3.1 2.9 2.6 → ONE event, peak 3.4
{
  const series = [2.8, 3.05, 3.2, 3.4, 3.3, 3.1, 2.9, 2.6]
  const states = series.map((d, i) => frame(i * 0.1, { x: 20, y: 13 }, { x: 20, y: 13 - d }))
  const events = dedupeEvents(detectOpenSpace(states, DEFAULT_DETECTOR_CONFIG), DEFAULT_DETECTOR_CONFIG)
  const ev = events[0]
  check(
    "D  one OPEN_SPACE, start at crossing, peak 3.4, end after exit",
    events.length === 1 &&
      Math.abs(ev.timestamp - 0.1) < 1e-9 &&
      ev.evidence.peak_open_distance === 3.4 &&
      Math.abs((ev.endTimestamp ?? 0) - 0.7) < 1e-9 &&
      ev.duration === 0.6,
    `${events.length} event(s); start=${ev?.timestamp} peak=${ev?.evidence.peak_open_distance} end=${ev?.endTimestamp} dur=${ev?.duration}`,
  )
}

// TEST E — always below threshold → NO event
{
  const states = [2.5, 2.8, 2.9, 2.95, 2.7, 2.4].map((d, i) => frame(i * 0.1, { x: 20, y: 13 }, { x: 20, y: 13 - d }))
  const events = detectOpenSpace(states, DEFAULT_DETECTOR_CONFIG)
  check("E  never reaches 3.0 → no OPEN_SPACE", events.length === 0, `${events.length} event(s)`)
}

// Hysteresis — jitter around the enter threshold stays ONE event
{
  const series = [2.8, 3.05, 2.95, 3.1, 2.9, 3.2, 2.85, 3.0, 2.5]
  const states = series.map((d, i) => frame(i * 0.1, { x: 20, y: 13 }, { x: 20, y: 13 - d }))
  const events = detectOpenSpace(states, DEFAULT_DETECTOR_CONFIG)
  check("H  jitter across 3.0 but above 2.7 → one event", events.length === 1, `${events.length} event(s)`)
}

// Sample data still analyses under the full-court contract
{
  const adapted = adaptTracking(sample01)
  check("S  sample-01 adapter ok", adapted.ok, adapted.ok ? adapted.tracking.integrity.status : adapted.errors[0]?.message.en)
  if (adapted.ok) {
    const a = analyzePossession(adapted.tracking.states, { roster: adapted.tracking.roster, integrity: adapted.tracking.integrity })
    const types = a.events.map((e) => `${e.type}${e.actor ? `(${e.actor})` : ""}`)
    console.log("    events:", types.join(" "))
    const open = a.events.filter((e) => e.type === "OPEN_SPACE" && e.actor === "P15")
    check("S  attacking basket inferred right", a.config.attackingBasket === "right", a.config.attackingBasket)
    check("S  DRIVE detected", a.events.some((e) => e.type === "DRIVE"))
    check("S  HELP_DEFENSE detected with duration", a.events.some((e) => e.type === "HELP_DEFENSE" && (e.duration ?? 0) > 0))
    check("S  P15 OPEN_SPACE exactly once", open.length === 1, `${open.length} — dur ${open[0]?.duration}s peak ${open[0]?.evidence.peak_open_distance}m`)
    check("S  OPEN_THREE detected", a.events.some((e) => e.type === "OPEN_THREE"))
  }
}

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED")
process.exit(failures ? 1 : 0)
