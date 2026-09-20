import type { BasketballEvent } from "./types"

export interface TimelineScale {
  /** Clip-relative seconds → 0..1 position on the track. */
  toRatio: (t: number) => number
  /** 0..1 track position → clip-relative seconds. */
  toTime: (ratio: number) => number
  focus: { from: number; to: number; magnification: number }
}

/**
 * Piecewise-linear scale that widens the window around the event cluster so
 * markers stay legible while the track still spans the whole clip.
 */
export function createTimelineScale(
  events: BasketballEvent[],
  duration: number,
  focusShare = 0.72,
  padding = 0.6,
): TimelineScale {
  if (events.length === 0) {
    return {
      toRatio: (t) => t / duration,
      toTime: (r) => r * duration,
      focus: { from: 0, to: duration, magnification: 1 },
    }
  }
  const first = Math.max(0, Math.min(...events.map((e) => e.t)) - padding)
  const last = Math.min(duration, Math.max(...events.map((e) => e.t)) + padding)
  const before = first / duration
  const after = (duration - last) / duration
  const rest = 1 - focusShare
  const beforeShare = before + after === 0 ? 0 : (rest * before) / (before + after)
  const afterShare = rest - beforeShare

  const stops: [number, number][] = [
    [0, 0],
    [first, beforeShare],
    [last, beforeShare + focusShare],
    [duration, 1],
  ]

  const interp = (x: number, xi: 0 | 1, yi: 0 | 1) => {
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i]
      const b = stops[i + 1]
      if (x >= a[xi] && x <= b[xi]) {
        const span = b[xi] - a[xi]
        if (span === 0) return a[yi]
        return a[yi] + ((x - a[xi]) / span) * (b[yi] - a[yi])
      }
    }
    return x <= stops[0][xi] ? stops[0][yi] : stops[stops.length - 1][yi]
  }

  const magnification = (focusShare / ((last - first) / duration)) || 1

  return {
    toRatio: (t) => interp(Math.min(Math.max(t, 0), duration), 0, 1),
    toTime: (r) => interp(Math.min(Math.max(r, 0), 1), 1, 0),
    focus: { from: first, to: last, magnification },
  }
}
