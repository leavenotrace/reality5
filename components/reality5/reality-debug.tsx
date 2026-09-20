"use client"

import { Check, Circle } from "lucide-react"
import { useMemo } from "react"
import { dist, nearestDefenderDistance, playerById } from "@/lib/reality/court-state"
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

  const detected = analysis.events.map((e) => ({
    type: e.type,
    on: detectedEventIds.has(e.id),
    confidence: e.confidence,
  }))
  const missing = ALL_TYPES.filter((t) => !analysis.events.some((e) => e.type === t))

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

      <dl className="flex flex-col">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-2">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className={cn("tabular-nums", row.accent && "text-space")}>{row.value}</dd>
          </div>
        ))}
        <div className="mt-1.5 flex items-baseline justify-between gap-2 border-t border-border/50 pt-1.5">
          <dt className="text-muted-foreground">OPEN THRESHOLD</dt>
          <dd className="tabular-nums">{analysis.config.openSpaceThreshold.toFixed(1)} m</dd>
        </div>
      </dl>

      <p className="mt-2 text-[9px] tracking-[0.2em] text-muted-foreground">DETECTED</p>
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

      <div className="mt-2.5 border-t border-border/50 pt-2 text-[9px] leading-4 tracking-[0.15em] text-muted-foreground">
        <p>REALITY → STRUCTURE → UNDERSTANDING → STORY</p>
        <p className="mt-0.5 text-foreground/70 normal-case tracking-normal">
          Reality first. Language second.
        </p>
      </div>
    </aside>
  )
}
