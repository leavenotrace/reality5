"use client"

import { Check, Circle } from "lucide-react"
import { useMemo } from "react"
import { basketFor } from "@/lib/reality/court"
import { dist, nearestDefenderDistance, playerById } from "@/lib/reality/court-state"
import { project } from "@/lib/reality5/court"
import type { EventType } from "@/lib/reality5/types"
import { cn } from "@/lib/utils"
import { getRealityState } from "@/lib/reality5/tracking"
import { useWorkspace } from "./workspace-context"

const ALL_TYPES: EventType[] = [
  "DRIVE",
  "HELP_DEFENSE",
  "DEFENSIVE_COLLAPSE",
  "OPEN_SPACE",
  "PASS",
  "OPEN_THREE",
]

/**
 * Live readout of the values the detectors compute, sampled at the current
 * time. Nothing here is stored — it proves the events come from Reality.
 */
export function RealityDebug() {
  const { possession, realityState, currentTime, detectedEventIds } = useWorkspace()
  const { analysis } = possession
  const ctx = analysis.commentaryContext

  const handlerId = String(ctx.ball_handler ?? realityState.ball.possessor ?? "")
  const helpId = String(ctx.help_defender ?? "")
  const shooterId = String(ctx.shooter ?? "")

  const helpOrigin = useMemo(() => {
    if (!helpId) return null
    const drive = analysis.events.find((e) => e.type === "DRIVE")
    const at = getRealityState(possession, drive?.timestamp ?? 0)
    return playerById(at, helpId) ?? null
  }, [analysis.events, helpId, possession])

  const handler = playerById(realityState, handlerId)
  const helper = playerById(realityState, helpId)
  const shooterOpen = shooterId ? nearestDefenderDistance(realityState, shooterId) : null
  const helpShift = helper && helpOrigin ? dist(helper, helpOrigin) : null

  const rows: { label: string; value: string; accent?: boolean }[] = [
    { label: "Time", value: realityState.gameClock ?? currentTime.toFixed(1) },
    { label: "Ball", value: realityState.ball.possessor ?? "IN FLIGHT" },
    { label: `${handlerId || "Handler"} Speed`, value: handler ? `${handler.speed.toFixed(1)} m/s` : "—" },
    { label: `${helpId || "Help"} Shift`, value: helpShift !== null ? `${helpShift.toFixed(1)} m` : "—" },
    {
      label: `${shooterId || "Shooter"} Def Dist`,
      value: shooterOpen ? `${shooterOpen.distance.toFixed(1)} m` : "—",
      accent: shooterOpen ? shooterOpen.distance >= analysis.config.openSpaceThreshold : false,
    },
  ]

  const frameIndex = Math.round(currentTime / possession.tracking.meta.sampleRate)

  const detected = analysis.events.map((e) => ({
    type: e.type,
    on: detectedEventIds.has(e.id),
    confidence: e.confidence,
  }))
  const missing = ALL_TYPES.filter((t) => !analysis.events.some((e) => e.type === t))

  const integrity = analysis.integrity
  const basket = basketFor(analysis.config.attackingBasket)
  const trackedIds = [handlerId, helpId, shooterId].filter((id, i, arr) => id && arr.indexOf(id) === i)
  const coordinateRows = [
    ...trackedIds
      .map((id) => ({ id, p: playerById(realityState, id) }))
      .filter((r): r is { id: string; p: NonNullable<typeof r.p> } => Boolean(r.p)),
    { id: "BASKET", p: basket },
  ]
  const m = (v: number, p = 2) => `${v.toFixed(p)}m`
  const px = (v: number) => v.toFixed(1)

  return (
    <aside
      aria-label="Reality Debug"
      className="my-3 w-52 shrink-0 self-start overflow-auto rounded-md border border-space/40 bg-black/80 p-3 font-mono text-[11px] leading-5 backdrop-blur-sm max-h-[calc(100%-1.5rem)]"
    >
      <div className="mb-2 flex flex-col leading-4">
        <span className="font-semibold tracking-[0.2em] whitespace-nowrap text-space">
          REALITY DEBUG
        </span>
        <span className="text-[9px] tracking-wider whitespace-nowrap text-muted-foreground">
          {possession.dataSource.source} · {possession.dataSource.sampleRateHz} HZ ·{" "}
          {possession.dataSource.frames} FRAMES
        </span>
      </div>

      <SectionLabel>INPUT</SectionLabel>
      <dl className="flex flex-col">
        <Row label="Adapter" value={possession.dataSource.adapter} />
        <Row label="Possession" value={possession.tracking.meta.possessionId} />
        <Row label="Frame" value={`${frameIndex} / ${analysis.states.length - 1}`} />
        <Row label="Clock" value={possession.tracking.meta.clockDerived ? "derived" : "source"} />
        {rows.map((row) => (
          <Row key={row.label} label={row.label} value={row.value} accent={row.accent} />
        ))}
      </dl>

      <SectionLabel>DETECTOR</SectionLabel>
      <dl className="flex flex-col">
        <Row label="drive speed" value={`> ${analysis.config.driveSpeedThreshold.toFixed(1)} m/s`} />
        <Row label="help shift" value={`> ${analysis.config.helpShiftThreshold.toFixed(1)} m`} />
        <Row
          label="collapse"
          value={`≥${analysis.config.collapseMinDefenders} × ${analysis.config.collapseShiftThreshold.toFixed(1)} m`}
        />
        <Row
          label="open space"
          value={`≥ ${analysis.config.openSpaceThreshold.toFixed(1)} / < ${analysis.config.openSpaceExitThreshold.toFixed(1)} m`}
        />
        <Row label="contest" value={`< ${analysis.config.contestDistance.toFixed(1)} m`} />
      </dl>

      <SectionLabel>COURT COORDINATES</SectionLabel>
      <dl className="flex flex-col">
        {coordinateRows.map(({ id, p }) => (
          <div key={id} className="flex items-baseline justify-between gap-2">
            <dt className={cn("truncate", id === "BASKET" ? "text-tactical" : "text-foreground")}>{id}</dt>
            <dd className="shrink-0 tabular-nums text-muted-foreground">
              x {m(p.x, id === "BASKET" ? 3 : 2)} <span className="ml-1">y {m(p.y)}</span>
            </dd>
          </div>
        ))}
        <Row label="system" value={integrity.coordinateSystem} />
        <Row label="attacking" value={analysis.config.attackingBasket.toUpperCase()} />
      </dl>

      <SectionLabel>SCREEN COORDINATES</SectionLabel>
      <dl className="flex flex-col text-muted-foreground/70">
        {coordinateRows.map(({ id, p }) => {
          const s = project(p)
          return (
            <div key={id} className="flex items-baseline justify-between gap-2">
              <dt className="truncate">{id}</dt>
              <dd className="shrink-0 tabular-nums">
                {px(s.x)} <span className="ml-1">{px(s.y)}</span> <span className="text-[9px]">u</span>
              </dd>
            </div>
          )
        })}
      </dl>

      <SectionLabel>OUTPUT</SectionLabel>
      <ul className="mt-0.5 flex flex-col">
        {detected.map((d, i) => (
          <li key={`${d.type}-${i}`} className="flex items-center gap-1.5">
            {d.on ? (
              <Check className="size-3 text-space" aria-hidden />
            ) : (
              <Circle className="size-2.5 text-muted-foreground/50" aria-hidden />
            )}
            <span className={cn(d.on ? "text-foreground" : "text-muted-foreground/60")}>
              {d.type.replace("_", " ")}
            </span>
            <span className="ml-auto text-[9px] tabular-nums text-muted-foreground">
              {Math.round(d.confidence * 100)}%
            </span>
          </li>
        ))}
        {missing.map((t) => (
          <li key={t} className="flex items-center gap-1.5 text-muted-foreground/40">
            <Circle className="size-2.5" aria-hidden />
            <span className="line-through">{t.replace("_", " ")}</span>
          </li>
        ))}
      </ul>

      <SectionLabel>CAUSAL ENGINE</SectionLabel>
      <ul className="mt-0.5 flex flex-col gap-1.5">
        {analysis.causal.edges.map((edge) => (
          <li key={edge.id} className="flex flex-col leading-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className={cn("truncate text-[10px]", edge.status === "TEMPORAL_ONLY" ? "text-muted-foreground/60" : "text-foreground")}>
                {edge.fromType.replace("_", " ")} → {edge.toType.replace("_", " ")}
              </span>
              <span
                className={cn(
                  "shrink-0 text-[9px] font-bold tracking-wider",
                  edge.status === "SUPPORTED" && "text-space",
                  edge.status === "WEAK" && "text-tactical",
                  edge.status === "TEMPORAL_ONLY" && "text-muted-foreground/60",
                )}
              >
                {edge.status.replace("_", " ")}
              </span>
            </div>
            <dl className="flex flex-col pl-2 text-[9px] leading-[14px]">
              {edge.tests.map((t) => (
                <div key={t.id} className="flex items-baseline justify-between gap-2">
                  <dt className="truncate text-muted-foreground">{t.label.en}</dt>
                  <dd className={cn("shrink-0 font-bold", t.result === "PASS" ? "text-space" : t.result === "FAIL" ? "text-destructive" : "text-muted-foreground")}>
                    {t.result}
                  </dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">evidence</dt>
                <dd className="shrink-0 tabular-nums">{edge.evidence.length}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">relation</dt>
                <dd className={cn("shrink-0", edge.status === "TEMPORAL_ONLY" ? "text-muted-foreground/60" : "text-foreground")}>
                  {edge.relation}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">confidence</dt>
                <dd className={cn("shrink-0 tabular-nums", edge.status === "SUPPORTED" && "text-space")}>
                  {edge.status === "TEMPORAL_ONLY" ? "—" : edge.confidence.toFixed(2)}
                </dd>
              </div>
              {edge.status === "SUPPORTED" &&
                edge.factors.map((f) => (
                  <div key={f.id} className="flex items-baseline justify-between gap-2 text-muted-foreground/80">
                    <dt className="truncate pl-2">· {f.label.en.toLowerCase()}</dt>
                    <dd className="shrink-0 tabular-nums">{f.score.toFixed(2)}</dd>
                  </div>
                ))}
              {edge.status === "TEMPORAL_ONLY" && (
                <p className="text-muted-foreground/70">do not create causal edge</p>
              )}
            </dl>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[9px] leading-4 text-muted-foreground">
        chain: {analysis.trace.chain.length > 0 ? analysis.trace.chain.map((e) => e.fromType).concat(analysis.trace.chain[analysis.trace.chain.length - 1].toType).map((t) => t.replace("_", " ")).join(" → ") : "none"}
      </p>

      <SectionLabel>REALITY INTEGRITY</SectionLabel>
      <dl className="flex flex-col">
        <Row
          label="status"
          value={integrity.status}
          accent={integrity.status === "VALID"}
          warn={integrity.status === "WARNING"}
        />
        <Row label="court bounds" value={integrity.courtBounds} accent={integrity.courtBounds === "ok"} warn={integrity.courtBounds !== "ok"} />
        <Row label="timestamps" value={integrity.timestampIntegrity} accent={integrity.timestampIntegrity === "ok"} warn={integrity.timestampIntegrity !== "ok"} />
        <Row label="identity" value={integrity.playerIdentityIntegrity} accent={integrity.playerIdentityIntegrity === "ok"} warn={integrity.playerIdentityIntegrity !== "ok"} />
        <Row label="movement" value={integrity.physicalMovement} accent={integrity.physicalMovement === "ok"} warn={integrity.physicalMovement !== "ok"} />
        {integrity.warnings.length > 0 && <Row label="warnings" value={String(integrity.warnings.length)} warn />}
      </dl>
      <p className="mt-1.5 text-[10px] leading-4 text-foreground/70">
        Reality must be valid before Reality can be interpreted.
        <br />
        <span className="text-space">Reality has veto power.</span>
      </p>

      <div className="mt-2.5 border-t border-border/50 pt-2 text-[9px] leading-4 tracking-[0.15em] text-muted-foreground">
        <p>REALITY5 V0.4</p>
        <p>REALITY → OBSERVATION → EVENT → CAUSALITY → EXPLANATION</p>
        <p className="mt-0.5 text-foreground/70 normal-case tracking-normal">
          Correlation is not causation. Reality has veto power.
        </p>
      </div>
    </aside>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mt-2 border-t border-border/50 pt-1.5 text-[9px] tracking-[0.2em] text-space/80 first:mt-0 first:border-0 first:pt-0">
      {children}
    </p>
  )
}

function Row({
  label,
  value,
  accent,
  warn,
}: {
  label: string
  value: string
  accent?: boolean
  warn?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="truncate text-muted-foreground">{label}</dt>
      <dd className={cn("shrink-0 tabular-nums", accent && "text-space", warn && "text-tactical")}>{value}</dd>
    </div>
  )
}
