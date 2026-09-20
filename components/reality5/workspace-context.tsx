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
import type {
  BasketballEvent,
  CourtState,
  Evidence,
  Possession,
} from "@/lib/reality5/types"
import { getActiveEvent, getCourtState } from "@/lib/reality5/tracking"

interface WorkspaceValue {
  possession: Possession
  currentTime: number
  isPlaying: boolean
  courtState: CourtState
  activeEvent: BasketballEvent | null
  focusedEvidenceId: string | null
  hoveredEventId: string | null
  videoRef: RefObject<HTMLVideoElement | null>
  play: () => void
  pause: () => void
  toggle: () => void
  seek: (t: number) => void
  seekToEvent: (eventId: string) => void
  restart: () => void
  focusEvidence: (id: string | null) => void
  hoverEvent: (id: string | null) => void
  evidenceById: Map<string, Evidence>
  eventById: Map<string, BasketballEvent>
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
  possession,
  children,
}: {
  possession: Possession
  children: ReactNode
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
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
    seek(0)
    play()
  }, [play, seek])

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
      pause()
      seek(event.t)
    },
    [pause, possession.events, seek],
  )

  const courtState = useMemo(
    () => getCourtState(possession, currentTime),
    [possession, currentTime],
  )
  const activeEvent = useMemo(
    () => getActiveEvent(possession.events, currentTime),
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
    currentTime,
    isPlaying,
    courtState,
    activeEvent,
    focusedEvidenceId,
    hoveredEventId,
    videoRef,
    play,
    pause,
    toggle,
    seek,
    seekToEvent,
    restart,
    focusEvidence: setFocusedEvidenceId,
    hoverEvent: setHoveredEventId,
    evidenceById,
    eventById,
  }

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  )
}
