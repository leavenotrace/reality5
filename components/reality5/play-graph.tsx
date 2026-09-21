"use client"

import { ArrowDown, ArrowUp, HelpCircle, RotateCw, ScanSearch } from "lucide-react"
import { Fragment } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { CausalEdge, EventType, PresentedEvent } from "@/lib/reality5/types"
import { RelationTag, StatusPill } from "./causal-ui"
import { EVENT_LABEL, useLocale } from "./locale-context"
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
  const {
    possession,
    activeEvent,
    detectedEventIds,
    isReplaying,
    replayAnalysis,
    eventById,
    traceActive,
  } = useWorkspace()
  const { t } = useLocale()
  const { causal, trace } = possession.analysis
  const orderedEvents = causal.nodes
    .map((n) => eventById.get(n.eventId))
    .filter((e): e is PresentedEvent => Boolean(e))

  const edgeBetween = (a: string, b: string) =>
    causal.edges.find((e) => e.fromEventId === a && e.toEventId === b)
  const incoming = (id: string) =>
    causal.edges.filter((e) => e.toEventId === id && e.status !== "TEMPORAL_ONLY")
  const detectedCount = orderedEvents.filter((e) => detectedEventIds.has(e.id)).length
  const supported = causal.edges.filter((e) => e.status === "SUPPORTED").length
  const chainEdgeIds = new Set(trace.chain.map((e) => e.id))
  const chainEventIds = new Set<string>()
  for (const e of trace.chain) {
    chainEventIds.add(e.fromEventId)
    chainEventIds.add(e.toEventId)
  }
  if (trace.rootEventId) chainEventIds.add(trace.rootEventId)

  return (
    <section
      aria-label={t("因果结构图", "Causal Graph")}
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-panel"
    >
      <PanelHeader
        eyebrow={t("因果图", "CAUSAL GRAPH")}
        title={t("因果结构", "Structure")}
        trailing={
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] tabular-nums whitespace-nowrap text-muted-foreground">
              {isReplaying ? `${detectedCount}/${causal.nodes.length}` : causal.nodes.length} N ·{" "}
              <span className="text-space">{supported} {t("成立", "SUPPORTED")}</span>
            </span>
            <Button
              size="xs"
              variant="outline"
              onClick={replayAnalysis}
              className="gap-1.5 font-mono text-[10px] tracking-wider"
              aria-label={t("重新运行检测并回放", "Re-run detection and replay")}
            >
              <RotateCw data-icon="inline-start" className={cn(isReplaying && "animate-spin")} />
              {t("回放分析", "REPLAY ANALYSIS")}
            </Button>
          </div>
        }
      />

      <KeyQuestion />

      <ScrollArea className="min-h-0 flex-1">
        <ol className="flex flex-col px-3 py-3">
          {orderedEvents.map((event, i) => {
            const next = orderedEvents[i + 1]
            const edge = next ? edgeBetween(event.id, next.id) : undefined
            const reached = detectedEventIds.has(event.id)
            const nextReached = next ? detectedEventIds.has(next.id) : false
            const inChain = chainEventIds.has(event.id)
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
                      dimmed={traceActive && !inChain}
                      inChain={traceActive && inChain}
                    />
                  )}
                </li>
                {next && (
                  <li className="flex items-center gap-2 py-1 pl-[15px]">
                    <div
                      aria-hidden
                      className={cn(
                        "flex h-7 w-px flex-col items-center justify-center",
                        edge && chainEdgeIds.has(edge.id) && traceActive
                          ? "bg-space"
                          : nextReached
                            ? "bg-foreground/40"
                            : "bg-border",
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
                      <EdgeLabel edge={edge} highlighted={traceActive && chainEdgeIds.has(edge.id)} dimmed={traceActive && !chainEdgeIds.has(edge.id)} />
                    ) : (
                      <span className="font-mono text-[10px] tracking-wider text-muted-foreground/50">
                        {isReplaying ? "…" : t("仅时间先后", "TEMPORAL ONLY")}
                      </span>
                    )}
                  </li>
                )}
              </Fragment>
            )
          })}
        </ol>
      </ScrollArea>

      <footer className="shrink-0 border-t px-3 py-2">
        <p className="font-mono text-[9px] leading-4 tracking-[0.18em] text-muted-foreground">
          <span className="text-foreground/80">REALITY5 V0.4</span> · {t("现实 → 观察 → 事件 → 因果 → 解释", "REALITY → OBSERVATION → EVENT → CAUSALITY → EXPLANATION")}
        </p>
        <p className="font-mono text-[9px] tracking-[0.18em] text-space/80">
          {t("不要只告诉我发生了什么，告诉我为什么。", "DON'T JUST TELL ME WHAT HAPPENED. SHOW ME WHY.")}
        </p>
      </footer>
    </section>
  )
}

