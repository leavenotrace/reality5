import { NBA_COURT, basketFor, courtToScreen, lengthToScreen, type BasketSide } from "@/lib/reality/court"
import type { IntegrityViolation } from "@/lib/reality/integrity"

/**
 * Developer/debug view: the offending sample of a validation error plotted on
 * a miniature court in true meters. Red is reserved for validation errors and
 * appears nowhere in broadcast analysis.
 */
export function IntegrityMiniCourt({
  violation,
  attacking = "right",
}: {
  violation: IntegrityViolation
  attacking?: BasketSide
}) {
  // Leave a margin so out-of-bounds points remain visible.
  const view = { width: 200, height: 120 }
  const margin = 12
  const inner = { width: view.width - margin * 2, height: view.height - margin * 2 }
  const P = (x: number, y: number) => {
    const p = courtToScreen(x, y, inner)
    return { x: p.x + margin, y: p.y + margin }
  }
  const tl = P(0, 0)
  const br = P(NBA_COURT.length, NBA_COURT.width)
  const mid = P(NBA_COURT.length / 2, 0)
  const left = P(basketFor("left").x, basketFor("left").y)
  const right = P(basketFor("right").x, basketFor("right").y)
  const hoopR = Math.max(1.2, lengthToScreen(NBA_COURT.hoopRadius * 2, inner))
  const point = violation.point ? P(violation.point.x, violation.point.y) : null
  const isError = violation.severity === "error"
  const color = isError ? "var(--destructive)" : "var(--tactical)"

  return (
    <svg
      viewBox={`0 0 ${view.width} ${view.height}`}
      className="w-full rounded-md border border-border/60 bg-background"
      role="img"
      aria-label={`${violation.subject ?? violation.code} at frame ${violation.frame ?? "-"}`}
    >
      <g fill="none" stroke="currentColor" strokeOpacity={0.35} strokeWidth={0.8}>
        <rect x={tl.x} y={tl.y} width={br.x - tl.x} height={br.y - tl.y} />
        <line x1={mid.x} y1={tl.y} x2={mid.x} y2={br.y} />
        <circle cx={left.x} cy={left.y} r={hoopR} strokeOpacity={attacking === "left" ? 0.9 : 0.35} />
        <circle cx={right.x} cy={right.y} r={hoopR} strokeOpacity={attacking === "right" ? 0.9 : 0.35} />
      </g>
      {point && (
        <g>
          <circle cx={point.x} cy={point.y} r={3.2} fill={color} />
          <circle cx={point.x} cy={point.y} r={6} fill="none" stroke={color} strokeWidth={0.8}>
            {isError && <animate attributeName="r" values="5;8;5" dur="1.6s" repeatCount="indefinite" />}
          </circle>
          <text
            x={Math.min(view.width - 4, Math.max(4, point.x))}
            y={point.y < 20 ? point.y + 14 : point.y - 9}
            textAnchor={point.x > view.width - 50 ? "end" : point.x < 50 ? "start" : "middle"}
            fontSize={6.5}
            fontFamily="var(--font-mono), monospace"
            fill={color}
            fontWeight={700}
          >
            {`${violation.subject ?? ""} ${violation.code === "OUT_OF_BOUNDS" ? "OUTSIDE COURT" : violation.code.replace("_", " ")}`.trim()}
          </text>
          <text
            x={Math.min(view.width - 4, Math.max(4, point.x))}
            y={point.y < 20 ? point.y + 21 : point.y - 2.5}
            textAnchor={point.x > view.width - 50 ? "end" : point.x < 50 ? "start" : "middle"}
            fontSize={5.5}
            fontFamily="var(--font-mono), monospace"
            fill="currentColor"
            fillOpacity={0.7}
          >
            {violation.frame !== undefined ? `Frame ${violation.frame}` : ""}
          </text>
        </g>
      )}
    </svg>
  )
}
