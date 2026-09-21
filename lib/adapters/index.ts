import { trackingJsonAdapter } from "./tracking-json-adapter"
import type { AdapterResult, TrackingInputAdapter } from "./types"

export type {
  AdapterResult,
  InputIssue,
  NormalizedTracking,
  TrackingInputAdapter,
  TrackingSourceKind,
} from "./types"
export { trackingJsonAdapter }

/**
 * Registered adapters, tried in order. Adding NBA / AWS tracking later means
 * appending an adapter here — the engine and the UI do not change.
 */
export const ADAPTERS: TrackingInputAdapter[] = [trackingJsonAdapter]

export function adaptTracking(raw: unknown): AdapterResult {
  const adapter = ADAPTERS.find((a) => a.canHandle(raw))
  if (!adapter) {
    return {
      ok: false,
      errors: [
        {
          code: "NO_ADAPTER",
          message: {
            zh: "无法识别的数据格式：没有适配器能读取该 JSON",
            en: "Unrecognized format: no adapter can read this JSON",
          },
        },
      ],
      warnings: [],
    }
  }
  return adapter.parse(raw)
}
