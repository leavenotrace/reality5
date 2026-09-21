"use client"

import { Bug, Download, GitCompareArrows, Languages, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { INTEGRITY_LABEL, useLocale } from "./locale-context"
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
  const { t, tl, locale, setLocale } = useLocale()
  const { dataSource } = possession
  const integrity = possession.analysis.integrity

  return (
    <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b bg-panel px-4">
      <div className="flex items-center gap-3">
        <Reality5Logo />
        <div className="hidden flex-col leading-none whitespace-nowrap lg:flex">
          <span className="text-sm font-semibold tracking-tight">Reality5</span>
          <span className="text-[10px] text-muted-foreground">
            {t("让 AI 读懂赛场，让数据连接 Reality", "Teach AI to read the court. Connect data to reality.")}
          </span>
        </div>
        <div className="ml-3 hidden items-center gap-3 border-l pl-3 2xl:flex">
          <StatusIndicator label={t("数据源", "DATA SOURCE")} value={dataSource.source} tone="tactical" />
          <StatusIndicator label={t("引擎", "ENGINE")} value={dataSource.engine} tone="space" />
          <StatusIndicator
            label={t("现实完整性", "REALITY INTEGRITY")}
            value={tl(INTEGRITY_LABEL[integrity.status]) || integrity.status}
            tone={integrity.status === "VALID" ? "space" : integrity.status === "WARNING" ? "tactical" : "destructive"}
          />
        </div>
      </div>

      <div className="flex flex-col items-center leading-none">
        <h1 className="text-sm font-semibold tracking-[0.12em] uppercase whitespace-nowrap">
          {t("篮球现实引擎", "Basketball Reality Engine")}
        </h1>
        <p className="mt-1 text-[10px] tracking-[0.3em] whitespace-nowrap text-muted-foreground">
          {t("不止于数据", "MORE THAN STATS")}
        </p>
      </div>

      <div className="flex items-center justify-end gap-1.5">
        <div
          role="group"
          aria-label={t("界面语言", "Interface language")}
          className="mr-1 flex items-center rounded-sm border font-mono text-[10px] tracking-wider"
        >
          <Languages className="ml-1.5 size-3 text-muted-foreground" aria-hidden />
          {(["zh", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLocale(l)}
              aria-pressed={locale === l}
              className={cn(
                "px-2 py-1 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                locale === l ? "text-space" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l === "zh" ? "中" : "EN"}
            </button>
          ))}
        </div>
        <Button
          size="xs"
          variant={debugOpen ? "secondary" : "ghost"}
          onClick={toggleDebug}
          aria-pressed={debugOpen}
          className={cn("gap-1.5 font-mono text-[10px] tracking-wider", debugOpen && "text-space")}
        >
          <Bug data-icon="inline-start" />
          {t("现实调试", "REALITY DEBUG")}
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={exportCurrent}
          className="gap-1.5 font-mono text-[10px] tracking-wider"
        >
          <Download data-icon="inline-start" />
          {t("导出分析", "EXPORT ANALYSIS")}
        </Button>
        <Button
          size="xs"
          variant="ghost"
          disabled={possessions.length < 2}
          onClick={() => setCompareOpen(true)}
          className="gap-1.5 font-mono text-[10px] tracking-wider"
        >
          <GitCompareArrows data-icon="inline-start" />
          {t("对比现实", "COMPARE REALITIES")}
        </Button>
        <Button
          size="xs"
          onClick={() => setAnalyzeOpen(true)}
          className="ml-1 gap-1 font-mono text-[10px] tracking-wider"
        >
          <Plus data-icon="inline-start" />
          {t("分析新回合", "ANALYZE NEW POSSESSION")}
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
      <span className="text-[9px] tracking-[0.2em] whitespace-nowrap text-muted-foreground">{label}</span>
      <span className="mt-1 flex items-center gap-1.5 font-mono text-[10px] font-medium whitespace-nowrap">
        <span
          className={cn(
            "size-1.5 rounded-full",
            tone === "tactical" && "bg-tactical",
            tone === "space" && "bg-space",
            tone === "destructive" && "bg-destructive",
          )}
          aria-hidden
        />
        {value}
      </span>
    </div>
  )
}
