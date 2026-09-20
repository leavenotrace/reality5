import type {
  BasketballEvent,
  EventType,
  EvidenceValue,
  PlayGraph,
  PlayGraphEdge,
  Relationship,
} from "@/lib/reality/types"

type EvidenceRecord = Record<string, EvidenceValue>

interface CompatibilityRule {
  source: EventType
  target: EventType
  relationship: Relationship
  /** Max seconds between source onset and target onset. */
  window: number
  /** Return edge evidence when the pair is compatible, or null. */
  test: (a: BasketballEvent, b: BasketballEvent) => EvidenceRecord | null
}

const num = (v: EvidenceValue | undefined) => (typeof v === "number" ? v : Number(v ?? 0))

const within = (a: BasketballEvent, b: BasketballEvent, slack = 0.3) =>
  b.timestamp >= a.timestamp && b.timestamp <= (a.endTimestamp ?? a.timestamp) + slack

/**
 * Event compatibility rules. Edges are only created when the temporal
 * ordering AND the rule's structural test both hold — the graph is never
 * assumed from the storyline.
 */
const RULES: CompatibilityRule[] = [
  {
    source: "DRIVE",
    target: "HELP_DEFENSE",
    relationship: "TRIGGERED",
    window: 3,
    test: (drive, help) =>
      within(drive, help)
        ? {
            drive_speed: num(drive.evidence.speed),
            reaction_time: num(help.evidence.reaction_time),
            defender_shift: num(help.evidence.defender_shift),
          }
        : null,
  },
  {
    source: "DRIVE",
    target: "DEFENSIVE_COLLAPSE",
    relationship: "TRIGGERED",
    window: 3,
    test: (drive, collapse) =>
      within(drive, collapse, 1)
        ? {
            drive_speed: num(drive.evidence.speed),
            defenders_collapsing: num(collapse.evidence.defenders_collapsing),
          }
        : null,
  },
  {
    source: "HELP_DEFENSE",
    target: "DEFENSIVE_COLLAPSE",
    relationship: "CONTRIBUTED",
    window: 2,
    test: (help, collapse) =>
      String(collapse.evidence.defenders).split(",").includes(help.actor ?? "")
        ? { defender: help.actor ?? "", defender_shift: num(help.evidence.defender_shift) }
        : null,
  },
  {
    source: "HELP_DEFENSE",
    target: "OPEN_SPACE",
    relationship: "CREATED",
    window: 2,
    test: (help, open) => {
      const leftPlayer = help.target === open.actor
      const isNearest = open.target === help.actor
      if (!leftPlayer && !isNearest) return null
      const before = num(help.evidence.assignment_distance_before)
      return {
        defender_shift: num(help.evidence.defender_shift),
        open_distance_change: round(num(open.evidence.peak_open_distance) - before),
        open_distance: num(open.evidence.peak_open_distance),
      }
    },
  },
  {
    source: "DEFENSIVE_COLLAPSE",
    target: "OPEN_SPACE",
    relationship: "CONTRIBUTED",
    window: 1.5,
    test: (collapse, open) =>
      open.evidence.has_ball === "no"
        ? {
            defenders_collapsing: num(collapse.evidence.defenders_collapsing),
            offense_left_unguarded: num(collapse.evidence.offense_left_unguarded),
          }
        : null,
  },
  {
    source: "OPEN_SPACE",
    target: "PASS",
    relationship: "ENABLED",
    window: 4,
    test: (open, pass) =>
      pass.target === open.actor
        ? {
            creation_lead: num(pass.evidence.creation_lead),
            receiver_nearest_defender_distance: num(pass.evidence.receiver_nearest_defender_distance),
          }
        : null,
  },
  {
    source: "DRIVE",
    target: "PASS",
    relationship: "PRECEDED",
    window: 3,
    test: (drive, pass) =>
      pass.actor === drive.actor
        ? { drive_to_pass: round(pass.timestamp - (drive.endTimestamp ?? drive.timestamp)) }
        : null,
  },
  {
    source: "PASS",
    target: "OPEN_THREE",
    relationship: "PRECEDED",
    window: 3,
    test: (pass, three) =>
      three.actor === pass.target
        ? {
            catch_to_release: num(three.evidence.catch_to_release),
            contest_distance: num(three.evidence.contest_distance),
          }
        : null,
  },
]

export function buildPlayGraph(events: BasketballEvent[]): PlayGraph {
  const ordered = [...events].sort((a, b) => a.timestamp - b.timestamp)
  const nodes = ordered.map((e) => ({
    id: e.id,
    eventId: e.id,
    type: e.type,
    timestamp: e.timestamp,
  }))

  const edges: PlayGraphEdge[] = []
  for (let i = 0; i < ordered.length; i++) {
    for (let j = i + 1; j < ordered.length; j++) {
      const a = ordered[i]
      const b = ordered[j]
      for (const rule of RULES) {
        if (rule.source !== a.type || rule.target !== b.type) continue
        if (b.timestamp - a.timestamp > rule.window) continue
        const evidence = rule.test(a, b)
        if (!evidence) continue
        if (edges.some((e) => e.source === a.id && e.target === b.id)) continue
        edges.push({ source: a.id, target: b.id, relationship: rule.relationship, evidence })
      }
    }
  }

  return { nodes, edges }
}

function round(v: number, p = 2) {
  const f = 10 ** p
  return Math.round(v * f) / f
}
