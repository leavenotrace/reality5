"use client"

import { ArrowDown, Check, X } from "lucide-react"
import { useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { compareCausalStructure, compareRealities } from "@/lib/reality/compare"
import { runRealityTest } from "@/lib/reality/reality-test"
import { cn } from "@/lib/utils"
import { EVENT_LABEL, RELATION_LABEL, STATUS_LABEL, useLocale } from "./locale-context"
import { useWorkspace } from "./workspace-context"

/**
 * REALITY COMPARISON. Both columns are measured from engine output; nothing
 * is authored. The Reality Test below is the V0.2 invariant: a change in
 * tracking must propagate all the way to a different explanation.
 */
export function CompareDialog() {
  const { compareOpen, setCompareOpen, possessions, possessionId } = useWorkspace()
  const [leftId, setLeftId] = useState<string | null>(null)
  const [rightId, setRightId] = useState<string | null>(null)
  const { t, tl } = useLocale()

  const left = possessions.find((p) => p.id === (leftId ?? possessions[0]?.id)) ?? possessions[0]
  const defaultRight =
    possessions.find((p) => p.id === possessionId && p.id !== left?.id) ??
    possessions.find((p) => p.id !== left?.id)
  const right = possessions.find((p) => p.id === rightId && p.id !== left?.id) ?? defaultRight

  const rows = useMemo(
    () => (left && right ? compareRealities(left.analysis, right.analysis) : []),
    [left, right],
  )
  const causal = useMemo(
    () => (left && right ? compareCausalStructure(left.analysis, right.analysis) : null),
    [left, right],
  )
  const test = useMemo(
    () => (left && right ? runRealityTest(left.analysis, right.analysis) : null),
    [left, right],
  )

  return (
    <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
      <DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col gap-0 overflow-hidden bg-panel p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-4">
          <p className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground">
            {t("现实对比", "REALITY COMPARISON")}
          </p>
          <DialogTitle className="text-base tracking-[0.12em] uppercase">{t("对比两个现实", "Compare Realities")}</DialogTitle>
          <DialogDescription className="text-xs">
            {t("只显示事实差异。两列都由同一个 Reality Engine 从各自的追踪数据测得。", "Facts only. Both columns are measured by the same Reality Engine from their own tracking data.")}
          </DialogDescription>
        </DialogHeader>

        {left && right ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-[1fr_1fr_1fr] items-end gap-3 font-mono text-[10px]">
              <span className="text-muted-foreground">{t("事实", "FACT")}</span>
              <Picker label={t("现实 A", "REALITY A")} value={left.id} options={possessions} onChange={setLeftId} />
              <Picker
                label={t("现实 B", "REALITY B")}
                value={right.id}
                options={possessions.filter((p) => p.id !== left.id)}
                onChange={setRightId}
              />
            </div>

            {causal && (
              <section className="flex flex-col gap-3 rounded-md border border-space/40 p-3" aria-label={t("因果结构对比", "Causal structure comparison")}>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[9px] tracking-[0.25em] text-space">{t("因果结构", "CAUSAL STRUCTURE")}</span>
                  <span className="text-[10px] text-muted-foreground">{t("不只比较事件，比较因果结构", "Compare causal structure, not just events")}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: t("现实 A", "REALITY A"), chain: causal.chainA },
                    { label: t("现实 B", "REALITY B"), chain: causal.chainB },
                  ].map((side) => (
                    <div key={side.label} className="flex flex-col gap-1 rounded-md bg-panel-raised/40 p-2.5">
                      <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground">{side.label}</span>
                      {side.chain.length === 0 ? (
                        <span className="font-mono text-[10px] text-muted-foreground">{t("无事件", "no events")}</span>
                      ) : (
                        <ol className="flex flex-col">
                          {side.chain.map((type, i) => (
                            <li key={`${type}-${i}`} className="flex flex-col">
                              <span className="font-mono text-[11px] font-semibold tracking-wide">{tl(EVENT_LABEL[type]) || type}</span>
                              {i < side.chain.length - 1 && (
                                <ArrowDown className="my-0.5 size-3 text-space" aria-hidden />
                              )}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  ))}
                </div>

                <dl className="flex flex-col divide-y rounded-md border font-mono text-[11px]">
                  {causal.facts.map((row) => (
                    <div key={row.label} className="grid grid-cols-[1.2fr_1fr_1fr] gap-3 px-3 py-1.5">
                      <dt className="text-muted-foreground">{row.label}</dt>
                      <dd className={cn("tabular-nums", row.differs ? "text-foreground" : "text-muted-foreground")}>{row.a}</dd>
                      <dd className={cn("tabular-nums", row.differs ? "font-semibold text-tactical" : "text-muted-foreground")}>{row.b}</dd>
                    </div>
                  ))}
                </dl>

                <ul className="flex flex-col divide-y rounded-md border font-mono text-[11px]" aria-label={t("因果边差异", "Causal edge differences")}>
                  {causal.edges.map((e) => (
                    <li key={e.key} className="grid grid-cols-[1.2fr_1fr_1fr] gap-3 px-3 py-1.5">
                      <span className="text-muted-foreground">{e.label}</span>
                      <span className={cn(e.statusA === "SUPPORTED" ? "text-space" : e.statusA === "WEAK" ? "text-tactical" : "text-muted-foreground/60")}>
                        {e.statusA ? (e.statusA === "TEMPORAL_ONLY" ? t("仅时间先后 · 无因果边", "TEMPORAL ONLY · NO EDGE") : `${e.relationA ? tl(RELATION_LABEL[e.relationA]) : ""} · ${tl(STATUS_LABEL[e.statusA])}`) : "—"}
                      </span>
                      <span className={cn(e.differs && "font-semibold", e.statusB === "SUPPORTED" ? "text-space" : e.statusB === "WEAK" ? "text-tactical" : "text-muted-foreground/60")}>
                        {e.statusB ? (e.statusB === "TEMPORAL_ONLY" ? t("仅时间先后 · 无因果边", "TEMPORAL ONLY · NO EDGE") : `${e.relationB ? tl(RELATION_LABEL[e.relationB]) : ""} · ${tl(STATUS_LABEL[e.statusB])}`) : "—"}
                      </span>
                    </li>
                  ))}
                </ul>

                {causal.edges.some((e) => e.consequence) && (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground">{t("因果后果", "CAUSAL CONSEQUENCE")}</span>
                    <ul className="flex flex-col gap-0.5">
                      {causal.edges.filter((e) => e.consequence).map((e) => (
                        <li key={e.key} className="font-mono text-[11px] text-tactical">
                          {e.consequence}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            <dl className="flex flex-col divide-y rounded-md border font-mono text-xs">
              {rows.map((row) => (
                <div key={row.label} className="grid grid-cols-[1fr_1fr_1fr] gap-3 px-3 py-1.5">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className={cn("tabular-nums", row.differs ? "text-foreground" : "text-muted-foreground")}>
                    {row.a}
                  </dd>
                  <dd
                    className={cn(
                      "tabular-nums",
                      row.differs ? "font-semibold text-tactical" : "text-muted-foreground",
                    )}
                  >
                    {row.b}
                  </dd>
                </div>
              ))}
            </dl>

            {test && (
              <div className="flex flex-col gap-1.5 rounded-md border p-3 font-mono text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] tracking-[0.2em] text-muted-foreground">{t("现实测试", "REALITY TEST")}</span>
                  <span
                    className={cn(
                      "rounded-sm px-1.5 py-0.5 text-[10px] font-bold tracking-widest",
                      test.pass ? "bg-space/20 text-space" : "bg-destructive/20 text-destructive",
                    )}
                  >
                    {test.pass ? t("通过", "PASS") : t("未通过", "FAIL")}
                  </span>
                </div>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {test.steps.map((s) => (
                    <li key={s.id} className="flex items-start gap-1.5">
                      {s.changed ? (
                        <Check className="mt-0.5 size-3 shrink-0 text-space" aria-hidden />
                      ) : (
                        <X className="mt-0.5 size-3 shrink-0 text-destructive" aria-hidden />
                      )}
                      <span className="flex flex-col leading-4">
                        <span>{tl(s.label)}</span>
                        <span className="text-[9px] text-muted-foreground">{s.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-center font-mono text-xs font-bold tracking-[0.25em] text-foreground">
              {t("同一个引擎。", "SAME ENGINE.")} <span className="text-tactical">{t("不同的现实。", "DIFFERENT REALITY.")}</span>{" "}
              <span className="text-space">{t("不同的因果结构。", "DIFFERENT CAUSAL STRUCTURE.")}</span>
            </p>
          </div>
        ) : (
          <p className="px-5 py-8 text-center text-xs text-muted-foreground">
            {t("需要至少两个已分析的回合才能比较。", "At least two analyzed possessions are required to compare.")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Picker({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { id: string; label: string }[]
  onChange: (id: string) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[9px] tracking-[0.2em] text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 rounded-sm border bg-background px-1.5 text-[11px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