/**
 * WHAT CREATED THE SHOT? Traces backwards from the final event along
 * SUPPORTED edges only; a WEAK or TEMPORAL_ONLY link ends the chain.
 */
function KeyQuestion() {
  const { possession, traceActive, setTraceActive, eventById, openWhy, seekToEvent } = useWorkspace()
  const { t } = useLocale()
  const { trace } = possession.analysis
  const root = trace.rootEventId ? eventById.get(trace.rootEventId) : undefined
  const question =
    root?.type === "OPEN_THREE"
      ? t("是什么创造了这次出手？", "WHAT CREATED THE SHOT?")
      : t("是什么创造了最后一个事件？", "WHAT CREATED THE LAST EVENT?")

  // Effect first, then its causes — reading upward.
  const backwards = [...trace.chain].reverse()

  return (
    <div className="shrink-0 border-b bg-panel-raised/30 px-3 py-2">
      <button
        type="button"
        onClick={() => setTraceActive(!traceActive)}
        aria-expanded={traceActive}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left transition-colors",
          "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          traceActive ? "border-space bg-space/10" : "border-border hover:border-space/50 hover:bg-panel-raised",
        )}
      >
        <span className="flex flex-col">
          <span className={cn("font-mono text-xs font-bold tracking-[0.2em]", traceActive ? "text-space" : "text-foreground")}>
            {question}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {trace.chain.length > 0
              ? t(`${trace.chain.length} 条成立的因果边 · 只沿有证据的边回溯`, `${trace.chain.length} SUPPORTED edges · traced along evidence only`)
              : t("没有成立的因果边通向该事件", "No SUPPORTED edge leads to this event")}
          </span>
        </span>
        <HelpCircle className={cn("size-4 shrink-0", traceActive ? "text-space" : "text-muted-foreground")} aria-hidden />
      </button>

      {traceActive && root && (
        <ol className="mt-2 flex flex-col gap-0.5 pl-1" aria-label={t("因果回溯链", "Causal trace")}>
          <ChainNode event={root} onClick={() => seekToEvent(root.id)} />
          {backwards.map((edge) => {
            const cause = eventById.get(edge.fromEventId)
            if (!cause) return null
            return (
              <Fragment key={edge.id}>
                <li className="flex items-center gap-2 pl-1.5">
                  <ArrowUp className="size-3 text-space" aria-hidden />
                  <button
                    type="button"
                    onClick={() => openWhy(edge.id)}
                    className="flex items-center gap-2 rounded-sm px-1 py-px hover:bg-space/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    title={t("为什么？打开证据", "WHY? Open evidence")}
                  >
                    <RelationTag relation={edge.relation} status={edge.status} confidence={edge.confidence} />
                    <span className="font-mono text-[9px] tracking-wider text-space/70 underline decoration-dotted">{t("为什么？", "WHY?")}</span>
                  </button>
                </li>
                <ChainNode event={cause} onClick={() => seekToEvent(cause.id)} />
              </Fragment>
            )
          })}
          {trace.stoppedAt && trace.stoppedAt.reason !== "NO_INCOMING" && (
            <li className="mt-1 flex items-start gap-2 pl-1.5 font-mono text-[10px] leading-4 text-tactical">
              <ArrowUp className="mt-0.5 size-3 shrink-0 opacity-50" aria-hidden />
              <span>
                {t("停止", "STOP")} · {trace.stoppedAt.reason === "WEAK" ? t("证据不足", "WEAK") : t("仅时间先后", "TEMPORAL ONLY")}
                <span className="block text-muted-foreground">
                  {trace.stoppedAt.reason === "WEAK"
                    ? t("上游边证据不足，因果解释在此停止。", "The upstream edge is WEAK; the causal explanation stops here.")
                    : t("上游只有时间先后，没有可测量的机制。", "Upstream there is only temporal order — no measurable mechanism.")}
                </span>
              </span>
            </li>
          )}
          {trace.chain.length === 0 && (
            <li className="pl-1.5 font-mono text-[10px] leading-4 text-muted-foreground">
              {t("它发生了，但没有任何一条边通过因果检验。Reality5 不会为它编一个原因。", "It happened, but no edge passed the causal tests. Reality5 will not invent a cause.")}
            </li>
          )}
        </ol>
      )}
    </div>
  )
}

function ChainNode({ event, onClick }: { event: PresentedEvent; onClick: () => void }) {
  const { tl } = useLocale()
  const c = colorClasses[TYPE_COLOR[event.type]]
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex items-baseline gap-2 rounded-sm px-1 py-px text-left hover:bg-panel-raised focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className={cn("size-1.5 shrink-0 translate-y-[-1px] rounded-full", c.dot)} aria-hidden />
        <span className={cn("text-xs font-semibold tracking-wide", c.text)}>{tl(EVENT_LABEL[event.type])}</span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{event.clock}</span>
      </button>
    </li>
  )
}

