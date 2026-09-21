"use client"

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ClipboardPaste,
  Database,
  Loader2,
  Upload,
} from "lucide-react"
import { useCallback, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { adaptTracking, type AdapterResult, type TrackingSourceKind } from "@/lib/adapters"
import type { BasketSide } from "@/lib/reality/court"
import { checkRealityInput, type RealityInputCheck } from "@/lib/reality/input-check"
import type { IntegrityViolation } from "@/lib/reality/integrity"
import { PIPELINE_STAGES, runPipeline, type PipelineStageId, type StageReport } from "@/lib/reality/pipeline"
import { buildPossession } from "@/lib/reality5/build-possession"
import type { Possession } from "@/lib/reality5/types"
import { cn } from "@/lib/utils"
import { IntegrityMiniCourt } from "./integrity-mini-court"
import { useWorkspace } from "./workspace-context"

type Step =
  | { kind: "choose" }
  | { kind: "paste" }
  | { kind: "check"; check: RealityInputCheck; adapted: AdapterResult; label: string; source: TrackingSourceKind; id: string }
  | { kind: "running"; label: string; reports: StageReport[] }
  | { kind: "done"; possession: Possession; reports: StageReport[] }

/**
 * ANALYZE NEW REALITY. Every path (sample, upload, paste) goes through the
 * same adapter → input check → pipeline; the workspace receives only the
 * resulting Possession.
 */
export function AnalyzeDrawer() {
  const { analyzeOpen, setAnalyzeOpen, samples, config, loadPossession } = useWorkspace()
  const [step, setStep] = useState<Step>({ kind: "choose" })
  const [loadingSample, setLoadingSample] = useState<string | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const onOpenChange = (open: boolean) => {
    setAnalyzeOpen(open)
    if (!open) {
      setStep({ kind: "choose" })
      setReadError(null)
    }
  }

  const stage = useCallback(
    (raw: unknown, label: string, source: TrackingSourceKind, id: string) => {
      const adapted = adaptTracking(raw)
      setStep({ kind: "check", check: checkRealityInput(adapted), adapted, label, source, id })
    },
    [],
  )

  const readText = (text: string, label: string, source: TrackingSourceKind, id: string) => {
    setReadError(null)
    try {
      stage(JSON.parse(text), label, source, id)
    } catch (e) {
      setReadError(`JSON 解析失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const pickSample = async (sampleId: string, label: string) => {
    setLoadingSample(sampleId)
    setReadError(null)
    try {
      const res = await fetch(`/api/samples/${sampleId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      stage(await res.json(), label, "SAMPLE TRACKING", sampleId)
    } catch (e) {
      setReadError(`无法读取样本：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoadingSample(null)
    }
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    const id = `upload:${file.name}:${file.size}`
    readText(text, file.name.replace(/\.json$/i, ""), "UPLOADED JSON", id)
  }

  const run = async (s: Extract<Step, { kind: "check" }>) => {
    if (!s.adapted.ok) return
    const reports: StageReport[] = []
    setStep({ kind: "running", label: s.label, reports: [] })
    const analysis = await runPipeline(s.adapted.tracking, {
      config,
      onStage: (r) => {
        reports.push(r)
        setStep({ kind: "running", label: s.label, reports: [...reports] })
      },
    })
    const possession = buildPossession(s.adapted.tracking, analysis, {
      id: s.id,
      label: s.label,
      source: s.source,
    })
    loadPossession(possession)
    setStep({ kind: "done", possession, reports })
  }

  return (
    <Sheet open={analyzeOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden border-l bg-panel p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b px-5 py-4">
          <p className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground">
            REALITY ENGINE · INPUT
          </p>
          <SheetTitle className="text-base font-semibold tracking-[0.12em] uppercase">
            Analyze New Reality
          </SheetTitle>
          <SheetDescription className="text-xs">
            Bring a new possession into the Reality Engine.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-auto px-5 py-4">
          {step.kind === "choose" && (
            <ChooseInput
              samples={samples}
              loadingSample={loadingSample}
              onSample={pickSample}
              onUpload={() => fileRef.current?.click()}
              onPaste={() => setStep({ kind: "paste" })}
              error={readError}
            />
          )}

          {step.kind === "paste" && (
            <PasteInput
              onBack={() => setStep({ kind: "choose" })}
              onSubmit={(text) => readText(text, `Pasted Possession ${new Date().toLocaleTimeString()}`, "PASTED JSON", `paste:${Date.now()}`)}
              error={readError}
            />
          )}

          {step.kind === "check" && (
            <InputCheck
              step={step}
              onBack={() => setStep({ kind: "choose" })}
              onRun={() => run(step)}
            />
          )}

          {step.kind === "running" && <PipelineProgress reports={step.reports} label={step.label} />}

          {step.kind === "done" && (
            <Completion
              possession={step.possession}
              reports={step.reports}
              onClose={() => onOpenChange(false)}
              onAnother={() => setStep({ kind: "choose" })}
            />
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Upload tracking JSON"
          onChange={(e) => {
            void onFile(e.target.files?.[0])
            e.target.value = ""
          }}
        />
      </SheetContent>
    </Sheet>
  )
}

function ChooseInput({
  samples,
  loadingSample,
  onSample,
  onUpload,
  onPaste,
  error,
}: {
  samples: { id: string; label: string; description: string }[]
  loadingSample: string | null
  onSample: (id: string, label: string) => void
  onUpload: () => void
  onPaste: () => void
  error: string | null
}) {
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <Eyebrow n="01" label="SAMPLE POSSESSION" />
        {samples.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={loadingSample !== null}
            onClick={() => onSample(s.id, s.label)}
            className={cn(
              "flex items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
              "hover:border-tactical/60 hover:bg-tactical/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60",
            )}
          >
            {loadingSample === s.id ? (
              <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-tactical" aria-hidden />
            ) : (
              <Database className="mt-0.5 size-4 shrink-0 text-tactical" aria-hidden />
            )}
            <span className="flex flex-col">
              <span className="text-sm font-medium">{s.label}</span>
              <span className="text-xs text-muted-foreground">{s.description}</span>
            </span>
          </button>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <Eyebrow n="02" label="UPLOAD TRACKING JSON" />
        <button
          type="button"
          onClick={onUpload}
          className="flex flex-col items-center gap-2 rounded-md border border-dashed px-3 py-6 text-center transition-colors hover:border-tactical/60 hover:bg-tactical/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Upload className="size-5 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium">选择 .json 文件</span>
          <span className="text-xs text-muted-foreground">
            只接受物理状态：帧、球员坐标、球、持球人
          </span>
        </button>
      </section>

      <section className="flex flex-col gap-2">
        <Eyebrow n="03" label="PASTE TRACKING JSON" />
        <Button variant="outline" className="justify-start gap-2" onClick={onPaste}>
          <ClipboardPaste data-icon="inline-start" />
          粘贴 JSON 文本
        </Button>
      </section>

      {error && <ErrorNote message={error} />}

      <FormatHint />
    </div>
  )
}

function PasteInput({
  onBack,
  onSubmit,
  error,
}: {
  onBack: () => void
  onSubmit: (text: string) => void
  error: string | null
}) {
  const [text, setText] = useState("")
  return (
    <div className="flex h-full flex-col gap-3">
      <BackButton onClick={onBack} />
      <Eyebrow n="03" label="PASTE TRACKING JSON" />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        aria-label="Tracking JSON"
        placeholder='{ "metadata": { ... }, "frames": [ ... ] }'
        className="min-h-64 flex-1 resize-none rounded-md border bg-background p-3 font-mono text-xs leading-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {error && <ErrorNote message={error} />}
      <Button disabled={!text.trim()} onClick={() => onSubmit(text)}>
        READ REALITY
      </Button>
    </div>
  )
}

function InputCheck({
  step,
  onBack,
  onRun,
}: {
  step: Extract<Step, { kind: "check" }>
  onBack: () => void
  onRun: () => void
}) {
  const { check, label } = step
  return (
    <div className="flex flex-col gap-4">
      <BackButton onClick={onBack} />
      <div>
        <p className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground">REALITY INPUT CHECK</p>
        <p className="mt-1 text-sm font-medium">{label}</p>
      </div>

      {check.rows.length > 0 && (
        <dl className="flex flex-col divide-y rounded-md border font-mono text-xs">
          {check.rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 px-3 py-1.5">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd
                className={cn(
                  "tabular-nums",
                  row.status === "ok" && "text-space",
                  row.status === "warn" && "text-tactical",
                  row.status === "fail" && "font-bold text-destructive",
                )}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {check.sufficient && (
        <p
          className={cn(
            "flex items-center gap-2 font-mono text-xs font-bold tracking-[0.2em]",
            check.verdict === "WARNING" ? "text-tactical" : "text-space",
          )}
        >
          <CheckCircle2 className="size-3.5" aria-hidden />
          COURT VALID ✓{check.verdict === "WARNING" && " · WITH WARNINGS"}
        </p>
      )}

      {!check.sufficient && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <p className="flex items-center gap-2 font-mono text-xs font-bold tracking-[0.2em] text-destructive">
            <AlertTriangle className="size-3.5" aria-hidden />
            {check.verdict === "INVALID" ? "INVALID REALITY" : "INSUFFICIENT REALITY"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {check.verdict === "INVALID"
              ? "数据描述了物理上不可能的现实。Reality5 拒绝在此基础上进行篮球解读。"
              : "缺少必需的物理数据。Reality5 不会猜测缺失的现实。"}
          </p>
          {check.primaryViolation && (
            <ViolationDetail violation={check.primaryViolation} attacking={check.integrity?.attackingBasket} />
          )}
          <ul className="mt-2 flex flex-col gap-1 font-mono text-xs">
            {check.errors.map((e, i) => (
              <li key={`${e.code}-${i}`} className="flex flex-col">
                <span className="text-destructive">{e.code}</span>
                <span className="text-foreground/80">{e.message.zh}</span>
                {e.path && <span className="text-[10px] text-muted-foreground">{e.path}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {check.sufficient && check.primaryViolation && (
        <ViolationDetail violation={check.primaryViolation} attacking={check.integrity?.attackingBasket} />
      )}

      {check.warnings.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-md border border-tactical/40 bg-tactical/5 p-3 font-mono text-[11px]">
          {check.warnings.map((w, i) => (
            <li key={`${w.code}-${i}`} className="flex gap-2">
              <span className="shrink-0 text-tactical">{w.code}</span>
              <span className="text-foreground/80">{w.message.zh}</span>
            </li>
          ))}
        </ul>
      )}

      <Button disabled={!check.sufficient} onClick={onRun} className="tracking-[0.15em]">
        RUN REALITY ENGINE
      </Button>
    </div>
  )
}

function ViolationDetail({
  violation,
  attacking,
}: {
  violation: IntegrityViolation
  attacking?: BasketSide
}) {
  const isError = violation.severity === "error"
  return (
    <div
      className={cn(
        "mt-3 flex flex-col gap-3 rounded-md border p-3 font-mono text-[11px]",
        isError ? "border-destructive/40" : "border-tactical/40 bg-tactical/5",
      )}
    >
      <dl className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <dt className={cn("font-bold tracking-[0.15em]", isError ? "text-destructive" : "text-tactical")}>
            {violation.subject ?? violation.code}
          </dt>
          {violation.frame !== undefined && <dd className="text-muted-foreground">Frame {violation.frame}</dd>}
        </div>
        <div className="mt-1 flex justify-between gap-3">
          <dt className="text-muted-foreground">Observed</dt>
          <dd className="tabular-nums">{violation.observed}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Allowed</dt>
          <dd className="tabular-nums">{violation.allowed}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Status</dt>
          <dd className={cn("font-bold", isError ? "text-destructive" : "text-tactical")}>
            {isError ? "INVALID REALITY" : "WARNING"}
          </dd>
        </div>
      </dl>
      {violation.point && <IntegrityMiniCourt violation={violation} attacking={attacking} />}
    </div>
  )
}

function PipelineProgress({ reports, label }: { reports: StageReport[]; label: string }) {
  const doneIds = new Set<PipelineStageId>(reports.map((r) => r.id))
  const activeIndex = reports.length
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground">ANALYZING</p>
        <p className="mt-1 text-sm font-medium">{label}</p>
      </div>
      <StageList reports={reports} doneIds={doneIds} activeIndex={activeIndex} />
    </div>
  )
}

function StageList({
  reports,
  doneIds,
  activeIndex,
}: {
  reports: StageReport[]
  doneIds: Set<PipelineStageId>
  activeIndex: number
}) {
  return (
    <ol className="flex flex-col">
      {PIPELINE_STAGES.map((s, i) => {
        const done = doneIds.has(s.id)
        const active = i === activeIndex
        const report = reports.find((r) => r.id === s.id)
        return (
          <li key={s.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                  done
                    ? "border-space bg-space text-background"
                    : active
                      ? "border-tactical text-tactical"
                      : "border-border text-muted-foreground/40",
                )}
              >
                {done ? (
                  <Check className="size-3" aria-hidden />
                ) : active ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden />
                ) : (
                  <span className="size-1 rounded-full bg-current" aria-hidden />
                )}
              </span>
              {i < PIPELINE_STAGES.length - 1 && (
                <span
                  className={cn(
                    "my-0.5 w-px flex-1 transition-colors duration-300",
                    done ? "bg-space/60" : "bg-border",
                  )}
                  aria-hidden
                />
              )}
            </div>
            <div className="flex min-h-11 flex-col pb-2 leading-4">
              <span
                className={cn(
                  "font-mono text-xs tracking-[0.15em] transition-colors",
                  done ? "text-foreground" : active ? "text-tactical" : "text-muted-foreground/60",
                )}
              >
                {s.label}
              </span>
              {report && (
                <span className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                  {report.detail} · {report.ms.toFixed(1)} ms
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Completion({
  possession,
  reports,
  onClose,
  onAnother,
}: {
  possession: Possession
  reports: StageReport[]
  onClose: () => void
  onAnother: () => void
}) {
  const doneIds = new Set<PipelineStageId>(reports.map((r) => r.id))
  const { analysis } = possession
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="font-mono text-[9px] tracking-[0.3em] text-space">ANALYSIS COMPLETE</p>
        <p className="mt-1 text-sm font-medium">{possession.label}</p>
        <p className="font-mono text-[10px] text-muted-foreground">
          {possession.dataSource.source} · {possession.dataSource.frames} FRAMES ·{" "}
          {possession.dataSource.sampleRateHz} HZ
        </p>
      </div>

      <StageList reports={reports} doneIds={doneIds} activeIndex={-1} />

      <dl className="grid grid-cols-4 gap-2 font-mono text-xs">
        <Stat label="EVENTS" value={analysis.events.length} />
        <Stat label="NODES" value={analysis.graph.nodes.length} />
        <Stat label="CAUSAL" value={analysis.trace.chain.length} />
        <Stat label="EVIDENCE" value={analysis.evidence.length} />
      </dl>

      {analysis.events.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {analysis.events.map((e) => (
            <li
              key={e.id}
              className="rounded-sm border border-tactical/40 bg-tactical/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-tactical"
            >
              {e.type.replace("_", " ")}
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-mono text-xs text-muted-foreground">
          No event met its threshold. Reality vetoed every story.
        </p>
      )}

      <div className="rounded-md border bg-background/40 p-4 text-center">
        <p className="font-mono text-sm font-bold tracking-[0.3em]">REALITY5</p>
        <p className="mt-2 font-mono text-[11px] tracking-[0.15em] text-muted-foreground">
          Reality → Structure → Understanding → Story
        </p>
        <p className="mt-1 text-xs text-foreground/80">Reality first. Language second.</p>
        <p className="mt-3 font-mono text-[10px] tracking-[0.2em] text-space">
          Reality has veto power.
        </p>
      </div>

      <div className="flex gap-2">
        <Button className="flex-1 tracking-[0.15em]" onClick={onClose}>
          OPEN IN WORKSPACE
        </Button>
        <Button variant="outline" onClick={onAnother}>
          ANALYZE ANOTHER
        </Button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col rounded-md border px-3 py-2">
      <dt className="text-[9px] tracking-[0.2em] text-muted-foreground">{label}</dt>
      <dd className="text-lg tabular-nums">{value}</dd>
    </div>
  )
}

function Eyebrow({ n, label }: { n: string; label: string }) {
  return (
    <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-muted-foreground">
      <span className="text-tactical">{n}</span>
      {label}
    </p>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="xs" className="w-fit gap-1 font-mono text-[10px]" onClick={onClick}>
      <ArrowLeft data-icon="inline-start" />
      BACK
    </Button>
  )
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {message}
    </p>
  )
}

function FormatHint() {
  return (
    <details className="rounded-md border px-3 py-2 text-xs">
      <summary className="cursor-pointer font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
        EXPECTED FORMAT
      </summary>
      <pre className="mt-2 overflow-auto font-mono text-[10px] leading-4 text-foreground/80">{`{
  "metadata": { "game_id": "g", "possession_id": "p", "fps": 10, "court_unit": "meters" },
  "frames": [{
    "timestamp": 0.0, "gameClock": "07:50.0",
    "ball": { "x": 12.4, "y": 7.1, "z": 1.2, "possessor": "P23" },
    "players": [{ "id": "P23", "team": "offense", "x": 12.1, "y": 7.0 }]
  }]
}`}</pre>
      <p className="mt-2 text-[10px] text-muted-foreground">
        源数据不得包含事件标签（DRIVE / HELP_DEFENSE / PASS 等）。它们必须由 Reality5 产生。
      </p>
    </details>
  )
}
