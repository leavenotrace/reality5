"use client"

import { Bug, Download, GitCompareArrows, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Reality5Logo } from "./reality5-logo"
import { useWorkspace } from "./workspace-context"

export function AppHeader() {
  const {
    possession,
    possessions,
    debugOpen,
    toggleDebug,
    setAnalyzeOpen,
    setCompareOpen,
    exportCurrent,
  } = useWorkspace()
  const { dataSource } = possession
  const integrity = possession.analysis.integrity

  return (
    <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b bg-panel px-4">
      <div className="flex items-center gap-3">
        <Reality5Logo />
        <div className="hidden flex-col leading-none lg:flex">
          <span className="text-sm font-semibold tracking-tight">Reality5</span>
          <span className="text-[10px] text-muted-foreground">
            让 AI 读懂赛场，让数据连接 Reality
          </span>
        </div>
        <div className="ml-3 hidden items-center gap-3 border-l pl-3 xl:flex">
          <StatusIndicator label="DATA SOURCE" value={dataSource.source} tone="tactical" />
          <StatusIndicator label="ENGINE" value={dataSource.engine} tone="space" />
          <StatusIndicator
            label="REALITY INTEGRITY"
            value={integrity.status}
            tone={integrity.status === "VALID" ? "space" : integrity.status === "WARNING" ? "tactical" : "destructive"}
          />
        </div>
      </div>

      <div className="flex flex-col items-center leading-none">
        <h1 className="text-sm font-semibold tracking-[0.12em] uppercase">
          Basketball Reality Engine
        </h1>
        <p className="mt-1 text-[10px] tracking-[0.3em] text-muted-foreground">
          MORE THAN STATS
        </p>
      </div>

      <div className="flex items-center justify-end gap-1.5">
        <Button
          size="xs"
          variant={debugOpen ? "secondary" : "ghost"}
          onClick={toggleDebug}
          aria-pressed={debugOpen}
          className={cn("gap-1.5 font-mono text-[10px] tracking-wider", debugOpen && "text-space")}
        >
          <Bug data-icon="inline-start" />
          REALITY DEBUG
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={exportCurrent}
          className="gap-1.5 font-mono text-[10px] tracking-wider"
        >
          <Download data-icon="inline-start" />
          EXPORT ANALYSIS
        </Button>
        <Button
          size="xs"
          variant="ghost"
          disabled={possessions.length < 2}
          onClick={() => setCompareOpen(true)}
          className="gap-1.5 font-mono text-[10px] tracking-wider"
        >
          <GitCompareArrows data-icon="inline-start" />
          COMPARE REALITIES
        </Button>
        <Button
          size="xs"
          onClick={() => setAnalyzeOpen(true)}
          className="ml-1 gap-1 font-mono text-[10px] tracking-wider"
        >
          <Plus data-icon="inline-start" />
          ANALYZE NEW POSSESSION
        </Button>
      </div>
    </header>
  )
}

function StatusIndicator({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "tactical" | "space" | "destructive"
}) {
  return (
    <div className="flex flex-col leading-none">
      <span className="text-[9px] tracking-[0.2em] text-muted-foreground">{label}</span>
      <span className="mt-1 flex items-center gap-1.5 font-mono text-[10px] font-medium">
        <span
          className={cn(
            "size-1.5 rounded-full",
            tone === "space" && "bg-space",
            tone === "tactical" && "bg-tactical",
            tone === "destructive" && "bg-destructive",
          )}
          aria-hidden
        />
        {value}
      </span>
    </div>
  )
}
