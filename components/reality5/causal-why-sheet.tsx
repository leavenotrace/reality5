"use client"

import { ArrowDown, Crosshair } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { CausalEdge, CausalEvidence } from "@/lib/reality5/types"
import { ClaimBadge, RelationTag, StatusPill, TestResult } from "./causal-ui"
import { useWorkspace } from "./workspace-context"

const fmt = (v: number | undefined, p = 1) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(p) : "—")
const signed = (v: number | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}` : "—"

/**
 * WHY DID THIS HAPPEN? Everything on this sheet was measured by the causal
 * engine for exactly one edge. Nothing is written for the story; the story
 * is written from this.
 */
export function CausalWhySheet() {
  const { whyEdgeId, openWhy, causalEdgeById, eventById, jumpToReality } = useWorkspace()
  const edge = whyEdgeId ? causalEdgeById.get(whyEdgeId) : undefined
  const from = edge ? eventById.get(edge.fromEventId) : undefined
  const to = edge ? eventById.get(edge.toEventId) : undefined

  return (
    <Sheet open={Boolean(edge)} onOpenChange={(open) => !open && openWhy(null)}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden bg-panel p-0 sm:max-w-md">
        {edge && from && to && (
          <>
            <SheetHeader className="border-b px-5 py-4">
              <p className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground">CAUSAL EDGE</p>
              <SheetTitle className="text-base tracking-[0.12em] uppercase">
                {edge.status === "TEMPORAL_ONLY" ? "Why not?" : "Why did this happen?"}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {edge.status === "TEMPORAL_ONLY"
                  ? "这两个事件只有时间先后。以下是引擎拒绝建立因果边的测量依据。"
                  : "以下每一个数字都是从追踪数据中为这条因果边单独测得的。"}
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="flex flex-col gap-5">
                <ol className="flex flex-col items-start gap-1 rounded-md border bg-panel-raised/40 px-3 py-2.5">
                  <li className="text-xs font-semibold tracking-wide">
                    {from.type.replace("_", " ")}
                    <span className="ml-2 font-mono text-[10px] text-muted-foreground">{from.clock}</span>
                  </li>
                  <li className="flex items-center gap-2 pl-1">
                    <ArrowDown className="size-3 text-muted-foreground" aria-hidden />
                    <RelationTag relation={edge.relation} status={edge.status} confidence={edge.confidence} />
                  </li>
                  <li className="text-xs font-semibold tracking-wide">
                    {to.type.replace("_", " ")}
                    <span className="ml-2 font-mono text-[10px] text-muted-foreground">{to.clock}</span>
                  </li>
                </ol>

                <Section title="OBSERVED REALITY" subtitle="观察到的现实">
                  <ul className="flex flex-col divide-y rounded-md border font-mono text-[11px]">
                    {edge.evidence.map((ev) => (
                      <EvidenceRow key={ev.metric} ev={ev} />
                    ))}
                  </ul>
                </Section>

                <Section title="TESTS" subtitle="因果检验">
                  <ul className="flex flex-col gap-1">
                    {edge.tests.map((t) => (
                      <li key={t.id} className="flex items-start justify-between gap-3 text-[11px]">
                        <span className="flex flex-col leading-4">
                          <span className="text-foreground">
                            {t.label.zh}
                            <span className="ml-1.5 font-mono text-[9px] tracking-wider text-muted-foreground">
                              {t.label.en.toUpperCase()}
                            </span>
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground">{t.detail}</span>
                        </span>
                        <TestResult result={t.result} />
                      </li>
                    ))}
                  </ul>
                </Section>

                {edge.counterfactual && (
                  <Section title="COUNTERFACTUAL" subtitle="反事实检验">
                    <div className="flex flex-col gap-2 rounded-md border border-dashed p-3 text-[11px]">
                      <p className="text-muted-foreground">{edge.counterfactual.premise.zh}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <dl className="flex flex-col gap-0.5">
                          <dt className="font-mono text-[9px] tracking-[0.2em] text-space">OBSERVED</dt>
                          {edge.counterfactual.observed.map((o) => (
                            <dd key={o.label.en} className="flex justify-between gap-2 font-mono text-[10px]">
                              <span className="truncate text-muted-foreground">{o.label.zh}</span>
                              <span className="tabular-nums">
                                {fmt(o.value)} {o.unit}
                              </span>
                            </dd>
                          ))}
                        </dl>
                        <dl className="flex flex-col gap-0.5">
                          <dt className="font-mono text-[9px] tracking-[0.2em] text-tactical">WITHOUT</dt>
                          {edge.counterfactual.estimated.map((o) => (
                            <dd key={o.label.en} className="flex justify-between gap-2 font-mono text-[10px]">
                              <span className="truncate text-muted-foreground">{o.label.zh}</span>
                              <span className="tabular-nums">
                                {fmt(o.value)} {o.unit}
                              </span>
                            </dd>
                          ))}
                        </dl>
                      </div>
                      <div className="flex items-center justify-between border-t pt-2 font-mono text-[10px]">
                        <span className="text-muted-foreground">
                          threshold {fmt(edge.counterfactual.threshold)} m reached?
                        </span>
                        <span className={cn("font-bold tracking-widest", edge.counterfactual.thresholdReached ? "text-tactical" : "text-space")}>
                          {edge.counterfactual.thresholdReached ? "YES" : "NO"}
                        </span>
                      </div>
                      <p className="text-foreground/90">{edge.counterfactual.conclusion.zh}</p>
                    </div>
                  </Section>
                )}

                <Section title="THREE KINDS OF CLAIM" subtitle="观察 · 推断 · 因果断言">
                  <ul className="flex flex-col gap-2">
                    {edge.claims.observation.map((o) => (
                      <li key={o.en} className="flex flex-col gap-1">
                        <ClaimBadge claim="OBSERVATION" />
                        <p className="text-xs leading-5 text-foreground/90">{o.zh}</p>
                      </li>
                    ))}
                    <li className="flex flex-col gap-1">
                      <ClaimBadge claim="INFERENCE" />
                      <p className="text-xs leading-5 text-foreground/90">{edge.claims.inference.zh}</p>
                    </li>
                    <li className="flex flex-col gap-1">
                      <ClaimBadge claim="CAUSAL_CLAIM" />
                      <p className={cn("text-xs leading-5", edge.status === "SUPPORTED" ? "text-foreground" : "text-muted-foreground")}>
                        {edge.claims.causalClaim.zh}
                      </p>
                    </li>
                  </ul>
                </Section>

                {edge.alternativeExplanation && (
                  <Section title="ALTERNATIVE EXPLANATION" subtitle="其他可能的解释">
                    <p className="text-xs leading-5 text-muted-foreground">{edge.alternativeExplanation.zh}</p>
                  </Section>
                )}

                {edge.factors.length > 0 && (
                  <Section title="CONFIDENCE FACTORS" subtitle="可解释的置信度组成">
                    <ul className="flex flex-col gap-1.5">
                      {edge.factors.map((f) => (
                        <li key={f.id} className="flex flex-col gap-0.5">
                          <div className="flex items-baseline justify-between font-mono text-[10px]">
                            <span className="text-muted-foreground">
                              {f.label.zh}
                              <span className="ml-1.5 text-[9px] tracking-wider opacity-70">{f.label.en.toUpperCase()}</span>
                            </span>
                            <span className="tabular-nums">
                              {f.score.toFixed(2)}
                              <span className="ml-1.5 opacity-60">{f.detail}</span>
                            </span>
                          </div>
                          <div className="h-1 w-full rounded-full bg-muted">
                            <div
                              className={cn("h-1 rounded-full", f.score >= 0.7 ? "bg-space" : f.score >= 0.4 ? "bg-tactical" : "bg-destructive")}
                              style={{ width: `${Math.round(f.score * 100)}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                <Section title="CONCLUSION" subtitle="结论">
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs">
                        {edge.status === "SUPPORTED" && "这条因果边成立。"}
                        {edge.status === "WEAK" && "机制可测量，但证据不足以断言完整因果。"}
                        {edge.status === "TEMPORAL_ONLY" && "不建立因果边：仅有时间顺序。"}
                      </span>
                      <StatusPill status={edge.status} className="w-fit" />
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground">CONFIDENCE</span>
                      <span className={cn("font-mono text-xl font-semibold tabular-nums", edge.status === "SUPPORTED" ? "text-space" : "text-muted-foreground")}>
                        {edge.status === "TEMPORAL_ONLY" ? "—" : edge.confidence.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </Section>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
              <p className="font-mono text-[9px] leading-4 tracking-[0.15em] text-muted-foreground">
                EVERY CLAIM IS REVERSIBLE
                <br />
                BACK TO PHYSICAL REALITY.
              </p>
              <Button
                onClick={() => jumpToReality(edge.id)}
                className="gap-2 font-mono text-[11px] tracking-wider"
              >
                <Crosshair data-icon="inline-start" />
                JUMP TO REALITY
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-baseline gap-2">
        <span className="font-mono text-[9px] tracking-[0.25em] text-space/80">{title}</span>
        <span className="text-[10px] text-muted-foreground">{subtitle}</span>
      </h3>
      {children}
    </section>
  )
}

