"use client"

import type { Possession } from "@/lib/reality5/types"
import { AppHeader } from "./app-header"
import { CommentaryPanel } from "./commentary-panel"
import { EvidencePanel } from "./evidence-panel"
import { PlayGraph } from "./play-graph"
import { RealityTimeline } from "./reality-timeline"
import { VideoPanel } from "./video-panel"
import { WorkspaceProvider } from "./workspace-context"

export function Workspace({ possession }: { possession: Possession }) {
  return (
    <WorkspaceProvider possession={possession}>
      <div className="flex h-dvh flex-col">
        <AppHeader />
        <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[68fr_32fr]">
          <div className="flex min-h-0 flex-col gap-3">
            <VideoPanel />
            <RealityTimeline />
            <div className="grid min-h-0 shrink-0 grid-cols-1 gap-3 md:grid-cols-[1fr_320px] lg:h-[228px]">
              <CommentaryPanel />
              <EvidencePanel />
            </div>
          </div>
          <PlayGraph />
        </main>
      </div>
    </WorkspaceProvider>
  )
}
