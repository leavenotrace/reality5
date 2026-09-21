"use client"

import { ArrowDown, RotateCw, ScanSearch } from "lucide-react"
import { Fragment } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type {
  EventType,
  PlayGraphEdge,
  PresentedEvent,
  Relationship,
} from "@/lib/reality5/types"
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

const RELATION_LABEL: Record<Relationship, string> = {
  TRIGGERED: "触发",
  CONTRIBUTED: "促成",
  CREATED: "创造",
  ENABLED: "使可能",
  PRECEDED: "先于",
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

const formatEdgeValue = (v: number | string) =>
  typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : v

export function PlayGraph() {
  const {
    possession,
    activeEvent,
    detectedEventIds,
    isReplaying,
    replayAnalysis,
    eventById,
  } = useWorkspace()
  const { nodes, edges } = possession.playGraph
  const orderedEvents = nodes
    .map((n) => eventById.get(n.eventId))
    .filter((e): e is PresentedEvent => Boolean(e))

  const edgeBetween = (a: string, b: string) =>
    edges.find((e) => e.source === a && e.target === b)
  const incoming = (id: string) => edges.filter((e) => e.target === id)
  const detectedCount = orderedEvents.filter((e) => detectedEventIds.has(e.id)).length

  return (
    <section
      aria-label="Play Graph 回合结构图"
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-panel"
    >
      <PanelHeader
        eyebrow="PLAY GRAPH"
        title="因果结构"
        trailing={
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {isReplaying ? `${detectedCount}/${nodes.length}` : nodes.length} NODES · {edges.length} EDGES
            </span>
            <Button
              size="xs"
              variant="outline"
              onClick={replayAnalysis}
              className="gap-1.5 font-mono text-[10px] tracking-wider"
              aria-label="重新运行检测并回放"
            >
              <RotateCw data-icon="inline-start" className={cn(isReplaying && "animate-spin")} />
              REPLAY ANALYSIS
            </Button>
          </div>
        }
      />
      <ScrollArea className="min-h-0 flex-1">
        <ol className="flex flex-col px-3 py-3">
          {orderedEvents.map((event, i) => {
            const next = orderedEvents[i + 1]
            const edge = next ? edgeBetween(event.id, next.id) : undefined
            const reached = detectedEventIds.has(event.id)
            const nextReached = next ? detectedEventIds.has(next.id) : false
            return (
              <Fragment key={event.id}>
                <li>
                  {isReplaying && !reached ? (
                    <PendingNode index={event.index} />
                  ) : (
                    <GraphNode
                      event={event}
                      incoming={incoming(event.id)}
                      isActive={activeEvent?.id === event.id}
                      isReached={reached}
                    />
                  )}
                </li>
                {next && (
                  <li aria-hidden className="flex items-center gap-2 py-1 pl-[15px]">
                    <div
                      className={cn(
                        "flex h-7 w-px flex-col items-center justify-center",
                        nextReached ? "bg-foreground/40" : "bg-border",
                      )}
                    >
                      <ArrowDown
                        className={cn(
                          "size-3 translate-y-3 bg-panel",
                          nextReached ? "text-foreground/60" : "text-muted-foreground/50",
                        )}
                      />
                    </div>
                    {edge && (!isReplaying || nextReached) ? (
                      <span className="text-[10px] tracking-wider text-muted-foreground">
                        {RELATION_LABEL[edge.relationship]}
                        <span className="ml-1 font-mono uppercase opacity-60">
                          {edge.relationship}
                        </span>
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] tracking-wider text-muted-foreground/50">
                        {isReplaying ? "…" : "TEMPORAL"}
                      </span>
                    )}
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

function PendingNode({ index }: { index: number }) {
  return (
    <div
      aria-label={`事件 ${index} 尚未检测`}
      className="flex w-full items-center gap-3 rounded-md border border-dashed border-border/70 px-3 py-2.5"
    >
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground/60">
        {String(index).padStart(2, "0")}
      </span>
      <span className="h-1.5 w-24 animate-pulse rounded-full bg-muted" />
      <span className="ml-auto font-mono text-[10px] tracking-wider text-muted-foreground/60">
        SCANNING
      </span>
    </div>
  )
}

function GraphNode({
  event,
  incoming,
  isActive,
  isReached,
}: {
  event: PresentedEvent
  incoming: PlayGraphEdge[]
  isActive: boolean
  isReached: boolean
}) {
  const {
    seekToEvent,
    hoverEvent,
    hoveredEventId,
    evidenceById,
    focusEvidence,
    eventById,
    openTrace,
  } = useWorkspace()
  const colorKey = TYPE_COLOR[event.type]
  const c = colorClasses[colorKey]
  const hovered = hoveredEventId === event.id

  return (
    // A div so the nested VIEW EVIDENCE button stays valid HTML.
    <div
      role="button"
      tabIndex={0}
      aria-label={`${String(event.index).padStart(2, "0")} ${event.type.replace("_", " ")} ${event.clock}`}
      onClick={() => seekToEvent(event.id)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          seekToEvent(event.id)
        }
      }}
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
            <span className="ml-1.5 opacity-60">{Math.round(event.confidence * 100)}%</span>
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
            {incoming.length > 0 && (
              <ul className="flex flex-col gap-0.5 border-t border-border/60 pt-1.5">
                {incoming.map((edge) => {
                  const source = eventById.get(edge.source)
                  return (
                    <li
                      key={edge.source}
                      className="flex flex-wrap items-baseline gap-x-1.5 font-mono text-[10px] text-muted-foreground"
                    >
                      <span className="uppercase text-foreground/70">
                        {edge.relationship} BY {source?.type.replace("_", " ")}
                      </span>
                      {Object.entries(edge.evidence).map(([k, v]) => (
                        <span key={k} className="tabular-nums">
                          {k}={formatEdgeValue(v)}
                        </span>
                      ))}
                    </li>
                  )
                })}
              </ul>
            )}
            <Button
              size="xs"
              variant="outline"
              className={cn("w-fit gap-1 font-mono text-[10px] tracking-wider", c.text)}
              onClick={(e) => {
                e.stopPropagation()
                openTrace(event.id)
              }}
            >
              <ScanSearch data-icon="inline-start" />
              VIEW EVIDENCE
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
