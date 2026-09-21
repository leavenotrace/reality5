"use client"

import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocale } from "./locale-context"
import { useWorkspace } from "./workspace-context"

/**
 * Loaded realities. Switching swaps ONLY the Possession the workspace renders;
 * every panel re-reads from the engine output. Entries appear here from any
 * source — samples, uploaded JSON, later NBA / AWS — indistinguishably.
 */
export function RealityTestPanel() {
  const { possessions, possessionId, setPossession, setAnalyzeOpen } = useWorkspace()
  const { t } = useLocale()

  return (
    <aside
      aria-label={t("已加载的现实", "Loaded realities")}
      className="my-3 flex w-52 shrink-0 flex-col gap-2 self-start rounded-md border border-border bg-black/80 p-3 font-mono text-[11px] leading-5 backdrop-blur-sm"
    >
      <p className="text-[9px] tracking-[0.2em] text-muted-foreground">{t("现实", "REALITIES")} · {possessions.length}</p>
      <div role="radiogroup" aria-label={t("回合", "Possession")} className="flex flex-col gap-1">
        {possessions.map((p) => {
          const active = p.id === possessionId
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setPossession(p.id)}
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
              <span className="flex min-w-0 flex-col leading-4">
                <span className="truncate font-semibold tracking-wider">{p.label}</span>
                <span className="text-[9px] tracking-wider text-muted-foreground">
                  {p.dataSource.source} · {p.analysis.events.length} {t("个事件", "EVENTS")}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={() => setAnalyzeOpen(true)}
        className="flex items-center gap-1.5 rounded-sm border border-dashed border-border px-2 py-1.5 text-[10px] tracking-wider text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Plus className="size-3" aria-hidden />
        {t("分析新回合", "ANALYZE NEW POSSESSION")}
      </button>
    </aside>
  )
}
