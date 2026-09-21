import { NBA_COURT, type BasketSide, type Point, isInsideCourt } from "./court"
import type { CourtState, Localized } from "./types"

/**
 * REALITY INTEGRITY — physical validation of tracking input.
 *
 * Reality must be valid before Reality can be interpreted. Every frame is
 * checked against the NBA_METRIC contract and basic physics. An INVALID
 * result vetoes analysis: nothing downstream (detectors, Play Graph,
 * Commentary) may run on it.
 */

export const PHYSICAL_LIMITS = {
  /** m/s. Above this a player's movement is flagged as a WARNING. */
  PLAYER_SPEED_WARNING: 10,
  /** m/s. Above this the movement is physically implausible → INVALID. */
  PLAYER_SPEED_INVALID: 15,
  /** m/s. Thrown balls are fast; only absurd values are flagged. */
  BALL_SPEED_WARNING: 40,
  /** m. Frame-to-frame displacement that, combined with elapsed time, counts as a teleport. */
  TELEPORT_DISPLACEMENT: 2.0,
} as const

export type IntegrityStatus = "VALID" | "WARNING" | "INVALID"
export type CheckState = "ok" | "warn" | "fail"

export type IntegrityCode =
  | "OUT_OF_BOUNDS"
  | "PLAYER_COUNT"
  | "IDENTITY_CHANGED"
  | "TIME_NOT_MONOTONIC"
  | "SPEED_WARNING"
  | "SPEED_INVALID"
  | "TELEPORT"

export interface IntegrityViolation {
  code: IntegrityCode
  severity: "error" | "warn"
  /** Player or "BALL". */
  subject?: string
  frame?: number
  timestamp?: number
  observed: string
  allowed: string
  /** Court-meter location of the offending sample, for the debug mini-court. */
  point?: Point
  message: Localized
}

export interface RealityIntegrity {
  status: IntegrityStatus
  valid: boolean
  coordinateSystem: typeof NBA_COURT.coordinateSystem
  attackingBasket: BasketSide
  courtBounds: CheckState
  playerCount: CheckState
  playerIdentityIntegrity: CheckState
  timestampIntegrity: CheckState
  physicalMovement: CheckState
  violations: IntegrityViolation[]
  /** Human-readable warning codes, as exported. */
  warnings: string[]
  limits: typeof PHYSICAL_LIMITS
}

const fmt = (v: number, p = 2) => v.toFixed(p)

/** The basket the offense attacks: whichever end the ball spends its time on. */
export function inferAttackingBasket(states: CourtState[], hint?: unknown): BasketSide {
  if (hint === "left" || hint === "right") return hint
  const mid = NBA_COURT.length / 2
  let right = 0
  for (const s of states) if (s.ball.x >= mid) right++
  return right * 2 >= states.length ? "right" : "left"
}

