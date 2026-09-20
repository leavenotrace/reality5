"use client"

import { ArrowDown, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useWorkspace } from "./workspace-context"

/**
 * Temporary V0.2 validation surface. The selector swaps ONLY the tracking
 * dataset; everything shown elsewhere is recomputed by the engine. The test
 * result compares the two engine outputs — nothing here is authored.
 */
export function RealityTestPanel() {
  const { scenarios, scenarioId, setScenario, realityTest } = useWorkspace()

  return (
    <aside
      aria-label="Reality Test"
      className="my-3 flex w-52 shrink-0 flex-col gap-3 self-start rounded-md border border-border bg-black/80 p-3 font-mono text-[11px] leading-5 backdrop-blur-sm"
    >
      <div>
        <p className="text-[9px] tracking-[0.2em] text-muted-foreground">SCENARIO</p>
        <div role="radiogroup" aria-label="Scenario" className="mt-1 flex flex-col gap-1">
          {scenarios.map((s) => {
            const active = s.id === scenarioId
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setScenario(s.id)}
                className={cn(
                  "flex items-start gap-2 rounded-sm border px-2 py-1.5 text-left transition-colors",
                  "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  active
                    ? "border-tactical/70 bg-tactical/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full border",
                    active ? "border-tactical bg-tactical" : "border-current",
                  )}
                />
                <span className="flex flex-col leading-4">
                  <span className="font-semibold tracking-wider">{s.label.en}</span>
                  <span className="text-[10px] text-muted-foreground">{s.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="border-t border-border/50 pt-2">
        <div className="flex items-center justify-between">
          <p className="text-[9px] tracking-[0.2em] text-muted-foreground">REALITY TEST</p>
          <span
            className={cn(
              "rounded-sm px-1.5 py-0.5 text-[10px] font-bold tracking-widest",
              realityTest.pass ? "bg-space/20 text-space" : "bg-destructive/20 text-destructive",
            )}
          >
            {realityTest.pass ? "PASS" : "FAIL"}
          </span>
        </div>
        <ol className="mt-1.5 flex flex-col">
          {realityTest.steps.map((step, i) => (
            <li key={step.id} className="flex flex-col">
              <div className="flex items-center gap-1.5">
                {step.changed ? (
                  <Check className="size-3 shrink-0 text-space" aria-hidden />
                ) : (
                  <X className="size-3 shrink-0 text-destructive" aria-hidden />
                )}
                <span className={cn(step.changed ? "text-foreground" : "text-destructive")}>
                  {step.label.en}
                </span>
              </div>
              <span className="pl-[18px] text-[9px] leading-3 tracking-wider text-muted-foreground">
                {step.detail}
              </span>
              {i < realityTest.steps.length - 1 && (
                <ArrowDown className="my-0.5 ml-[3px] size-2.5 text-muted-foreground/50" aria-hidden />
              )}
            </li>
          ))}
        </ol>
        <p className="mt-2 border-t border-border/50 pt-1.5 text-[9px] leading-4 tracking-wider text-muted-foreground">
          Reality must have the power to change the conclusion.
        </p>
      </div>
    </aside>
  )
}
