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
import { EVENT_LABEL, useLocale } from "./locale-context"
import { useWorkspace } from "./workspace-context"

/**
 * EVIDENCE TRACE. Everything shown is read from the event the detector
 * emitted plus the detector's rule statement — no values are recomputed or
 * authored here.
 */
export function EvidenceTraceDialog() {
  const { traceEventId, openTrace, eventById, possession, seekToEvent } = useWorkspace()
  const { t, tl } = useLocale()
  const event = traceEventId ? eventById.get(traceEventId) : undefined
  const open = Boolean(event)

  const trace = event
    ? traceEvent(event, possession.analysis.config, possession.tracking.meta.sampleRate)
    : null

  const rows = event && trace
    ? [
        { label: t("事件", "EVENT"), value: event.type },
        { label: t("检测时刻", "DETECTED AT"), value: event.clock },
        { label: t("执行者", "ACTOR"), value: event.actor ?? "—" },
        ...(event.target ? [{ label: t("目标", "TARGET"), value: event.target }] : []),
        { label: t("规则", "RULE"), value: trace.rule },
        { label: t("观测值", "OBSERVED"), value: trace.observed },
        { label: t("阈值", "THRESHOLD"), value: trace.threshold },
        { label: t("置信度", "CONFIDENCE"), value: event.confidence.toFixed(2) },
        {
          label: t("来源", "SOURCE"),
          value:
            trace.frames.from === trace.frames.to
              ? t(`追踪帧 ${trace.frames.from}`, `Tracking frame ${trace.frames.from}`)
              : t(`追踪帧 ${trace.frames.from}–${trace.frames.to}`, `Tracking frames ${trace.frames.from}–${trace.frames.to}`),
        },
      ]
    : []

  return (
    <Dialog open={open} onOpenChange={(o) => !o && openTrace(null)}>
      <DialogContent className="max-w-md bg-panel p-0">
        <DialogHeader className="border-b px-5 py-4">
          <p className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground">{t("证据追溯", "EVIDENCE TRACE")}</p>
          <DialogTitle className="text-base tracking-[0.12em] uppercase">
            {event ? tl(EVENT_LABEL[event.type]) : t("事件", "Event")}
          </DialogTitle>
          <DialogDescription className="text-xs">{event ? tl(event.title) : ""}</DialogDescription>
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
                {t("完整证据记录", "FULL EVIDENCE RECORD")} · {Object.keys(event.evidence).length} {t("个字段", "KEYS")}
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
              {t("跳转到现实", "JUMP TO REALITY")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
