"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { PanelHeader } from "./panel-header"
import { useWorkspace } from "./workspace-context"

export function EvidencePanel() {
  const {
    possession,
    focusedEvidenceId,
    focusEvidence,
    seekToEvent,
    activeEvent,
    eventById,
    currentTime,
  } = useWorkspace()

  return (
    <section
      aria-label="Evidence 结构化证据"
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-panel"
    >
      <PanelHeader
        eyebrow="EVIDENCE"
        title="结构化证据"
        trailing={
          <span className="font-mono text-[10px] text-muted-foreground">
            {possession.evidence.length} METRICS
          </span>
        }
      />
      <ul className="flex flex-1 flex-col divide-y overflow-auto">
        {possession.evidence.map((ev) => {
          const source = eventById.get(ev.sourceEventId)
          const focused = focusedEvidenceId === ev.id
          const linkedToActive = activeEvent?.evidenceIds.includes(ev.id) ?? false
          const measured = source ? source.t <= currentTime + 0.02 : false
          return (
            <li key={ev.id}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => seekToEvent(ev.sourceEventId)}
                      onMouseEnter={() => focusEvidence(ev.id)}
                      onMouseLeave={() => focusEvidence(null)}
                      onFocus={() => focusEvidence(ev.id)}
                      onBlur={() => focusEvidence(null)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                        focused
                          ? "bg-tactical/10"
                          : linkedToActive
                            ? "bg-panel-raised/70"
                            : "hover:bg-panel-raised",
                      )}
                    />
                  }
                >
                  <span
                    className={cn(
                      "h-6 w-0.5 rounded-full",
                      focused
                        ? "bg-tactical"
                        : linkedToActive
                          ? "bg-foreground/50"
                          : "bg-border",
                    )}
                    aria-hidden
                  />
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="text-xs font-medium">{ev.label.en}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {ev.label.zh} · {source?.clock}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "font-mono text-sm font-semibold tabular-nums",
                      measured ? "text-foreground" : "text-muted-foreground/60",
                      focused && "text-tactical",
                    )}
                  >
                    {ev.value.toFixed(ev.precision)}
                    {ev.unit && (
                      <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                        {ev.unit}
                      </span>
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-64">
                  {ev.description.zh}
                </TooltipContent>
              </Tooltip>
            </li>
          )
        })}
      </ul>
      <p className="border-t px-3 py-2 text-[10px] tracking-wider text-muted-foreground">
        REALITY FIRST · EVIDENCE SECOND · CAUSALITY THIRD · LANGUAGE LAST
      </p>
    </section>
  )
}
