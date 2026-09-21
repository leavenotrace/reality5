"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react"
import type { CourtState, DetectorConfig } from "@/lib/reality/types"
import { exportAnalysis, exportFileName } from "@/lib/reality/export"
import type { RealityWorkspaceData } from "@/lib/reality5/data-source"
import type {
  Evidence,
  OverlayCourtState,
  Possession,
  PresentedEvent,
} from "@/lib/reality5/types"
import {
  getActiveEvent,
  getRealityState,
  toOverlayState,
} from "@/lib/reality5/tracking"

interface WorkspaceValue {
  possession: Possession
  /** Every possession loaded this session: samples first, then analyzed uploads. */
  possessions: Possession[]
  possessionId: string
  setPossession: (id: string) => void
  /** Receives a finished PossessionAnalysis envelope from any source and shows it. */
  loadPossession: (possession: Possession) => void
  config: DetectorConfig
  samples: RealityWorkspaceData["samples"]
  analyzeOpen: boolean
  setAnalyzeOpen: (open: boolean) => void
  compareOpen: boolean
  setCompareOpen: (open: boolean) => void
  /** Event whose evidence trace is open. */
  traceEventId: string | null
  openTrace: (eventId: string | null) => void
  exportCurrent: () => void
  currentTime: number
  isPlaying: boolean
  /** True while REPLAY ANALYSIS is animating the detection pass. */
  isReplaying: boolean
  debugOpen: boolean
  /** Engine state (meters) at currentTime. */
  realityState: CourtState
  /** Overlay state (feet) at currentTime. */
  courtState: OverlayCourtState
  activeEvent: PresentedEvent | null
  /** Ids of events whose onset has been reached. */
  detectedEventIds: Set<string>
  focusedEvidenceId: string | null
  hoveredEventId: string | null
  videoRef: RefObject<HTMLVideoElement | null>
  play: () => void
  pause: () => void
  toggle: () => void
  seek: (t: number) => void
  seekToEvent: (eventId: string) => void
  restart: () => void
  replayAnalysis: () => void
  toggleDebug: () => void
  focusEvidence: (id: string | null) => void
  hoverEvent: (id: string | null) => void
  evidenceById: Map<string, Evidence>
  eventById: Map<string, PresentedEvent>
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null)

export function useWorkspace(): WorkspaceValue {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider")
  return ctx
}

/**
 * Owns the playback clock. When the <video> element has a real, decodable
 * source it is the clock authority; otherwise an internal rAF clock drives
 * the same currentTime so the overlay, graph, and timeline stay in sync.
 */
