import { COURT, project, projectLength } from "@/lib/reality5/court"

/** Static half-court markings drawn in overlay frame units. */
export function CourtLines() {
  const stroke = "oklch(1 0 0 / 38%)"
  const strokeWidth = 0.28

  const tl = project({ x: 0, y: 0 })
  const br = project({ x: COURT.width, y: COURT.depth })
  const hoop = project(COURT.hoop)

  const paintTl = project({ x: COURT.paint.x, y: 0 })
  const paintBr = project({
    x: COURT.paint.x + COURT.paint.width,
    y: COURT.paint.depth,
  })

  const ftCenter = project({ x: COURT.hoop.x, y: COURT.paint.depth })
  const ftR = projectLength(COURT.freeThrowRadius)

  const r3 = projectLength(COURT.threePointRadius)
  const cornerLeft = project({ x: COURT.cornerThreeX, y: 0 })
  const cornerRight = project({ x: COURT.width - COURT.cornerThreeX, y: 0 })
  const cornerDepth = projectLength(COURT.cornerThreeDepth)
  // Where the straight corner segment meets the arc.
  const dx = projectLength(COURT.hoop.x - COURT.cornerThreeX)
  const dy = Math.sqrt(Math.max(0, r3 * r3 - dx * dx))
  const arcStart = { x: cornerLeft.x, y: hoop.y + dy }
  const arcEnd = { x: cornerRight.x, y: hoop.y + dy }

  const restrictedR = projectLength(COURT.restrictedRadius)
  const backboard = project({ x: COURT.hoop.x, y: COURT.backboardY })
  const backboardHalf = projectLength(3)

  return (
    <g fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round">
      <rect
        x={tl.x}
        y={tl.y}
        width={br.x - tl.x}
        height={br.y - tl.y}
        stroke="oklch(1 0 0 / 55%)"
      />
      <rect
        x={paintTl.x}
        y={paintTl.y}
        width={paintBr.x - paintTl.x}
        height={paintBr.y - paintTl.y}
        fill="oklch(0.55 0.15 40 / 10%)"
      />
      <circle cx={ftCenter.x} cy={ftCenter.y} r={ftR} />
      <path
        d={`M ${cornerLeft.x} ${cornerLeft.y} L ${arcStart.x} ${Math.max(
          arcStart.y,
          cornerLeft.y + cornerDepth,
        )} A ${r3} ${r3} 0 0 0 ${arcEnd.x} ${Math.max(
          arcEnd.y,
          cornerRight.y + cornerDepth,
        )} L ${cornerRight.x} ${cornerRight.y}`}
        stroke="oklch(1 0 0 / 55%)"
      />
      <path
        d={`M ${hoop.x - restrictedR} ${backboard.y} A ${restrictedR} ${restrictedR} 0 0 0 ${
          hoop.x + restrictedR
        } ${backboard.y}`}
      />
      <line
        x1={backboard.x - backboardHalf}
        y1={backboard.y}
        x2={backboard.x + backboardHalf}
        y2={backboard.y}
        stroke="oklch(1 0 0 / 75%)"
        strokeWidth={0.5}
      />
      <circle
        cx={hoop.x}
        cy={hoop.y}
        r={projectLength(COURT.hoopRadius)}
        stroke="var(--tactical)"
        strokeWidth={0.45}
      />
    </g>
  )
}
