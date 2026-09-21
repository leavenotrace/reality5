"use client"

import { Fragment } from "react"
import { cn } from "@/lib/utils"
import { FRAME, project, projectLength } from "@/lib/reality5/court"
import { resolveAnchor, samplePath } from "@/lib/reality5/tracking"
import type {
  Anchor,
  Evidence,
  OverlayColor,
  OverlaySpec,
  Vec2,
} from "@/lib/reality5/types"
import { CourtLines } from "./court-lines"
import { useWorkspace } from "./workspace-context"

const COLOR: Record<OverlayColor, string> = {
  movement: "var(--movement)",
  tactical: "var(--tactical)",
  space: "var(--space)",
  neutral: "oklch(0.85 0.01 250)",
}

const GLOW: Record<OverlayColor, string> = {
  movement: "glow-movement",
  tactical: "glow-tactical",
  space: "glow-space",
  neutral: "",
}

function formatEvidence(e: Evidence) {
  return `${e.value.toFixed(e.precision)}${e.unit ? ` ${e.unit}` : ""}`
}

export function CourtOverlay() {
  const {
    possession,
    courtState,
    activeEvent,
    focusedEvidenceId,
    evidenceById,
    focusEvidence,
    seekToEvent,
  } = useWorkspace()

  const overlay: OverlaySpec = activeEvent?.overlay ?? {}
  const resolve = (a: Anchor): Vec2 => resolveAnchor(possession, courtState, a)
  const P = (a: Anchor) => project(resolve(a))

  const highlightById = new Map(
    (overlay.highlights ?? []).map((h) => [h.playerId, h]),
  )

  return (
    <svg
      viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
      className="absolute inset-0 size-full"
      role="img"
      aria-label={
        activeEvent
          ? `战术叠加：${activeEvent.title.zh}`
          : "战术叠加：球员位置"
      }
    >
      <defs>
        {(Object.keys(COLOR) as OverlayColor[]).map((c) => (
          <marker
            key={c}
            id={`r5-arrow-${c}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={COLOR[c]} />
          </marker>
        ))}
      </defs>

      <CourtLines attacking={possession.analysis.config.attackingBasket} />

      {/* Zones */}
      {(overlay.zones ?? []).map((zone, i) => {
        const color = zone.kind === "open" ? COLOR.space : COLOR.tactical
        if (zone.shape === "circle") {
          const c = P(zone.center)
          return (
            <circle
              key={`zone-${i}`}
              cx={c.x}
              cy={c.y}
              r={projectLength(zone.radius)}
              fill={color}
              fillOpacity={0.12}
              stroke={color}
              strokeOpacity={0.55}
              strokeWidth={0.3}
              strokeDasharray="1.4 1"
            />
          )
        }
        const pts = zone.points.map(P)
        return (
          <polygon
            key={`zone-${i}`}
            points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
            fill={color}
            fillOpacity={0.14}
            stroke={color}
            strokeOpacity={0.6}
            strokeWidth={0.3}
            strokeLinejoin="round"
          />
        )
      })}

      {/* Movement paths */}
      {(overlay.paths ?? []).map((path, i) => {
        const pts = samplePath(possession, path.playerId, path.from, path.to).map(
          project,
        )
        if (pts.length < 2) return null
        const d = pts
          .map((p, j) => `${j === 0 ? "M" : "L"} ${p.x} ${p.y}`)
          .join(" ")
        return (
          <path
            key={`path-${i}`}
            d={d}
            fill="none"
            stroke={COLOR[path.color]}
            strokeWidth={0.55}
            strokeLinecap="round"
            strokeOpacity={0.9}
            className={GLOW[path.color]}
          />
        )
      })}

      {/* Arrows */}
      {(overlay.arrows ?? []).map((arrow, i) => {
        const from = P(arrow.from)
        const to = P(arrow.to)
        const color: OverlayColor =
          arrow.kind === "defense" ? "tactical" : "movement"
        const dashed = arrow.kind === "pass"
        if (arrow.kind === "movement") {
          // Shot arc rendered as a curve toward the rim.
          const mx = (from.x + to.x) / 2
          const my = Math.min(from.y, to.y) - 9
          return (
            <path
              key={`arrow-${i}`}
              d={`M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`}
              fill="none"
              stroke={COLOR.space}
              strokeWidth={0.45}
              strokeDasharray="1.2 1.2"
              strokeOpacity={0.9}
              markerEnd="url(#r5-arrow-space)"
            />
          )
        }
        return (
          <line
            key={`arrow-${i}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={COLOR[color]}
            strokeWidth={dashed ? 0.7 : 0.6}
            strokeLinecap="round"
            strokeDasharray={dashed ? "2 1.2" : undefined}
            className={cn(dashed && "r5-flow", GLOW[color])}
            markerEnd={`url(#r5-arrow-${color})`}
          />
        )
      })}

      {/* Measurements linked to evidence */}
      {(overlay.measures ?? []).map((m, i) => {
        const from = P(m.from)
        const to = P(m.to)
        const evidence = evidenceById.get(m.evidenceId)
        if (!evidence) return null
        const focused = focusedEvidenceId === m.evidenceId
        const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
        const color = COLOR[m.color]
        const text = formatEvidence(evidence)
        const w = text.length * 1.75 + 2.4
        return (
          <g
            key={`measure-${i}`}
            className="cursor-pointer"
            onMouseEnter={() => focusEvidence(m.evidenceId)}
            onMouseLeave={() => focusEvidence(null)}
            onClick={() => seekToEvent(evidence.sourceEventId)}
          >
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={color}
              strokeWidth={focused ? 0.5 : 0.32}
              strokeDasharray="0.9 0.9"
            />
            {[from, to].map((p, j) => (
              <circle key={j} cx={p.x} cy={p.y} r={0.55} fill={color} />
            ))}
            <rect
              x={mid.x - w / 2}
              y={mid.y - 2.1}
              width={w}
              height={4.2}
              rx={0.6}
              fill="oklch(0.12 0.02 258 / 92%)"
              stroke={color}
              strokeWidth={focused ? 0.45 : 0.25}
            />
            <text
              x={mid.x}
              y={mid.y + 1}
              textAnchor="middle"
              fontSize={2.7}
              fontFamily="var(--font-mono)"
              fontWeight={600}
              fill={color}
            >
              {text}
            </text>
          </g>
        )
      })}

      {/* Players */}
      {possession.players.map((player) => {
        const pos = courtState.players[player.id]
        if (!pos) return null
        const p = project(pos)
        const h = highlightById.get(player.id)
        const isOffense = player.team === "offense"
        const r = 2.2
        const color = h ? COLOR[h.color] : undefined
        return (
          <g key={player.id} className={cn(h && GLOW[h.color])}>
            {h?.pulse && (
              <circle
                cx={p.x}
                cy={p.y}
                r={r + 0.8}
                fill="none"
                stroke={color}
                strokeWidth={0.4}
                className="r5-pulse"
              />
            )}
            {h && (
              <circle
                cx={p.x}
                cy={p.y}
                r={r + 1.1}
                fill="none"
                stroke={color}
                strokeWidth={0.45}
              />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={r}
              fill={
                isOffense ? "oklch(0.97 0.005 250)" : "oklch(0.2 0.02 258)"
              }
              stroke={
                isOffense ? "oklch(0.97 0.005 250)" : "oklch(0.75 0.01 250)"
              }
              strokeWidth={0.35}
            />
            <text
              x={p.x}
              y={p.y + 0.95}
              textAnchor="middle"
              fontSize={2.3}
              fontFamily="var(--font-mono)"
              fontWeight={700}
              fill={isOffense ? "oklch(0.15 0.02 258)" : "oklch(0.92 0.01 250)"}
            >
              {player.number}
            </text>
          </g>
        )
      })}

      {/* Ball */}
      {(() => {
        const b = project(courtState.ball)
        const lift = projectLength(courtState.ball.z) * 0.2
        return (
          <g className="glow-tactical">
            <ellipse
              cx={b.x}
              cy={b.y + 0.4}
              rx={1 + lift * 0.15}
              ry={0.45}
              fill="oklch(0 0 0 / 35%)"
            />
            <circle
              cx={b.x}
              cy={b.y - lift}
              r={0.95}
              fill="var(--tactical)"
              stroke="oklch(0.25 0.05 45)"
              strokeWidth={0.2}
            />
          </g>
        )
      })()}

      {/* Metric labels */}
      {(overlay.labels ?? []).map((label, i) => {
        const base = P(label.anchor)
        const off = label.offset ?? { x: 0, y: 0 }
        const x = base.x + off.x
        const y = base.y + off.y
        const evidence = label.evidenceId
          ? evidenceById.get(label.evidenceId)
          : undefined
        const text = evidence
          ? `${evidence.label.en.toUpperCase()} ${formatEvidence(evidence)}`
          : (label.text ?? "")
        const focused = evidence && focusedEvidenceId === evidence.id
        const color = COLOR[label.color]
        const w = text.length * 1.55 + 2.6
        return (
          <Fragment key={`label-${i}`}>
            <g
              className={cn(evidence && "cursor-pointer")}
              onMouseEnter={() => evidence && focusEvidence(evidence.id)}
              onMouseLeave={() => evidence && focusEvidence(null)}
              onClick={() => evidence && seekToEvent(evidence.sourceEventId)}
            >
              <line
                x1={base.x}
                y1={base.y}
                x2={x}
                y2={y + 2}
                stroke={color}
                strokeWidth={0.2}
                strokeOpacity={0.6}
              />
              <rect
                x={x}
                y={y}
                width={w}
                height={4}
                rx={0.5}
                fill="oklch(0.12 0.02 258 / 92%)"
                stroke={color}
                strokeWidth={focused ? 0.45 : 0.22}
              />
              <rect x={x} y={y} width={0.7} height={4} fill={color} />
              <text
                x={x + 1.5}
                y={y + 2.85}
                fontSize={2.4}
                fontFamily="var(--font-mono)"
                fontWeight={600}
                letterSpacing={0.05}
                fill={color}
              >
                {text}
              </text>
            </g>
          </Fragment>
        )
      })}
    </svg>
  )
}
