"use client"

import { Pause, Play, RotateCcw, RotateCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { clockAt } from "@/lib/reality5/tracking"
import { CourtOverlay } from "./court-overlay"
import { EVENT_LABEL, RELATION_LABEL, useLocale } from "./locale-context"
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
    causalFocus,
  } = useWorkspace()
  const { t, tl } = useLocale()

  return (
    <section
      aria-label={t("比赛现实 · 视频分析", "Game Reality · video analysis")}
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-panel"
    >
      <PanelHeader
        eyebrow={t("比赛现实", "GAME REALITY")}
        title={t("视频分析", "Video analysis")}
        trailing={
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-muted-foreground">
              <span className="size-1.5 rounded-full bg-tactical" aria-hidden />
              {t("实时叠加", "LIVE OVERLAY")}
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
            aria-label={t("比赛录像", "Game footage")}
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
              {t("战术视角", "TACTICAL VIEW")}
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

          <CausalJumpHud />

          {activeEvent && !causalFocus && (
            <div className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-2 rounded-sm border border-tactical/50 bg-black/70 px-2.5 py-1">
              <span className="font-mono text-[10px] text-tactical">
                {String(activeEvent.index).padStart(2, "0")}
              </span>
              <span className="text-xs font-semibold tracking-wide">
                {activeEvent.type.replace("_", " ")}
              </span>
              <span className="text-xs text-muted-foreground">{tl(activeEvent.title)}</span>
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
          aria-label={isPlaying ? t("暂停", "Pause") : t("播放", "Play")}
        >
          {isPlaying ? <Pause /> : <Play />}
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={restart} aria-label={t("重新播放", "Restart")}>
          <RotateCcw />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={replayAnalysis}
          className="gap-1.5 font-mono text-[10px] tracking-wider"
        >
          <RotateCw data-icon="inline-start" className={cn(isReplaying && "animate-spin")} />
          {t("回放分析", "REPLAY ANALYSIS")}
        </Button>
        <span className="ml-1 font-mono text-xs tabular-nums text-muted-foreground">
          {currentTime.toFixed(1)}s / {possession.video.duration.toFixed(1)}s
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {activeEvent ? tl(activeEvent.summary) : t("回合开始 · 半场阵地进攻", "Possession start · half-court set")}
        </span>
      </div>
    </section>
  )
}

/**
 * Shown while a causal edge is projected onto the court. Hollow marker =
 * position before, filled marker = position after; dashed lines are the
 * distance measurements the edge was tested on.
 */
function CausalJumpHud() {
  const { causalFocus, clearCausalFocus, openWhy, eventById } = useWorkspace()
  const { t, tl } = useLocale()
  if (!causalFocus) return null
  const from = eventById.get(causalFocus.fromEventId)
  const to = eventById.get(causalFocus.toEventId)
  return (
    <div className="absolute top-3 right-3 flex max-w-[min(100%,22rem)] flex-col gap-1.5 rounded-sm border border-space/60 bg-black/80 px-3 py-2 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[9px] tracking-[0.25em] text-space">{t("因果跳转 · 现实", "CAUSAL JUMP · REALITY")}</span>
        <div className="flex items-center gap-1">
          <Button size="xs" variant="ghost" className="h-5 px-1.5 font-mono text-[9px] tracking-wider" onClick={() => openWhy(causalFocus.id)}>
            {t("为什么？", "WHY?")}
          </Button>
          <Button size="xs" variant="ghost" className="h-5 px-1.5 font-mono text-[9px] tracking-wider" onClick={clearCausalFocus} aria-label={t("关闭因果投影", "Close causal projection")}>
            {t("关闭", "CLOSE")}
          </Button>
        </div>
      </div>
      <p className="text-xs">
        <span className="font-semibold tracking-wide">{from ? tl(EVENT_LABEL[from.type]) : ""}</span>
        <span className={cn("mx-1.5 font-mono text-[10px] tracking-wider", causalFocus.status === "SUPPORTED" ? "text-space" : "text-tactical")}>
          → {tl(RELATION_LABEL[causalFocus.relation])} {causalFocus.confidence.toFixed(2)} →
        </span>
        <span className="font-semibold tracking-wide">{to ? tl(EVENT_LABEL[to.type]) : ""}</span>
      </p>
      <ul className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] text-muted-foreground">
        {causalFocus.jump.movements.filter((m) => m.label).map((m) => (
          <li key={`m-${m.playerId}`}>
            <span className="text-foreground">{m.playerId}</span> ○→● {m.label}
          </li>
        ))}
        {causalFocus.jump.measures.map((m, i) => (
          <li key={`d-${i}`}>
            <span className="text-foreground">{m.from}</span>–{m.to} <span className={i === causalFocus.jump.measures.length - 1 ? "text-space" : ""}>{m.label}</span>
            <span className="ml-1 opacity-60">@{m.t.toFixed(1)}s</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Legend() {
  const { t } = useLocale()
  const items = [
    { color: "bg-movement", label: t("移动", "MOVEMENT") },
    { color: "bg-tactical", label: t("战术", "TACTICAL") },
    { color: "bg-space", label: t("空间", "OPEN SPACE") },
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
