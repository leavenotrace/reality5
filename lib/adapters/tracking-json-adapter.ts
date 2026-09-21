import { NBA_COURT } from "@/lib/reality/court"
import { validateRealityIntegrity } from "@/lib/reality/integrity"
import type { CourtState, PlayerState, RosterEntry, Team } from "@/lib/reality/types"
import type { AdapterResult, InputIssue, NormalizedTracking, TrackingInputAdapter } from "./types"

/**
 * Adapter for the Reality5 tracking JSON format:
 *
 * { metadata: { game_id, possession_id, fps, court_unit, coordinate_system?, attacking_basket? },
 *   roster?: [{ id, team, number?, name?, role? }],
 *   frames: [{ timestamp, gameClock?, ball: { x, y, z?, possessor? }, players: [{ id, team, x, y }] }] }
 *
 * Coordinates are NBA_METRIC (lib/reality/court.ts): meters, x 0..28.65,
 * y 0..15.24. After the schema parses, every frame goes through
 * validateRealityIntegrity — bounds, identity, time, physical movement.
 *
 * Frames must describe PHYSICAL state only. Any event-like fields are ignored
 * and reported as a warning — the engine never trusts labels from the source.
 */

const FORBIDDEN_KEYS = [
  "events",
  "drive",
  "help_defense",
  "helpDefense",
  "open_space",
  "openSpace",
  "pass",
  "open_three",
  "openThree",
  "playGraph",
  "play_graph",
  "causalGraph",
  "causal_graph",
  "causalStory",
  "commentary",
]

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

const issue = (code: string, zh: string, en: string, path?: string): InputIssue => ({
  code,
  message: { zh, en },
  path,
})

