"use client"

import { Crosshair } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { traceEvent } from "@/lib/reality/rules"
import { useWorkspace } from "./workspace-context"

/**
 * EVIDENCE TRACE. Everything shown is read from the event the detector
 * emitted plus the detector's rule statement — no values are recomputed or
 * authored here.
 */
export function EvidenceTraceDialog() {
  const { traceEventId, openTrace, eventById, possession, seekToEvent } = useWorkspace()
  const event = traceEventId ? eventById.get(traceEventId) : undefined
  const open = Boolean(event)

  const trace = event
    ? traceEvent(event, possession.analysis.config, possession.tracking.meta.sampleRate)
    : null

  const rows = event && trace
    ? [
        { label: "EVENT", value: event.type },
        { label: "DETECTED AT", value: event.clock },
        { label: "ACTOR", value: event.actor ?? "—" },
        ...(event.target ? [{ label: "TARGET", value: event.target }] : []),
        { label: "RULE", value: trace.rule },
        { label: "OBSERVED", value: trace.observed },
        { label: "THRESHOLD", value: trace.threshold },
        { label: "CONFIDENCE", value: event.confidence.toFixed(2) },
        {
          label: "SOURCE",
          value:
            trace.frames.from === trace.frames.to
              ? `Tracking frame ${trace.frames.from}`
              : `Tracking frames ${trace.frames.from}–${trace.frames.to}`,
        },
      ]
    : []

  return (
    <Dialog open={open} onOpenChange={(o) => !o && openTrace(null)}>
      <DialogContent className="max-w-md bg-panel p-0">
        <DialogHeader className="border-b px-5 py-4">
          <p className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground">EVIDENCE TRACE</p>
          <DialogTitle className="text-base tracking-[0.12em] uppercase">
            {event?.type.replace("_", " ") ?? "Event"}
          </DialogTitle>
          <DialogDescription className="text-xs">{event?.title.zh}</DialogDescription>
        </DialogHeader>

        {event && trace && (
          <div className="flex flex-col gap-4 px-5 py-4">
            <dl className="flex flex-col divide-y rounded-md border font-mono text-xs">
              {rows.map((r) => (
                <div key={r.label} className="grid grid-cols-[110px_1fr] gap-3 px-3 py-1.5">
                  <dt className="text-[10px] tracking-[0.2em] text-muted-foreground">{r.label}</dt>
                  <dd className="tabular-nums break-words text-foreground">{r.value}</dd>
                </div>
              ))}
            </dl>

            <details className="rounded-md border px-3 py-2">
              <summary className="cursor-pointer font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
                FULL EVIDENCE RECORD · {Object.keys(event.evidence).length} KEYS
              </summary>
              <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 font-mono text-[11px]">
                {Object.entries(event.evidence).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="tabular-nums">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </details>

            <Button
              className="gap-1.5 font-mono text-xs tracking-[0.15em]"
              onClick={() => {
                seekToEvent(event.id)
                openTrace(null)
              }}
            >
              <Crosshair data-icon="inline-start" />
              JUMP TO REALITY
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
