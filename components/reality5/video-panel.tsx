"use client"

import { Pause, Play, RotateCcw, RotateCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { clockAt } from "@/lib/reality5/tracking"
import { CourtOverlay } from "./court-overlay"
import { PanelHeader } from "./panel-header"
import { RealityDebug } from "./reality-debug"
import { RealityTestPanel } from "./reality-test-panel"
import { useWorkspace } from "./workspace-context"

export function VideoPanel() {
  const {
    possession,
    currentTime,
    isPlaying,
    isReplaying,
    debugOpen,
    toggle,
    restart,
    replayAnalysis,
    videoRef,
    activeEvent,
    detectedEventIds,
  } = useWorkspace()

  return (
    <section
      aria-label="Game Reality 视频分析"
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-panel"
    >
      <PanelHeader
        eyebrow="GAME REALITY"
        title="视频分析"
        trailing={
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-muted-foreground">
              <span className="size-1.5 rounded-full bg-tactical" aria-hidden />
              LIVE OVERLAY
            </span>
            <Badge variant="outline" className="font-mono text-[10px]">
              {possession.game.away} @ {possession.game.home} · {possession.game.quarter}
            </Badge>
          </div>
        }
      />

      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        <div
          aria-hidden
          className="absolute inset-0 scale-110 bg-cover bg-center opacity-40 blur-2xl"
          style={{ backgroundImage: `url(${possession.video.poster})` }}
        />
        <div aria-hidden className="panel-grid absolute inset-0 opacity-70" />
        <div className="relative flex h-full items-stretch justify-center gap-3 px-3">
        <div className="relative aspect-video h-full min-w-0 max-h-full shadow-[0_0_0_1px_oklch(1_0_0/0.08),0_24px_60px_-20px_oklch(0_0_0/0.8)]">
          <video
            ref={videoRef}
            poster={possession.video.poster}
            src={possession.video.src ?? undefined}
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 size-full object-cover"
            aria-label="比赛录像"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[oklch(0.12_0.03_258/0.55)]"
            aria-hidden
          />
          <CourtOverlay />

          <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2">
            <span className="rounded-sm bg-black/70 px-2 py-1 font-mono text-xs font-semibold tabular-nums text-foreground">
              {clockAt(possession, currentTime)}
            </span>
            <span className="rounded-sm bg-black/70 px-2 py-1 text-[10px] font-medium tracking-widest text-muted-foreground">
              TACTICAL VIEW
            </span>
            <span className="flex items-center gap-1.5 rounded-sm bg-black/70 px-2 py-1 font-mono text-[10px] tracking-wider text-muted-foreground">
              <span className="size-1.5 rounded-full bg-tactical" aria-hidden />
              {possession.dataSource.source}
            </span>
            {isReplaying && (
              <span className="flex items-center gap-1.5 rounded-sm border border-space/50 bg-black/70 px-2 py-1 font-mono text-[10px] tracking-wider text-space">
                <span className="size-1.5 animate-pulse rounded-full bg-space" aria-hidden />
                DETECTING {detectedEventIds.size}/{possession.events.length}
              </span>
            )}
          </div>

          {activeEvent && (
            <div className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-2 rounded-sm border border-tactical/50 bg-black/70 px-2.5 py-1">
              <span className="font-mono text-[10px] text-tactical">
                {String(activeEvent.index).padStart(2, "0")}
              </span>
              <span className="text-xs font-semibold tracking-wide">
                {activeEvent.type.replace("_", " ")}
              </span>
              <span className="text-xs text-muted-foreground">{activeEvent.title.zh}</span>
            </div>
          )}

          <Legend />
        </div>
        <div className="flex min-h-0 flex-col gap-0 overflow-auto">
          <RealityTestPanel />
          {debugOpen && <RealityDebug />}
        </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t px-3 py-2">
        <Button
          size="icon-sm"
          variant="secondary"
          onClick={toggle}
          aria-label={isPlaying ? "暂停" : "播放"}
        >
          {isPlaying ? <Pause /> : <Play />}
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={restart} aria-label="重新播放">
          <RotateCcw />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={replayAnalysis}
          className="gap-1.5 font-mono text-[10px] tracking-wider"
        >
          <RotateCw data-icon="inline-start" className={cn(isReplaying && "animate-spin")} />
          REPLAY ANALYSIS
        </Button>
        <span className="ml-1 font-mono text-xs tabular-nums text-muted-foreground">
          {currentTime.toFixed(1)}s / {possession.video.duration.toFixed(1)}s
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {activeEvent ? activeEvent.summary.zh : "回合开始 · 半场阵地进攻"}
        </span>
      </div>
    </section>
  )
}

function Legend() {
  const items = [
    { color: "bg-movement", label: "MOVEMENT" },
    { color: "bg-tactical", label: "TACTICAL" },
    { color: "bg-space", label: "OPEN SPACE" },
  ]
  return (
    <ul className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 rounded-sm bg-black/60 px-2 py-1">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-muted-foreground"
        >
          <span className={`size-1.5 rounded-full ${item.color}`} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