function EvidenceRow({ ev }: { ev: CausalEvidence }) {
  const hasBeforeAfter = typeof ev.before === "number" && typeof ev.after === "number"
  return (
    <li className="flex flex-col gap-0.5 px-3 py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-foreground">
          {ev.label.zh}
          <span className="ml-1.5 text-[9px] tracking-wider text-muted-foreground">{ev.metric.toUpperCase()}</span>
        </span>
        <span className="shrink-0 tabular-nums">
          {hasBeforeAfter ? (
            <>
              <span className="text-muted-foreground">{fmt(ev.before)}</span>
              <span className="mx-1 text-muted-foreground">→</span>
              <span className="font-semibold">{fmt(ev.after)}</span>
              <span className="ml-1.5 text-space">{signed(ev.delta)}</span>
            </>
          ) : (
            <span className="font-semibold">{fmt(ev.value)}</span>
          )}
          {ev.unit && <span className="ml-1 text-muted-foreground">{ev.unit}</span>}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 text-[9px] tracking-wider text-muted-foreground">
        {ev.frameRange && (
          <span>
            FRAME {ev.frameRange[0]}
            {ev.frameRange[1] !== ev.frameRange[0] && `–${ev.frameRange[1]}`}
          </span>
        )}
        {typeof ev.timestamp === "number" && <span>T+{ev.timestamp.toFixed(1)}s</span>}
        {ev.players && ev.players.length > 0 && <span>{ev.players.join(" · ")}</span>}
        {ev.rule && <span className="text-space/80">RULE {ev.rule}</span>}
      </div>
    </li>
  )
}