function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds - m * 60
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`
}

function normalizeTeam(v: unknown): Team | null {
  if (v === "offense" || v === "defense") return v
  if (v === "off" || v === "O") return "offense"
  if (v === "def" || v === "D") return "defense"
  return null
}

export const trackingJsonAdapter: TrackingInputAdapter = {
  id: "reality5-tracking-json",
  label: "Reality5 Tracking JSON",

  canHandle(raw) {
    return isRecord(raw) && Array.isArray(raw.frames)
  },

  parse(raw): AdapterResult {
    const errors: InputIssue[] = []
    const warnings: InputIssue[] = []

    if (!isRecord(raw)) {
      return {
        ok: false,
        errors: [issue("NOT_OBJECT", "根节点必须是对象", "Root must be a JSON object")],
        warnings,
      }
    }

    for (const key of Object.keys(raw)) {
      if (FORBIDDEN_KEYS.includes(key)) {
        warnings.push(
          issue(
            "LABELS_IGNORED",
            `源数据中的 "${key}" 已被忽略：事件必须由 Reality5 检测`,
            `Ignored "${key}" in source: events must be detected by Reality5`,
            key,
          ),
        )
      }
    }

    const metadata = isRecord(raw.metadata) ? raw.metadata : null
    if (!metadata) {
      errors.push(issue("NO_METADATA", "缺少 metadata", "Missing metadata"))
    }

    const frames = Array.isArray(raw.frames) ? raw.frames : null
    if (!frames) {
      errors.push(issue("NO_FRAMES", "缺少 frames 数组", "Missing frames array"))
    } else if (frames.length < 2) {
      errors.push(issue("TOO_FEW_FRAMES", "至少需要 2 帧", "At least 2 frames are required"))
    }

    if (metadata && metadata.court_unit !== undefined && metadata.court_unit !== "meters") {
      errors.push(
        issue(
          "UNIT_UNSUPPORTED",
          `坐标单位 "${String(metadata.court_unit)}" 不受支持（仅 meters）`,
          `Coordinate unit "${String(metadata.court_unit)}" is not supported (meters only)`,
          "metadata.court_unit",
        ),
      )
    }

    if (errors.length || !frames || !metadata) return { ok: false, errors, warnings }

    const states: CourtState[] = []
    const rosterMap = new Map<string, Team>()
    let missingClock = 0
    let missingPossessor = 0
    let ballFrames = 0

    frames.forEach((frame, i) => {
      const path = `frames[${i}]`
      if (!isRecord(frame)) {
        errors.push(issue("FRAME_NOT_OBJECT", "帧必须是对象", "Frame must be an object", path))
        return
      }
      if (!isNum(frame.timestamp)) {
        errors.push(issue("NO_TIMESTAMP", "缺少 timestamp", "Missing numeric timestamp", path))
        return
      }
      const players = Array.isArray(frame.players) ? frame.players : null
      if (!players) {
        errors.push(issue("NO_PLAYERS", "缺少 players", "Missing players array", path))
        return
      }

      const playerStates: PlayerState[] = []
      players.forEach((p, k) => {
        const ppath = `${path}.players[${k}]`
        if (!isRecord(p) || typeof p.id !== "string") {
          errors.push(issue("PLAYER_NO_ID", "球员缺少 id", "Player is missing id", ppath))
          return
        }
        const team = normalizeTeam(p.team) ?? rosterMap.get(p.id) ?? null
        if (!team) {
          errors.push(
            issue("PLAYER_NO_TEAM", `${p.id} 缺少 team`, `${p.id} is missing team`, ppath),
          )
          return
        }
        if (!isNum(p.x) || !isNum(p.y)) {
          errors.push(
            issue("PLAYER_NO_XY", `${p.id} 缺少 x/y 坐标`, `${p.id} is missing x/y`, ppath),
          )
          return
        }
        rosterMap.set(p.id, team)
        playerStates.push({ id: p.id, team, x: p.x, y: p.y, vx: 0, vy: 0, speed: 0 })
      })

      const ball = isRecord(frame.ball) ? frame.ball : null
      if (!ball || !isNum(ball.x) || !isNum(ball.y)) {
        errors.push(issue("NO_BALL", "缺少球的位置", "Missing ball position", `${path}.ball`))
        return
      }
      ballFrames++
      const possessor = typeof ball.possessor === "string" ? ball.possessor : undefined
      if (!possessor) missingPossessor++

      let gameClock: string
      if (typeof frame.gameClock === "string" && /^\d{1,2}:\d{2}(\.\d)?$/.test(frame.gameClock)) {
        gameClock = frame.gameClock
      } else {
        missingClock++
        gameClock = formatClock(frame.timestamp)
      }

      states.push({
        timestamp: frame.timestamp,
        gameClock,
        players: playerStates,
        ball: { x: ball.x, y: ball.y, z: isNum(ball.z) ? ball.z : undefined, possessor },
      })
    })

    if (errors.length) return { ok: false, errors, warnings }

    if (
      metadata.coordinate_system !== undefined &&
      metadata.coordinate_system !== NBA_COURT.coordinateSystem
    ) {
      errors.push(
        issue(
          "COORDINATE_SYSTEM",
          `坐标系 "${String(metadata.coordinate_system)}" 不受支持（仅 ${NBA_COURT.coordinateSystem}）`,
          `Coordinate system "${String(metadata.coordinate_system)}" is not supported (${NBA_COURT.coordinateSystem} only)`,
          "metadata.coordinate_system",
        ),
      )
      return { ok: false, errors, warnings }
    }

    const ids = [...rosterMap.keys()]
    const offense = ids.filter((id) => rosterMap.get(id) === "offense")
    const defense = ids.filter((id) => rosterMap.get(id) === "defense")
    if (offense.length === 0 || defense.length === 0) {
      errors.push(
        issue(
          "ONE_SIDED",
          "需要同时包含进攻和防守球员",
          "Both offense and defense players are required",
        ),
      )
    }
    if (ballFrames > 0 && missingPossessor === ballFrames) {
      errors.push(
        issue(
          "NO_POSSESSION",
          "没有任何一帧包含 ball.possessor，无法判定持球",
          "No frame has ball.possessor; possession cannot be determined",
        ),
      )
    }
    if (missingClock > 0) {
      warnings.push(
        issue(
          "CLOCK_DERIVED",
          `${missingClock} 帧缺少 gameClock，已用时间戳代替`,
          `${missingClock} frames lack gameClock; derived from timestamps`,
        ),
      )
    }

    if (errors.length) return { ok: false, errors, warnings }

    // REALITY INTEGRITY: physical validation of every frame. INVALID vetoes analysis.
    const integrity = validateRealityIntegrity(states, {
      attackingBasketHint: metadata.attacking_basket,
    })
    for (const v of integrity.violations) {
      const target = v.severity === "error" ? errors : warnings
      target.push(issue(v.code, v.message.zh, v.message.en, v.frame !== undefined ? `frames[${v.frame}]` : undefined))
    }
    if (!integrity.valid) {
      return {
        ok: false,
        errors,
        warnings,
        integrity,
        summary: {
          frames: states.length,
          duration: states[states.length - 1].timestamp - states[0].timestamp,
          offense: offense.length,
          defense: defense.length,
          possessed: ballFrames - missingPossessor,
        },
      }
    }

    const providedRoster = Array.isArray(raw.roster) ? raw.roster : []
    const roster: RosterEntry[] = ids.map((id, i) => {
      const entry = providedRoster.find((r) => isRecord(r) && r.id === id)
      const rec = isRecord(entry) ? entry : {}
      const team = rosterMap.get(id) as Team
      return {
        id,
        team,
        number: isNum(rec.number) ? rec.number : Number(id.replace(/\D/g, "")) || i + 1,
        name: typeof rec.name === "string" ? rec.name : id,
        role: typeof rec.role === "string" ? rec.role : team === "offense" ? "Offense" : "Defense",
      }
    })

    const first = states[0]
    const last = states[states.length - 1]
    const fps = isNum(metadata.fps) && metadata.fps > 0 ? metadata.fps : null
    const observedRate = (last.timestamp - first.timestamp) / (states.length - 1)
    const sampleRate = fps ? 1 / fps : observedRate
    if (fps && Math.abs(1 / fps - observedRate) > 0.01) {
      warnings.push(
        issue(
          "FPS_MISMATCH",
          `metadata.fps=${fps} 与帧间隔 ${observedRate.toFixed(3)}s 不一致`,
          `metadata.fps=${fps} disagrees with observed frame spacing ${observedRate.toFixed(3)}s`,
          "metadata.fps",
        ),
      )
    }

    // Timestamps are re-based to the first frame so playback starts at 0.
    const offset = first.timestamp
    const rebased = offset === 0 ? states : states.map((s) => ({ ...s, timestamp: s.timestamp - offset }))

    const tracking: NormalizedTracking = {
      meta: {
        gameId: typeof metadata.game_id === "string" ? metadata.game_id : "unknown_game",
        possessionId:
          typeof metadata.possession_id === "string" ? metadata.possession_id : "possession",
        sampleRate,
        duration: last.timestamp - first.timestamp,
        clockAtStart: first.gameClock,
        clockDerived: missingClock > 0,
        unit: "meters",
        coordinateSystem: NBA_COURT.coordinateSystem,
        attackingBasket: integrity.attackingBasket,
        adapter: trackingJsonAdapter.id,
      },
      roster,
      states: rebased,
      integrity,
    }

    return { ok: true, tracking, warnings }
  },
}
