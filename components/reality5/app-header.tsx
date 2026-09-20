"use client"

import { Bug } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Reality5Logo } from "./reality5-logo"
import { useWorkspace } from "./workspace-context"

export function AppHeader() {
  const { possession, debugOpen, toggleDebug } = useWorkspace()
  const { dataSource, game } = possession

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

      <div className="flex items-center justify-end gap-2">
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
        <Badge variant="outline" className="gap-1.5 font-mono text-[10px]">
          <span className="size-1.5 rounded-full bg-space" aria-hidden />
          {game.label}
        </Badge>
        <Badge variant="secondary" className="font-mono text-[10px]">
          V0.2
        </Badge>
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
  tone: "tactical" | "space"
}) {
  return (
    <div className="flex flex-col leading-none">
      <span className="text-[9px] tracking-[0.2em] text-muted-foreground">{label}</span>
      <span className="mt-1 flex items-center gap-1.5 font-mono text-[10px] font-medium">
        <span
          className={cn("size-1.5 rounded-full", tone === "space" ? "bg-space" : "bg-tactical")}
          aria-hidden
        />
        {value}
      </span>
    </div>
  )
}