function EdgeLabel({ edge, highlighted, dimmed }: { edge: CausalEdge; highlighted: boolean; dimmed: boolean }) {
  const { openWhy } = useWorkspace()
  const { t } = useLocale()
  const temporal = edge.status === "TEMPORAL_ONLY"
  return (
    <button
      type="button"
      onClick={() => openWhy(edge.id)}
      title={temporal ? t("为什么不？查看引擎为何拒绝这条因果边", "WHY NOT? See why the engine rejected this edge") : t("为什么？查看这条因果边的证据", "WHY? See the evidence for this edge")}
      className={cn(
        "group/edge flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-sm px-1 py-px text-left transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        highlighted ? "bg-space/10" : "hover:bg-panel-raised",
        dimmed && "opacity-40",
      )}
    >
      <RelationTag relation={edge.relation} status={edge.status} confidence={edge.confidence} />
      {!temporal && <StatusPill status={edge.status} />}
      <span
        className={cn(
          "font-mono text-[9px] tracking-wider underline decoration-dotted",
          temporal ? "text-muted-foreground/60" : "text-space/70 group-hover/edge:text-space",
        )}
      >
        {temporal ? t("为什么不？", "WHY NOT?") : t("为什么？", "WHY?")}
      </span>
    </button>
  )
}

function PendingNode({ index }: { index: number }) {
  const { t } = useLocale()
  return (
    <div
      aria-label={t(`事件 ${index} 尚未检测`, `Event ${index} not yet detected`)}
      className="flex w-full items-center gap-3 rounded-md border border-dashed border-border/70 px-3 py-2.5"
    >
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground/60">
        {String(index).padStart(2, "0")}
      </span>
      <span className="h-1.5 w-24 animate-pulse rounded-full bg-muted" />
      <span className="ml-auto font-mono text-[10px] tracking-wider text-muted-foreground/60">
        {t("扫描中", "SCANNING")}
      </span>
    </div>
  )
}

function GraphNode({
  event,
  incoming,
  isActive,
  isReached,
  dimmed,
  inChain,
}: {
  event: PresentedEvent
  incoming: CausalEdge[]
  isActive: boolean
  isReached: boolean
  dimmed: boolean
  inChain: boolean
}) {
  const {
    seekToEvent,
    hoverEvent,
    hoveredEventId,
    evidenceById,
    focusEvidence,
    eventById,
    openTrace,
    openWhy,
  } = useWorkspace()
  const { t, tl } = useLocale()
  const colorKey = TYPE_COLOR[event.type]
  const c = colorClasses[colorKey]
  const hovered = hoveredEventId === event.id

  return (
    // A div so the nested buttons stay valid HTML.
    <div
      role="button"
      tabIndex={0}
      aria-label={`${String(event.index).padStart(2, "0")} ${tl(EVENT_LABEL[event.type])} ${event.clock}`}
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
        inChain && !isActive && "border-space/50",
        !isReached && !isActive && "opacity-60",
        dimmed && "opacity-35",
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
            {tl(EVENT_LABEL[event.type])}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {event.clock}
            <span className="ml-1.5 opacity-60">{Math.round(event.confidence * 100)}%</span>
          </span>
        </div>
        {tl(event.title).toLowerCase() !== tl(EVENT_LABEL[event.type]).toLowerCase() && (
          <span className="text-sm text-foreground/90">{tl(event.title)}</span>
        )}
        {isActive && (
          <div className="mt-1 flex flex-col gap-1.5">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {tl(event.summary)}
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
                        <span className="text-muted-foreground">{tl(ev.label)}</span>
                        {ev.value.toFixed(ev.precision)}
                        {ev.unit}
                      </Badge>
                    </li>
                  )
                })}
              </ul>
            )}
            {incoming.length > 0 && (
              <ul className="flex flex-col gap-1 border-t border-border/60 pt-1.5" aria-label={t("因果来源", "Causal sources")}>
                {incoming.map((edge) => {
                  const source = eventById.get(edge.fromEventId)
                  return (
                    <li key={edge.id} className="flex flex-wrap items-center gap-x-2 font-mono text-[10px]">
                      <span className="uppercase text-foreground/70">
                        {source ? tl(EVENT_LABEL[source.type]) : ""}
                      </span>
                      <RelationTag relation={edge.relation} status={edge.status} confidence={edge.confidence} />
                      <StatusPill status={edge.status} />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          openWhy(edge.id)
                        }}
                        className="text-[9px] tracking-wider text-space/70 underline decoration-dotted hover:text-space focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        {t("为什么？", "WHY?")}
                      </button>
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
              {t("查看证据", "VIEW EVIDENCE")}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
