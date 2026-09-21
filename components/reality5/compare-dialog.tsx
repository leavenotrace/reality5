"use client"

import { Check, X } from "lucide-react"
import { useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { compareRealities } from "@/lib/reality/compare"
import { runRealityTest } from "@/lib/reality/reality-test"
import { cn } from "@/lib/utils"
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

  const left = possessions.find((p) => p.id === (leftId ?? possessions[0]?.id)) ?? possessions[0]
  const defaultRight =
    possessions.find((p) => p.id === possessionId && p.id !== left?.id) ??
    possessions.find((p) => p.id !== left?.id)
  const right = possessions.find((p) => p.id === rightId && p.id !== left?.id) ?? defaultRight

  const rows = useMemo(
    () => (left && right ? compareRealities(left.analysis, right.analysis) : []),
    [left, right],
  )
  const test = useMemo(
    () => (left && right ? runRealityTest(left.analysis, right.analysis) : null),
    [left, right],
  )

  return (
    <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
      <DialogContent className="max-w-2xl bg-panel p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-4">
          <p className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground">
            REALITY COMPARISON
          </p>
          <DialogTitle className="text-base tracking-[0.12em] uppercase">Compare Realities</DialogTitle>
          <DialogDescription className="text-xs">
            只显示事实差异。两列都由同一个 Reality Engine 从各自的追踪数据测得。
          </DialogDescription>
        </DialogHeader>

        {left && right ? (
          <div className="flex flex-col gap-4 px-5 py-4">
            <div className="grid grid-cols-[1fr_1fr_1fr] items-end gap-3 font-mono text-[10px]">
              <span className="text-muted-foreground">FACT</span>
              <Picker label="REALITY A" value={left.id} options={possessions} onChange={setLeftId} />
              <Picker
                label="REALITY B"
                value={right.id}
                options={possessions.filter((p) => p.id !== left.id)}
                onChange={setRightId}
              />
            </div>

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
                  <span className="text-[9px] tracking-[0.2em] text-muted-foreground">REALITY TEST</span>
                  <span
                    className={cn(
                      "rounded-sm px-1.5 py-0.5 text-[10px] font-bold tracking-widest",
                      test.pass ? "bg-space/20 text-space" : "bg-destructive/20 text-destructive",
                    )}
                  >
                    {test.pass ? "PASS" : "FAIL"}
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
                        <span>{s.label.en}</span>
                        <span className="text-[9px] text-muted-foreground">{s.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-center font-mono text-xs font-bold tracking-[0.25em] text-foreground">
              SAME ENGINE. <span className="text-tactical">DIFFERENT REALITY.</span>{" "}
              <span className="text-space">DIFFERENT CONCLUSION.</span>
            </p>
          </div>
        ) : (
          <p className="px-5 py-8 text-center text-xs text-muted-foreground">
            需要至少两个已分析的回合才能比较。
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