export function WorkspaceProvider({
  data,
  children,
}: {
  data: RealityWorkspaceData
  children: ReactNode
}) {
  const [possessions, setPossessions] = useState<Possession[]>(data.possessions)
  const [possessionId, setPossessionId] = useState<string>(data.possessions[0].id)
  const possession = possessions.find((p) => p.id === possessionId) ?? possessions[0]
  const [analyzeOpen, setAnalyzeOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [traceEventId, setTraceEventId] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isReplaying, setIsReplaying] = useState(false)
  const [debugOpen, setDebugOpen] = useState(false)
  const [focusedEvidenceId, setFocusedEvidenceId] = useState<string | null>(null)
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null)

  const timeRef = useRef(0)
  const frameRef = useRef<number | null>(null)
  const lastTickRef = useRef<number | null>(null)
  const duration = possession.video.duration
  const clipStart = possession.video.clipStart

  const videoIsAuthority = () => {
    const v = videoRef.current
    return Boolean(
      v && possession.video.src && v.readyState >= 2 && Number.isFinite(v.duration),
    )
  }

  const commitTime = useCallback((t: number) => {
    timeRef.current = t
    setCurrentTime(t)
  }, [])

  const stopLoop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    lastTickRef.current = null
  }, [])

  const pause = useCallback(() => {
    setIsPlaying(false)
    stopLoop()
    videoRef.current?.pause()
  }, [stopLoop])

  const seek = useCallback(
    (t: number) => {
      const clamped = Math.min(Math.max(0, t), duration)
      commitTime(clamped)
      const v = videoRef.current
      if (v && possession.video.src) {
        v.currentTime = clipStart + clamped
      }
    },
    [clipStart, commitTime, duration, possession.video.src],
  )

  const play = useCallback(() => {
    if (timeRef.current >= duration - 0.01) {
      seek(0)
    }
    setIsPlaying(true)
    const v = videoRef.current
    if (v && possession.video.src) {
      void v.play().catch(() => undefined)
    }
  }, [duration, possession.video.src, seek])

  const toggle = useCallback(() => {
    if (isPlaying) pause()
    else play()
  }, [isPlaying, pause, play])

  const restart = useCallback(() => {
    setIsReplaying(false)
    seek(0)
    play()
  }, [play, seek])

  const replayAnalysis = useCallback(() => {
    pause()
    seek(0)
    setIsReplaying(true)
    play()
  }, [pause, play, seek])

  useEffect(() => {
    if (!isPlaying) return
    const tick = (now: number) => {
      const v = videoRef.current
      let next: number
      if (videoIsAuthority() && v) {
        next = v.currentTime - clipStart
      } else {
        const last = lastTickRef.current ?? now
        next = timeRef.current + (now - last) / 1000
      }
      lastTickRef.current = now

      if (next >= duration) {
        commitTime(duration)
        setIsPlaying(false)
        setIsReplaying(false)
        stopLoop()
        v?.pause()
        return
      }
      commitTime(next)
      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return stopLoop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying])

  const seekToEvent = useCallback(
    (eventId: string) => {
      const event = possession.events.find((e) => e.id === eventId)
      if (!event) return
      setIsReplaying(false)
      pause()
      seek(event.t)
    },
    [pause, possession.events, seek],
  )

  const resetView = useCallback(() => {
    pause()
    setIsReplaying(false)
    setFocusedEvidenceId(null)
    setHoveredEventId(null)
    setTraceEventId(null)
    commitTime(0)
  }, [commitTime, pause])

  /** Switching possessions only swaps the engine output; playback restarts from 0. */
  const setPossession = useCallback(
    (id: string) => {
      if (id === possessionId) return
      resetView()
      setPossessionId(id)
    },
    [possessionId, resetView],
  )

  const loadPossession = useCallback(
    (next: Possession) => {
      setPossessions((prev) => {
        const i = prev.findIndex((p) => p.id === next.id)
        if (i === -1) return [...prev, next]
        const copy = prev.slice()
        copy[i] = next
        return copy
      })
      resetView()
      setPossessionId(next.id)
    },
    [resetView],
  )

  const exportCurrent = useCallback(() => {
    const payload = exportAnalysis(possession.tracking, possession.analysis, possession.dataSource.source)
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = exportFileName(possession.tracking)
    a.click()
    URL.revokeObjectURL(url)
  }, [possession])

  const manualSeek = useCallback(
    (t: number) => {
      setIsReplaying(false)
      seek(t)
    },
    [seek],
  )

  const realityState = useMemo(
    () => getRealityState(possession, currentTime),
    [possession, currentTime],
  )
  const courtState = useMemo(() => toOverlayState(realityState), [realityState])
  const activeEvent = useMemo(
    () => getActiveEvent(possession.events, currentTime),
    [possession.events, currentTime],
  )
  const detectedEventIds = useMemo(
    () =>
      new Set(
        possession.events.filter((e) => e.t <= currentTime + 0.02).map((e) => e.id),
      ),
    [possession.events, currentTime],
  )
  const evidenceById = useMemo(
    () => new Map(possession.evidence.map((e) => [e.id, e])),
    [possession.evidence],
  )
  const eventById = useMemo(
    () => new Map(possession.events.map((e) => [e.id, e])),
    [possession.events],
  )

  const value: WorkspaceValue = {
    possession,
    possessions,
    possessionId,
    setPossession,
    loadPossession,
    config: data.config,
    samples: data.samples,
    analyzeOpen,
    setAnalyzeOpen,
    compareOpen,
    setCompareOpen,
    traceEventId,
    openTrace: setTraceEventId,
    exportCurrent,
    currentTime,
    isPlaying,
    isReplaying,
    debugOpen,
    realityState,
    courtState,
    activeEvent,
    detectedEventIds,
    focusedEvidenceId,
    hoveredEventId,
    videoRef,
    play,
    pause,
    toggle,
    seek: manualSeek,
    seekToEvent,
    restart,
    replayAnalysis,
    toggleDebug: () => setDebugOpen((v) => !v),
    focusEvidence: setFocusedEvidenceId,
    hoverEvent: setHoveredEventId,
    evidenceById,
    eventById,
  }

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  )
}
