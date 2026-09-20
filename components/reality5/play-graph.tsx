"use client"

import { ArrowDown } from "lucide-react"
import { Fragment } from "react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { BasketballEvent, EventType, PlayGraphEdge } from "@/lib/reality5/types"
import { PanelHeader } from "./panel-header"
import { useWorkspace } from "./workspace-context"

const TYPE_COLOR: Record<EventType, string> = {
  DRIVE: "movement",
  HELP_DEFENSE: "tactical",
  DEFENSIVE_COLLAPSE: "tactical",
  OPEN_SPACE: "space",
  PASS: "movement",
  OPEN_THREE: "space",
}

const RELATION_LABEL: Record<PlayGraphEdge["relation"], string> = {
  causes: "导致",
  enables: "创造条件",
  leads_to: "引出",
}

const colorClasses: Record<
  string,
  { text: string; border: string; bg: string; dot: string }
> = {
  movement: {
    text: "text-movement",
    border: "border-movement",
    bg: "bg-movement/10",
    dot: "bg-movement",
  },
  tactical: {
    text: "text-tactical",
    border: "border-tactical",
    bg: "bg-tactical/10",
    dot: "bg-tactical",
  },
  space: {
    text: "text-space",
    border: "border-space",
    bg: "bg-space/10",
    dot: "bg-space",
  },
}

export function PlayGraph() {
  const { possession, activeEvent, currentTime, eventById } = useWorkspace()
  const nodes = possession.playGraph.nodeIds
    .map((id) => eventById.get(id))
    .filter((e): e is BasketballEvent => Boolean(e))
  const edgeFrom = new Map(possession.playGraph.edges.map((e) => [e.from, e]))

  return (
    <section
      aria-label="Play Graph 回合结构图"
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-panel"
    >
      <PanelHeader
        eyebrow="PLAY GRAPH"
        title="因果结构"
        trailing={
          <span className="font-mono text-[10px] text-muted-foreground">
            {nodes.length} NODES · {possession.playGraph.edges.length} EDGES
          </span>
        }
      />
      <ScrollArea className="min-h-0 flex-1">
        <ol className="flex flex-col px-3 py-3">
          {nodes.map((event) => {
            const edge = edgeFrom.get(event.id)
            const next = edge ? eventById.get(edge.to) : undefined
            return (
              <Fragment key={event.id}>
                <li>
                  <GraphNode
                    event={event}
                    isActive={activeEvent?.id === event.id}
                    isReached={event.t <= currentTime + 0.02}
                  />
                </li>
                {edge && next && (
                  <li aria-hidden className="flex items-center gap-2 py-1 pl-[15px]">
                    <div
                      className={cn(
                        "flex h-7 w-px flex-col items-center justify-center",
                        next.t <= currentTime + 0.02 ? "bg-foreground/40" : "bg-border",
                      )}
                    >
                      <ArrowDown
                        className={cn(
                          "size-3 translate-y-3 bg-panel",
                          next.t <= currentTime + 0.02
                            ? "text-foreground/60"
                            : "text-muted-foreground/50",
                        )}
                      />
                    </div>
                    <span className="text-[10px] tracking-wider text-muted-foreground">
                      {RELATION_LABEL[edge.relation]}
                      <span className="ml-1 font-mono uppercase opacity-60">
                        {edge.relation}
                      </span>
                    </span>
                  </li>
                )}
              </Fragment>
            )
          })}
        </ol>
      </ScrollArea>
    </section>
  )
}

function GraphNode({
  event,
  isActive,
  isReached,
}: {
  event: BasketballEvent
  isActive: boolean
  isReached: boolean
}) {
  const { seekToEvent, hoverEvent, hoveredEventId, evidenceById, focusEvidence } =
    useWorkspace()
  const colorKey = TYPE_COLOR[event.type]
  const c = colorClasses[colorKey]
  const hovered = hoveredEventId === event.id

  return (
    <button
      type="button"
      onClick={() => seekToEvent(event.id)}
      onMouseEnter={() => hoverEvent(event.id)}
      onMouseLeave={() => hoverEvent(null)}
      aria-current={isActive ? "step" : undefined}
      className={cn(
        "group flex w-full items-stretch gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        isActive
          ? cn(c.border, c.bg)
          : hovered
            ? "border-foreground/20 bg-panel-raised"
            : "border-border bg-panel-raised/40 hover:bg-panel-raised",
        !isReached && !isActive && "opacity-60",
      )}
    >
      <div className="flex flex-col items-center gap-1 pt-0.5">
        <span
          className={cn(
            "font-mono text-[11px] font-semibold tabular-nums",
            isActive ? c.text : "text-muted-foreground",
          )}
        >
          {String(event.index).padStart(2, "0")}
        </span>
        <span
          className={cn(
            "size-1.5 rounded-full",
            isReached ? c.dot : "bg-muted-foreground/40",
          )}
          aria-hidden
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "truncate text-xs font-semibold tracking-wide",
              isActive ? c.text : "text-foreground",
            )}
          >
            {event.type.replace("_", " ")}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {event.clock}
          </span>
        </div>
        <span className="text-sm text-foreground/90">{event.title.zh}</span>
        {isActive && (
          <div className="mt-1 flex flex-col gap-1.5">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {event.summary.zh}
            </p>
            {event.evidenceIds.length > 0 && (
              <ul className="flex flex-wrap gap-1">
                {event.evidenceIds.map((id) => {
                  const ev = evidenceById.get(id)
                  if (!ev) return null
                  return (
                    <li key={id}>
                      <Badge
                        variant="outline"
                        className={cn("cursor-help gap-1 font-mono text-[10px]", c.text)}
                        onMouseEnter={() => focusEvidence(id)}
                        onMouseLeave={() => focusEvidence(null)}
                      >
                        <span className="text-muted-foreground">{ev.label.en}</span>
                        {ev.value.toFixed(ev.precision)}
                        {ev.unit}
                      </Badge>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </button>
  )
}
