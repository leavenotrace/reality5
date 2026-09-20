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
              GROUNDED · 5 EVIDENCE LINKS
            </span>
          ) : null
        }
      />

      {phase !== "ready" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            解说不是从统计数字中「编」出来的。Reality5 先读取赛场结构，再把每一句话链接回可验证的证据。
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
  return (
    <p className="text-sm leading-7 text-foreground/90">
      {commentary.segments.map((segment, i) => (
        <Segment key={i} segment={segment} />
      ))}
    </p>
  )
}

function Segment({ segment }: { segment: CommentarySegment }) {
  const { focusEvidence, focusedEvidenceId, seekToEvent, evidenceById, hoverEvent, hoveredEventId } =
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
        onClick={() => evidence && seekToEvent(evidence.sourceEventId)}
        title={evidence ? `${evidence.label.zh} · 点击回看来源事件` : undefined}
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
