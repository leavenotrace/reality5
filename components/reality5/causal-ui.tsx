"use client"

import { cn } from "@/lib/utils"
import type { CausalRelation, CausalStatus, ClaimType } from "@/lib/reality5/types"

export const RELATION_ZH: Record<CausalRelation, string> = {
  TRIGGERED: "触发",
  CREATED: "创造",
  ENABLED: "使成立",
  CONSTRAINED: "限制",
  PRECEDED: "先于",
  TEMPORAL_ONLY: "仅时间先后",
}

export const STATUS_ZH: Record<CausalStatus, string> = {
  SUPPORTED: "成立",
  WEAK: "证据不足",
  TEMPORAL_ONLY: "仅时间先后",
}

export const CLAIM_META: Record<ClaimType, { zh: string; en: string; className: string; dot: string }> = {
  OBSERVATION: {
    zh: "观察",
    en: "OBSERVATION",
    className: "border-border text-foreground/80",
    dot: "bg-foreground/60",
  },
  INFERENCE: {
    zh: "推断",
    en: "INFERENCE",
    className: "border-movement/50 text-movement",
    dot: "bg-movement",
  },
  CAUSAL_CLAIM: {
    zh: "因果断言",
    en: "CAUSAL CLAIM",
    className: "border-space/60 text-space",
    dot: "bg-space",
  },
}

export function statusTone(status: CausalStatus) {
  if (status === "SUPPORTED") return "text-space"
  if (status === "WEAK") return "text-tactical"
  return "text-muted-foreground/60"
}

export function StatusPill({ status, className }: { status: CausalStatus; className?: string }) {
  return (
    <span
      className={cn(
        "rounded-sm px-1.5 py-px font-mono text-[9px] font-bold tracking-[0.15em]",
        status === "SUPPORTED" && "bg-space/15 text-space",
        status === "WEAK" && "bg-tactical/15 text-tactical",
        status === "TEMPORAL_ONLY" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      {status.replace("_", " ")}
    </span>
  )
}

export function RelationTag({
  relation,
  status,
  confidence,
  className,
}: {
  relation: CausalRelation
  status: CausalStatus
  confidence?: number
  className?: string
}) {
  const temporal = relation === "TEMPORAL_ONLY"
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1.5 font-mono text-[10px] tracking-wider",
        temporal ? "text-muted-foreground/60" : statusTone(status),
        className,
      )}
    >
      <span className="uppercase">{relation.replace("_", " ")}</span>
      <span className="text-[9px] opacity-70">{RELATION_ZH[relation]}</span>
      {!temporal && typeof confidence === "number" && (
        <span className="tabular-nums opacity-80">{confidence.toFixed(2)}</span>
      )}
    </span>
  )
}

export function ClaimBadge({ claim, className }: { claim: ClaimType; className?: string }) {
  const m = CLAIM_META[claim]
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-px font-mono text-[9px] tracking-[0.15em]",
        m.className,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", m.dot)} aria-hidden />
      {m.en}
      <span className="font-sans tracking-normal opacity-80">{m.zh}</span>
    </span>
  )
}

export function TestResult({ result }: { result: "PASS" | "FAIL" | "N/A" }) {
  return (
    <span
      className={cn(
        "font-mono text-[10px] font-bold tracking-widest",
        result === "PASS" && "text-space",
        result === "FAIL" && "text-destructive",
        result === "N/A" && "text-muted-foreground",
      )}
    >
      {result}
    </span>
  )
}
