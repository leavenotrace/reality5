import { NBA_COURT, project, projectLength } from "@/lib/reality5/court"
import type { BasketSide } from "@/lib/reality/court"
import { basketFor } from "@/lib/reality/court"

/**
 * Static full-court markings. Every coordinate is authored in court meters
 * and projected once through courtToScreen, so the drawing can never drift
 * from the physical contract the detectors measure against.
 */
export function CourtLines({ attacking = "right" }: { attacking?: BasketSide }) {
  const stroke = "oklch(1 0 0 / 38%)"
  const strokeWidth = 0.28

  const tl = project({ x: 0, y: 0 })
  const br = project({ x: NBA_COURT.length, y: NBA_COURT.width })
  const mid = project({ x: NBA_COURT.length / 2, y: 0 })
  const centre = project({ x: NBA_COURT.length / 2, y: NBA_COURT.width / 2 })

  return (
    <g fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round">
      <rect
        x={tl.x}
        y={tl.y}
        width={br.x - tl.x}
        height={br.y - tl.y}
        stroke="oklch(1 0 0 / 55%)"
      />
      <line x1={mid.x} y1={tl.y} x2={mid.x} y2={br.y} />
      <circle cx={centre.x} cy={centre.y} r={projectLength(NBA_COURT.freeThrowRadius)} />
      <HalfCourt side="left" active={attacking === "left"} />
      <HalfCourt side="right" active={attacking === "right"} />
    </g>
  )
}

function HalfCourt({ side, active }: { side: BasketSide; active: boolean }) {
  const basket = basketFor(side)
  const baselineX = side === "left" ? 0 : NBA_COURT.length
  // +1 moves away from the baseline into the court.
  const dir = side === "left" ? 1 : -1
  const m = (fromBaseline: number, y: number) => project({ x: baselineX + dir * fromBaseline, y })

  const hoop = project(basket)
  const paintHalf = NBA_COURT.paint.width / 2
  const paintNear = m(0, basket.y - paintHalf)
  const paintFar = m(NBA_COURT.paint.depth, basket.y + paintHalf)
  const ftCentre = m(NBA_COURT.paint.depth, basket.y)
  const ftR = projectLength(NBA_COURT.freeThrowRadius)

  const r3 = projectLength(NBA_COURT.threePointRadius)
  const cornerTop = m(0, NBA_COURT.cornerLineInset)
  const cornerBottom = m(0, NBA_COURT.width - NBA_COURT.cornerLineInset)
  // Where the straight corner segment meets the arc (in meters, then projected).
  const dy = basket.y - NBA_COURT.cornerLineInset
  const dxM = Math.sqrt(Math.max(0, NBA_COURT.threePointRadius ** 2 - dy ** 2))
  const arcTop = project({ x: basket.x + dir * dxM, y: NBA_COURT.cornerLineInset })
  const arcBottom = project({ x: basket.x + dir * dxM, y: NBA_COURT.width - NBA_COURT.cornerLineInset })
  const sweep = side === "left" ? 1 : 0

  const restrictedR = projectLength(NBA_COURT.restrictedRadius)
  const backboard = m(NBA_COURT.backboardOffset, basket.y)
  const backboardHalf = projectLength(0.9)

  return (
    <g opacity={active ? 1 : 0.55}>
      <rect
        x={Math.min(paintNear.x, paintFar.x)}
        y={paintNear.y}
        width={Math.abs(paintFar.x - paintNear.x)}
        height={paintFar.y - paintNear.y}
        fill={active ? "oklch(0.55 0.15 40 / 10%)" : "none"}
      />
      <circle cx={ftCentre.x} cy={ftCentre.y} r={ftR} />
      <path
        d={`M ${cornerTop.x} ${cornerTop.y} L ${arcTop.x} ${arcTop.y} A ${r3} ${r3} 0 0 ${sweep} ${arcBottom.x} ${arcBottom.y} L ${cornerBottom.x} ${cornerBottom.y}`}
        stroke="oklch(1 0 0 / 55%)"
      />
      <path
        d={`M ${backboard.x} ${hoop.y - restrictedR} A ${restrictedR} ${restrictedR} 0 0 ${sweep} ${backboard.x} ${hoop.y + restrictedR}`}
      />
      <line
        x1={backboard.x}
        y1={backboard.y - backboardHalf}
        x2={backboard.x}
        y2={backboard.y + backboardHalf}
        stroke="oklch(1 0 0 / 75%)"
        strokeWidth={0.5}
      />
      <circle
        cx={hoop.x}
        cy={hoop.y}
        r={projectLength(NBA_COURT.hoopRadius)}
        stroke={active ? "var(--tactical)" : "oklch(1 0 0 / 38%)"}
        strokeWidth={0.45}
      />
    </g>
  )
}
