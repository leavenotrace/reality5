"use client"

import { useMemo, useRef } from "react"
import { cn } from "@/lib/utils"
import { clockAt } from "@/lib/reality5/tracking"
import { createTimelineScale } from "@/lib/reality5/timeline-scale"
import type { EventType } from "@/lib/reality5/types"
import { PanelHeader } from "./panel-header"
import { useWorkspace } from "./workspace-context"

const TYPE_DOT: Record<EventType, string> = {
  DRIVE: "bg-movement border-movement",
  HELP_DEFENSE: "bg-tactical border-tactical",
  DEFENSIVE_COLLAPSE: "bg-tactical border-tactical",
  OPEN_SPACE: "bg-space border-space",
  PASS: "bg-movement border-movement",
  OPEN_THREE: "bg-space border-space",
}

const TIMELINE_LABEL: Record<EventType, string> = {
  DRIVE: "突破",
  HELP_DEFENSE: "协防",
  DEFENSIVE_COLLAPSE: "防守收缩",
  OPEN_SPACE: "空位形成",
  PASS: "传球",
  OPEN_THREE: "三分出手",
}

export function RealityTimeline() {
  const {
    possession,
    currentTime,
    seek,
    seekToEvent,
    activeEvent,
    hoverEvent,
    hoveredEventId,
  } = useWorkspace()
  const trackRef = useRef<HTMLDivElement>(null)
  const duration = possession.video.duration
  const scale = useMemo(
    () => createTimelineScale(possession.events, duration),
    [possession.events, duration],
  )
  const pct = (t: number) => `${scale.toRatio(t) * 100}%`

  const onTrackPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const ratio = Math.min(Math.max(0, (e.clientX - rect.left) / rect.width), 1)
    seek(scale.toTime(ratio))
  }

  const ticks = Array.from({ length: Math.floor(duration) + 1 }, (_, i) => i)

  return (
    <section
      aria-label="Reality Timeline"
      className="flex shrink-0 flex-col overflow-hidden rounded-lg border bg-panel"
    >
      <PanelHeader
        eyebrow="REALITY TIMELINE"
        title="事件时间轴"
        trailing={
          <div className="flex items-center gap-3">
            <span className="rounded-sm border border-movement/40 px-1.5 py-0.5 font-mono text-[10px] text-movement">
              FOCUS ×{scale.focus.magnification.toFixed(1)} · {clockAt(possession, scale.focus.from)}–
              {clockAt(possession, scale.focus.to)}
            </span>
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {clockAt(possession, 0)} → {clockAt(possession, duration)}
            </span>
          </div>
        }
      />
      <div className="px-4 pt-7 pb-8">
        <div className="relative">
          {/* Labels above (odd events) */}
          {possession.events.map((event, i) =>
            i % 2 === 0 ? (
              <TimelineLabel
                key={event.id}
                left={pct(event.t)}
                clock={event.clock}
                label={TIMELINE_LABEL[event.type]}
                position="above"
                active={activeEvent?.id === event.id}
                hovered={hoveredEventId === event.id}
              />
            ) : null,
          )}

          <div
            ref={trackRef}
            role="slider"
            tabIndex={0}
            aria-label="播放进度"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={Number(currentTime.toFixed(1))}
            aria-valuetext={clockAt(possession, currentTime)}
            onPointerDown={onTrackPointer}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") seek(currentTime + 0.1)
              if (e.key === "ArrowLeft") seek(currentTime - 0.1)
            }}
            className="relative h-8 cursor-pointer focus-visible:outline-none"
          >
            <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-muted" />
            <div
              className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-movement/70"
              style={{ width: pct(currentTime) }}
            />
            {ticks.map((s) => (
              <span
                key={s}
                aria-hidden
                className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-foreground/20"
                style={{ left: pct(s) }}
              />
            ))}

            {possession.events.map((event) => {
              const isActive = activeEvent?.id === event.id
              const reached = event.t <= currentTime + 0.02
              return (
                <button
                  key={event.id}
                  type="button"
                  aria-label={`${event.clock} ${TIMELINE_LABEL[event.type]}`}
                  aria-current={isActive ? "step" : undefined}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    seekToEvent(event.id)
                  }}
                  onMouseEnter={() => hoverEvent(event.id)}
                  onMouseLeave={() => hoverEvent(null)}
                  className={cn(
                    "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-transform",
                    "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    reached ? TYPE_DOT[event.type] : "border-muted-foreground bg-panel",
                    isActive && "scale-150 ring-2 ring-foreground/30",
                    hoveredEventId === event.id && !isActive && "scale-125",
                  )}
                  style={{ left: pct(event.t) }}
                />
              )
            })}

            <div
              className="pointer-events-none absolute top-0 h-8 w-px -translate-x-1/2 bg-foreground"
              style={{ left: pct(currentTime) }}
            >
              <span className="absolute -top-0.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-foreground" />
            </div>
          </div>

          {/* Labels below (even events) */}
          {possession.events.map((event, i) =>
            i % 2 === 1 ? (
              <TimelineLabel
                key={event.id}
                left={pct(event.t)}
                clock={event.clock}
                label={TIMELINE_LABEL[event.type]}
                position="below"
                active={activeEvent?.id === event.id}
                hovered={hoveredEventId === event.id}
              />
            ) : null,
          )}
        </div>
      </div>
    </section>
  )
}

function TimelineLabel({
  left,
  clock,
  label,
  position,
  active,
  hovered,
}: {
  left: string
  clock: string
  label: string
  position: "above" | "below"
  active: boolean
  hovered: boolean
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute flex -translate-x-1/2 flex-col items-center leading-none whitespace-nowrap",
        position === "above" ? "-top-6" : "-bottom-7",
      )}
      style={{ left }}
    >
      <span
        className={cn(
          "font-mono text-[10px] tabular-nums",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {clock}
      </span>
      <span
        className={cn(
          "mt-0.5 text-[11px]",
          active
            ? "font-semibold text-foreground"
            : hovered
              ? "text-foreground/80"
              : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  )
}