export function validateRealityIntegrity(
  states: CourtState[],
  options: { attackingBasketHint?: unknown } = {},
): RealityIntegrity {
  const violations: IntegrityViolation[] = []
  const push = (v: IntegrityViolation) => violations.push(v)

  // ---- COURT BOUNDS ---------------------------------------------------
  states.forEach((s, i) => {
    for (const p of s.players) checkBounds(p, p.id, i, s.timestamp, push)
    checkBounds(s.ball, "BALL", i, s.timestamp, push)
  })

  // ---- PLAYER COUNT (from the first frame) ----------------------------
  const first = states[0]
  const offense = first ? first.players.filter((p) => p.team === "offense").length : 0
  const defense = first ? first.players.filter((p) => p.team === "defense").length : 0
  if (offense !== 5 || defense !== 5) {
    push({
      code: "PLAYER_COUNT",
      severity: "warn",
      frame: 0,
      observed: `${offense} offense / ${defense} defense`,
      allowed: "5 offense / 5 defense",
      message: {
        zh: `球员数量 ${offense} 进攻 / ${defense} 防守，非 5v5`,
        en: `${offense} offense / ${defense} defense, not 5v5`,
      },
    })
  }

  // ---- IDENTITY -------------------------------------------------------
  const baseIds = first ? first.players.map((p) => p.id).sort().join("|") : ""
  for (let i = 1; i < states.length; i++) {
    const ids = states[i].players.map((p) => p.id).sort().join("|")
    if (ids !== baseIds) {
      const a = new Set(baseIds.split("|"))
      const b = new Set(ids.split("|"))
      const missing = [...a].filter((id) => !b.has(id))
      const extra = [...b].filter((id) => !a.has(id))
      push({
        code: "IDENTITY_CHANGED",
        severity: "error",
        frame: i,
        timestamp: states[i].timestamp,
        observed: `missing ${missing.join(",") || "-"} · new ${extra.join(",") || "-"}`,
        allowed: "same player ids in every frame",
        message: {
          zh: `第 ${i} 帧球员 ID 与首帧不一致`,
          en: `Frame ${i} player ids differ from frame 0`,
        },
      })
      break
    }
  }

  // ---- TIME -----------------------------------------------------------
  for (let i = 1; i < states.length; i++) {
    const dt = states[i].timestamp - states[i - 1].timestamp
    if (dt <= 0) {
      push({
        code: "TIME_NOT_MONOTONIC",
        severity: "error",
        frame: i,
        timestamp: states[i].timestamp,
        observed: `t[${i}] = ${fmt(states[i].timestamp, 3)} s ≤ t[${i - 1}] = ${fmt(states[i - 1].timestamp, 3)} s`,
        allowed: "strictly increasing timestamps",
        message: { zh: "timestamp 必须严格递增", en: "timestamps must be strictly increasing" },
      })
      break
    }
  }

  // ---- VELOCITY / TELEPORTATION (frame-to-frame, positions only) ------
  const flagged = new Set<string>()
  for (let i = 1; i < states.length; i++) {
    const prev = states[i - 1]
    const cur = states[i]
    const dt = cur.timestamp - prev.timestamp
    if (dt <= 0) continue
    for (const p of cur.players) {
      const q = prev.players.find((o) => o.id === p.id)
      if (!q) continue
      const d = Math.hypot(p.x - q.x, p.y - q.y)
      const v = d / dt
      const key = `${p.id}:${v >= PHYSICAL_LIMITS.PLAYER_SPEED_INVALID ? "fail" : "warn"}`
      if (v >= PHYSICAL_LIMITS.PLAYER_SPEED_INVALID) {
        if (flagged.has(key)) continue
        flagged.add(key)
        const teleport = d >= PHYSICAL_LIMITS.TELEPORT_DISPLACEMENT
        push({
          code: teleport ? "TELEPORT" : "SPEED_INVALID",
          severity: "error",
          subject: p.id,
          frame: i,
          timestamp: cur.timestamp,
          point: { x: p.x, y: p.y },
          observed: `${fmt(d)} m in ${fmt(dt, 3)} s = ${fmt(v, 1)} m/s`,
          allowed: `≤ ${PHYSICAL_LIMITS.PLAYER_SPEED_INVALID} m/s`,
          message: teleport
            ? { zh: `${p.id} 在第 ${i} 帧发生瞬移`, en: `${p.id} teleported at frame ${i}` }
            : { zh: `${p.id} 在第 ${i} 帧速度不符合物理`, en: `${p.id} moved implausibly fast at frame ${i}` },
        })
      } else if (v >= PHYSICAL_LIMITS.PLAYER_SPEED_WARNING) {
        if (flagged.has(key)) continue
        flagged.add(key)
        push({
          code: "SPEED_WARNING",
          severity: "warn",
          subject: p.id,
          frame: i,
          timestamp: cur.timestamp,
          point: { x: p.x, y: p.y },
          observed: `${fmt(v, 1)} m/s`,
          allowed: `< ${PHYSICAL_LIMITS.PLAYER_SPEED_WARNING} m/s`,
          message: { zh: `${p.id} 在第 ${i} 帧速度异常偏高`, en: `${p.id} unusually fast at frame ${i}` },
        })
      }
    }
    const bd = Math.hypot(cur.ball.x - prev.ball.x, cur.ball.y - prev.ball.y)
    const bv = bd / dt
    if (bv >= PHYSICAL_LIMITS.BALL_SPEED_WARNING && !flagged.has("BALL:warn")) {
      flagged.add("BALL:warn")
      push({
        code: "SPEED_WARNING",
        severity: "warn",
        subject: "BALL",
        frame: i,
        timestamp: cur.timestamp,
        point: { x: cur.ball.x, y: cur.ball.y },
        observed: `${fmt(bv, 1)} m/s`,
        allowed: `< ${PHYSICAL_LIMITS.BALL_SPEED_WARNING} m/s`,
        message: { zh: `球在第 ${i} 帧速度异常`, en: `Ball unusually fast at frame ${i}` },
      })
    }
  }

  const stateOf = (codes: IntegrityCode[]): CheckState => {
    const hits = violations.filter((v) => codes.includes(v.code))
    if (hits.some((v) => v.severity === "error")) return "fail"
    if (hits.length) return "warn"
    return "ok"
  }

  const courtBounds = stateOf(["OUT_OF_BOUNDS"])
  const playerCount = stateOf(["PLAYER_COUNT"])
  const playerIdentityIntegrity = stateOf(["IDENTITY_CHANGED"])
  const timestampIntegrity = stateOf(["TIME_NOT_MONOTONIC"])
  const physicalMovement = stateOf(["SPEED_WARNING", "SPEED_INVALID", "TELEPORT"])

  const hasError = violations.some((v) => v.severity === "error")
  const status: IntegrityStatus = hasError ? "INVALID" : violations.length ? "WARNING" : "VALID"

  return {
    status,
    valid: !hasError,
    coordinateSystem: NBA_COURT.coordinateSystem,
    attackingBasket: inferAttackingBasket(states, options.attackingBasketHint),
    courtBounds,
    playerCount,
    playerIdentityIntegrity,
    timestampIntegrity,
    physicalMovement,
    violations,
    warnings: violations.filter((v) => v.severity === "warn").map((v) => `${v.code}${v.subject ? `:${v.subject}` : ""}`),
    limits: PHYSICAL_LIMITS,
  }
}

function checkBounds(
  p: Point,
  subject: string,
  frame: number,
  timestamp: number,
  push: (v: IntegrityViolation) => void,
) {
  if (isInsideCourt(p)) return
  const axis = p.x < 0 || p.x > NBA_COURT.length ? "x" : "y"
  const value = axis === "x" ? p.x : p.y
  const max = axis === "x" ? NBA_COURT.length : NBA_COURT.width
  push({
    code: "OUT_OF_BOUNDS",
    severity: "error",
    subject,
    frame,
    timestamp,
    point: { x: p.x, y: p.y },
    observed: `${axis} = ${fmt(value)} m`,
    allowed: `0 ≤ ${axis} ≤ ${max} m`,
    message: {
      zh: `${subject} 在第 ${frame} 帧位于球场之外（${axis} = ${fmt(value)} m）`,
      en: `${subject} outside court at frame ${frame} (${axis} = ${fmt(value)} m)`,
    },
  })
}
