import { Badge } from "@/components/ui/badge"
import { Reality5Logo } from "./reality5-logo"

export function AppHeader({ gameLabel }: { gameLabel: string }) {
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
        <Badge variant="outline" className="gap-1.5 font-mono text-[10px]">
          <span className="size-1.5 rounded-full bg-space" aria-hidden />
          {gameLabel}
        </Badge>
        <Badge variant="secondary" className="font-mono text-[10px]">
          V0.1
        </Badge>
      </div>
    </header>
  )
}
