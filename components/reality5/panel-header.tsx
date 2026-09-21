import type { ReactNode } from "react"

export function PanelHeader({
  eyebrow,
  title,
  trailing,
}: {
  eyebrow: string
  title: string
  trailing?: ReactNode
}) {
  return (
    <header className="flex h-10 shrink-0 items-center gap-3 border-b px-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[11px] font-semibold tracking-[0.18em] whitespace-nowrap text-foreground">
          {eyebrow}
        </h2>
        <span className="text-[11px] text-muted-foreground">{title}</span>
      </div>
      {trailing && <div className="ml-auto flex items-center">{trailing}</div>}
    </header>
  )
}
