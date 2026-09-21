"use client"

import { Sparkles } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { Commentary, CommentarySegment } from "@/lib/reality5/types"
import { ClaimBadge, RelationTag } from "./causal-ui"
import { useLocale } from "./locale-context"
import { PanelHeader } from "./panel-header"
import { useWorkspace } from "./workspace-context"

type Phase = "idle" | "analyzing" | "ready"

export function CommentaryPanel() {
  const { possession } = useWorkspace()
  const { t, tl } = useLocale()
  const [phase, setPhase] = useState<Phase>("idle")
  const evidenceLinks = new Set(
    possession.commentary.flatMap((c) =>
      c.segments.flatMap((s) => (s.kind === "evidence" ? [s.evidenceId] : [])),
    ),
  ).size

  useEffect(() => {
    if (phase !== "analyzing") return
    const id = window.setTimeout(() => setPhase("ready"), 900)
    return () => window.clearTimeout(id)
  }, [phase])

  return (
    <section
      aria-label={t("解说", "Commentary")}
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-panel"
    >
      <PanelHeader
        eyebrow={t("解说", "COMMENTARY")}
        title={t("现实优先，语言其次。", "Reality first. Language second.")}
        trailing={
          phase === "ready" ? (
            <span className="flex items-center gap-1.5 text-[10px] tracking-wider text-space">
              <span className="size-1.5 rounded-full bg-space" aria-hidden />
              {t(`有据可查 · ${possession.analysis.trace.chain.length} 条因果边 · ${evidenceLinks} 个证据链接`, `GROUNDED · ${possession.analysis.trace.chain.length} CAUSAL EDGES · ${evidenceLinks} EVIDENCE LINKS`)}
            </span>
          ) : null
        }
      />

      {phase !== "ready" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            {t("解说不是先写段落再找理由。Reality5 先检测事件，再对每一对事件做因果检验，只用通过检验的因果边组装故事——每一句话都能回到证据。", "Commentary is not written first and justified later. Reality5 detects events, runs causal tests on every pair, and assembles the story only from edges that pass — every sentence traces back to evidence.")}
          </p>
          <Button
            onClick={() => setPhase("analyzing")}
            disabled={phase === "analyzing"}
            className="gap-2"
          >
            <Sparkles data-icon="inline-start" className={cn(phase === "analyzing" && "animate-pulse")} />
            {phase === "analyzing" ? t("正在读取赛场结构…", "Reading the court…") : t("解释这个回合", "Explain This Play")}
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="causal" className="min-h-0 flex-1 gap-0">
          <div className="border-b px-3 py-2">
            <TabsList variant="line" className="h-7">
              <TabsTrigger value="causal" className="px-2 text-xs">
                {t("因果故事", "Causal story")}
                <span className="ml-1 font-mono text-[10px] text-space">{t("因果链", "CAUSAL")}</span>
              </TabsTrigger>
              {possession.commentary.map((c) => (
                <TabsTrigger key={c.audience} value={c.audience} className="px-2 text-xs">
                  {tl(c.label)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="causal" className="min-h-0 overflow-auto px-4 py-3">
            <CausalStoryView />
          </TabsContent>
          {possession.commentary.map((c) => (
            <TabsContent key={c.audience} value={c.audience} className="min-h-0 overflow-auto px-4 py-3">
              <CommentaryText commentary={c} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </section>
  )
}

/**
 * CAUSAL STORY MODE. One sentence per event, assembled from the SUPPORTED
 * edges of the backward trace. Each sentence carries the type of claim it
 * makes and links back to the evidence and the edge that produced it.
 */
function CausalStoryView() {
  const { possession, evidenceById, focusEvidence, focusedEvidenceId, seekToEvent, openWhy, hoverEvent, hoveredEventId } =
    useWorkspace()
  const { t, tl } = useLocale()
  const { causalStory, trace } = possession.analysis

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2.5" aria-label={t("因果故事", "Causal story")}>
        {causalStory.sentences.map((s, i) => {
          const hovered = hoveredEventId === s.eventId
          const edge = s.edgeId ? possession.analysis.causal.edges.find((e) => e.id === s.edgeId) : undefined
          const text = tl(s.text).replace(/\s*\[[A-Z_]+ \d\.\d\d\]$/, "")
          return (
            <li key={`${s.eventId}-${i}`} className="flex gap-3">
              <div className="flex flex-col items-center pt-1">
                <span className={cn("size-1.5 rounded-full", s.claim === "CAUSAL_CLAIM" ? "bg-space" : s.claim === "INFERENCE" ? "bg-movement" : "bg-foreground/60")} aria-hidden />
                {i < causalStory.sentences.length - 1 && <span className="mt-1 w-px flex-1 bg-border" aria-hidden />}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <ClaimBadge claim={s.claim} />
                  <button
                    type="button"
                    onClick={() => seekToEvent(s.eventId)}
                    onMouseEnter={() => hoverEvent(s.eventId)}
                    onMouseLeave={() => hoverEvent(null)}
                    className={cn(
                      "rounded-sm border px-1.5 py-px font-mono text-[9px] tracking-wider transition-colors",
                      "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      hovered ? "border-movement bg-movement/15 text-movement" : "border-border text-muted-foreground hover:text-foreground",
                    )}
                    title={t("跳转到该事件", "Jump to this event")}
                  >
                    [{s.eventType}]
                  </button>
                  {edge && (
                    <button
                      type="button"
                      onClick={() => openWhy(edge.id)}
                      className="flex items-center gap-1.5 rounded-sm px-1 py-px hover:bg-space/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      title={t("为什么？打开因果证据", "WHY? Open causal evidence")}
                    >
                      <RelationTag relation={edge.relation} status={edge.status} confidence={edge.confidence} />
                      <span className="font-mono text-[9px] tracking-wider text-space/70 underline decoration-dotted">{t("为什么？", "WHY?")}</span>
                    </button>
                  )}
                </div>
                <p className="text-sm leading-6 text-foreground/90">{text}</p>
                {s.evidenceIds.length > 0 && (
                  <ul className="flex flex-wrap gap-1">
                    {s.evidenceIds.map((id) => {
                      const ev = evidenceById.get(id)
                      if (!ev) return null
                      const focused = focusedEvidenceId === id
                      return (
                        <li key={id}>
                          <button
                            type="button"
                            onClick={() => seekToEvent(ev.sourceEventId)}
                            onMouseEnter={() => focusEvidence(id)}
                            onMouseLeave={() => focusEvidence(null)}
                            onFocus={() => focusEvidence(id)}
                            onBlur={() => focusEvidence(null)}
                            className={cn(
                              "rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider tabular-nums uppercase transition-colors",
                              "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                              focused
                                ? "border-tactical bg-tactical/15 text-tactical"
                                : "border-border text-foreground/80 hover:border-tactical/60 hover:text-tactical",
                            )}
                          >
                            {ev.value.toFixed(ev.precision)}
                            {ev.unit} {tl(ev.label)}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {causalStory.stopped && (
        <p className="rounded-md border border-dashed border-tactical/50 px-3 py-2 text-xs leading-5 text-tactical">
          {tl(causalStory.stopped)}
        </p>
      )}
      <p className="font-mono text-[9px] tracking-[0.15em] text-muted-foreground">
        {t(`${trace.chain.length} 条成立的因果边 · 每一句话都链接回证据 · 不从时间先后推断任何因果`, `${trace.chain.length} SUPPORTED EDGES · EVERY SENTENCE LINKS BACK TO EVIDENCE · NOTHING INFERRED FROM TIME ALONE`)}
      </p>
    </div>
  )
}

function CommentaryText({ commentary }: { commentary: Commentary }) {
  const { evidenceById, focusEvidence, focusedEvidenceId, seekToEvent, seek } = useWorkspace()
  const { t, tl, locale } = useLocale()
  const segments = locale === "zh" ? commentary.segments : commentary.segmentsEn
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-sm leading-7 text-foreground/90">
        {segments.map((segment, i) => (
          <Segment key={i} segment={segment} />
        ))}
      </p>
      <TraceMarkers commentary={commentary} />
      <ul className="flex flex-wrap gap-1.5" aria-label={t("证据来源", "Evidence sources")}>
        {commentary.chips.map((id) => {
          const ev = evidenceById.get(id)
          if (!ev) return null
          const focused = focusedEvidenceId === id
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => seekToEvent(ev.sourceEventId)}
                onMouseEnter={() => focusEvidence(id)}
                onMouseLeave={() => focusEvidence(null)}
                onFocus={() => focusEvidence(id)}
                onBlur={() => focusEvidence(null)}
                title={t(`${ev.label.zh} · 跳转到测量时刻`, `${ev.label.en} · jump to measurement`)}
                className={cn(
                  "rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider tabular-nums uppercase transition-colors",
                  "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  focused
                    ? "border-tactical bg-tactical/15 text-tactical"
                    : "border-border text-foreground/80 hover:border-tactical/60 hover:text-tactical",
                )}
              >
                {ev.value.toFixed(ev.precision)}
                {ev.unit} {tl(ev.label)}
              </button>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            onClick={() => seek(0)}
            title={t("解说全部来自追踪数据 · 回到回合开始", "All commentary comes from tracking data · back to start")}
            className="rounded-sm border border-dashed border-border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase transition-colors hover:text-foreground"
          >
            {t("追踪数据", "TRACKING DATA")}
          </button>
        </li>
      </ul>
    </div>
  )
}

/**
 * Every claim in the commentary is backed by an event. For each event the
 * text references, show [EVENT] [value] [FRAME n] markers that open the
 * evidence trace. Sentences without an event get no markers — and the
 * commentary builder never emits them.
 */
function TraceMarkers({ commentary }: { commentary: Commentary }) {
  const { evidenceById, eventById, openTrace, possession } = useWorkspace()
  const { t, tl } = useLocale()
  const sampleRate = possession.tracking.meta.sampleRate

  const eventIds: string[] = []
  for (const seg of commentary.segments) {
    const id =
      seg.kind === "event"
        ? seg.eventId
        : seg.kind === "evidence"
          ? evidenceById.get(seg.evidenceId)?.sourceEventId
          : undefined
    if (id && !eventIds.includes(id)) eventIds.push(id)
  }
  for (const chip of commentary.chips) {
    const id = evidenceById.get(chip)?.sourceEventId
    if (id && !eventIds.includes(id)) eventIds.push(id)
  }
  if (eventIds.length === 0) return null

  return (
    <ul className="flex flex-col gap-1" aria-label={t("证据追溯", "Evidence trace")}>
      {eventIds.map((id) => {
        const event = eventById.get(id)
        if (!event) return null
        const primary = event.evidenceIds.map((e) => evidenceById.get(e)).find(Boolean)
        const frame = Math.round(event.t / sampleRate)
        const markers = [
          event.type,
          primary ? `${primary.value.toFixed(primary.precision)}${primary.unit}` : null,
          `${t("帧", "FRAME")} ${frame}`,
        ].filter((m): m is string => Boolean(m))
        return (
          <li key={id} className="flex flex-wrap items-center gap-1">
            {markers.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => openTrace(id)}
                title={t(`${event.title.zh} · 打开证据追溯`, `${event.title.en} · open evidence trace`)}
                className="rounded-sm border border-space/40 px-1 py-px font-mono text-[10px] tracking-wider text-space transition-colors hover:bg-space/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                [{m}]
              </button>
            ))}
          </li>
        )
      })}
    </ul>
  )
}

function Segment({ segment }: { segment: CommentarySegment }) {
  const { focusEvidence, focusedEvidenceId, openTrace, evidenceById, hoverEvent, hoveredEventId, seekToEvent } =
    useWorkspace()
  const { t } = useLocale()

  if (segment.kind === "text") return <>{segment.value}</>

  if (segment.kind === "evidence") {
    const evidence = evidenceById.get(segment.evidenceId)
    const focused = focusedEvidenceId === segment.evidenceId
    return (
      <button
        type="button"
        onMouseEnter={() => focusEvidence(segment.evidenceId)}
        onMouseLeave={() => focusEvidence(null)}
        onFocus={() => focusEvidence(segment.evidenceId)}
        onBlur={() => focusEvidence(null)}
        onClick={() => evidence && openTrace(evidence.sourceEventId)}
        title={evidence ? t(`${evidence.label.zh} · 点击打开证据追溯`, `${evidence.label.en} · open evidence trace`) : undefined}
        className={cn(
          "mx-0.5 inline-flex items-baseline gap-1 rounded-sm border-b border-dashed px-1 font-mono text-[13px] font-semibold tabular-nums transition-colors",
          "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          focused
            ? "border-tactical bg-tactical/15 text-tactical"
            : "border-tactical/50 text-tactical hover:bg-tactical/10",
        )}
      >
        {segment.value}
      </button>
    )
  }

  const hovered = hoveredEventId === segment.eventId
  return (
    <button
      type="button"
      onClick={() => seekToEvent(segment.eventId)}
      onMouseEnter={() => hoverEvent(segment.eventId)}
      onMouseLeave={() => hoverEvent(null)}
      title={t("点击跳转到该事件", "Jump to this event")}
      className={cn(
        "mx-0.5 rounded-sm border-b border-dashed px-0.5 font-medium transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        hovered
          ? "border-movement bg-movement/15 text-movement"
          : "border-movement/50 text-movement hover:bg-movement/10",
      )}
    >
      {segment.value}
    </button>
  )
}
