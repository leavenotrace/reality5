"use client"

import { Sparkles } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { Commentary, CommentarySegment } from "@/lib/reality5/types"
import { PanelHeader } from "./panel-header"
import { useWorkspace } from "./workspace-context"

type Phase = "idle" | "analyzing" | "ready"

export function CommentaryPanel() {
  const { possession } = useWorkspace()
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
      aria-label="Commentary 解说"
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-panel"
    >
      <PanelHeader
        eyebrow="COMMENTARY"
        title="Reality first. Language second."
        trailing={
          phase === "ready" ? (
            <span className="flex items-center gap-1.5 text-[10px] tracking-wider text-space">
              <span className="size-1.5 rounded-full bg-space" aria-hidden />
              GROUNDED · {evidenceLinks} EVIDENCE LINKS · TEMPLATE
            </span>
          ) : null
        }
      />

      {phase !== "ready" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            解说不是从统计数字中「编」出来的。Reality5 先从追踪数据检测事件，再用确定性模板把每一句话链接回可验证的证据。
          </p>
          <Button
            onClick={() => setPhase("analyzing")}
            disabled={phase === "analyzing"}
            className="gap-2"
          >
            <Sparkles data-icon="inline-start" className={cn(phase === "analyzing" && "animate-pulse")} />
            {phase === "analyzing" ? "正在读取赛场结构…" : "Explain This Play"}
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="public" className="min-h-0 flex-1 gap-0">
          <div className="border-b px-3 py-2">
            <TabsList variant="line" className="h-7">
              {possession.commentary.map((c) => (
                <TabsTrigger key={c.audience} value={c.audience} className="px-2 text-xs">
                  {c.label.zh}
                  <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                    {c.label.en}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
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

function CommentaryText({ commentary }: { commentary: Commentary }) {
  const { evidenceById, focusEvidence, focusedEvidenceId, seekToEvent, seek } = useWorkspace()
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-sm leading-7 text-foreground/90">
        {commentary.segments.map((segment, i) => (
          <Segment key={i} segment={segment} />
        ))}
      </p>
      <TraceMarkers commentary={commentary} />
      <ul className="flex flex-wrap gap-1.5" aria-label="证据来源">
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
                title={`${ev.label.zh} · 跳转到测量时刻`}
                className={cn(
                  "rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider tabular-nums uppercase transition-colors",
                  "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  focused
                    ? "border-tactical bg-tactical/15 text-tactical"
                    : "border-border text-foreground/80 hover:border-tactical/60 hover:text-tactical",
                )}
              >
                {ev.value.toFixed(ev.precision)}
                {ev.unit} {ev.label.en}
              </button>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            onClick={() => seek(0)}
            title="解说全部来自追踪数据 · 回到回合开始"
            className="rounded-sm border border-dashed border-border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase transition-colors hover:text-foreground"
          >
            TRACKING DATA
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
    <ul className="flex flex-col gap-1" aria-label="证据追溯">
      {eventIds.map((id) => {
        const event = eventById.get(id)
        if (!event) return null
        const primary = event.evidenceIds.map((e) => evidenceById.get(e)).find(Boolean)
        const frame = Math.round(event.t / sampleRate)
        const markers = [
          event.type,
          primary ? `${primary.value.toFixed(primary.precision)}${primary.unit}` : null,
          `FRAME ${frame}`,
        ].filter((m): m is string => Boolean(m))
        return (
          <li key={id} className="flex flex-wrap items-center gap-1">
            {markers.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => openTrace(id)}
                title={`${event.title.zh} · 打开证据追溯`}
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
        title={evidence ? `${evidence.label.zh} · 点击打开证据追溯` : undefined}
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
      title="点击跳转到该事件"
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
