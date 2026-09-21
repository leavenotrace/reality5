"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

export type UiLocale = "zh" | "en"

interface LocaleValue {
  locale: UiLocale
  setLocale: (l: UiLocale) => void
  /** Pick a UI string by current locale. */
  t: (zh: string, en: string) => string
  /** Pick a side of an engine bilingual object `{ zh, en }`. */
  tl: (obj: { zh: string; en: string } | undefined | null) => string
}

const LocaleContext = createContext<LocaleValue | null>(null)

const COOKIE = "reality5-locale"

function readCookie(): UiLocale | null {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=(zh|en)`))
  return m ? (m[1] as UiLocale) : null
}

export function LocaleProvider({
  children,
  initialLocale = "zh",
}: {
  children: ReactNode
  initialLocale?: UiLocale
}) {
  const [locale, setLocaleState] = useState<UiLocale>(initialLocale)

  useEffect(() => {
    const saved = readCookie()
    if (saved && saved !== locale) setLocaleState(saved)
    // Only sync from the cookie on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en"
  }, [locale])

  const setLocale = useCallback((l: UiLocale) => {
    setLocaleState(l)
    document.cookie = `${COOKIE}=${l}; path=/; max-age=31536000; SameSite=Lax`
  }, [])

  const value = useMemo<LocaleValue>(
    () => ({
      locale,
      setLocale,
      t: (zh, en) => (locale === "zh" ? zh : en),
      tl: (obj) => (obj ? (locale === "zh" ? obj.zh : obj.en) : ""),
    }),
    [locale, setLocale],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error("useLocale must be used inside LocaleProvider")
  return ctx
}

/** Shared vocabulary used by several panels. */
export const RELATION_LABEL: Record<string, { zh: string; en: string }> = {
  TRIGGERED: { zh: "触发", en: "TRIGGERED" },
  CREATED: { zh: "创造", en: "CREATED" },
  ENABLED: { zh: "使成立", en: "ENABLED" },
  CONSTRAINED: { zh: "限制", en: "CONSTRAINED" },
  PRECEDED: { zh: "先于", en: "PRECEDED" },
  TEMPORAL_ONLY: { zh: "仅时间先后", en: "TEMPORAL ONLY" },
}

export const STATUS_LABEL: Record<string, { zh: string; en: string }> = {
  SUPPORTED: { zh: "成立", en: "SUPPORTED" },
  WEAK: { zh: "证据不足", en: "WEAK" },
  TEMPORAL_ONLY: { zh: "仅时间先后", en: "TEMPORAL ONLY" },
}

export const EVENT_LABEL: Record<string, { zh: string; en: string }> = {
  DRIVE: { zh: "突破", en: "DRIVE" },
  HELP_DEFENSE: { zh: "协防", en: "HELP DEFENSE" },
  OPEN_SPACE: { zh: "空位", en: "OPEN SPACE" },
  PASS: { zh: "传球", en: "PASS" },
  OPEN_THREE: { zh: "空位三分", en: "OPEN THREE" },
  DEFENSIVE_ROTATION: { zh: "防守轮转", en: "DEFENSIVE ROTATION" },
  CLOSEOUT: { zh: "扑防", en: "CLOSEOUT" },
  SHOT: { zh: "出手", en: "SHOT" },
  SCREEN: { zh: "掩护", en: "SCREEN" },
  DEFENSIVE_COLLAPSE: { zh: "防守收缩", en: "DEFENSIVE COLLAPSE" },
}

export const TEST_RESULT_LABEL: Record<string, { zh: string; en: string }> = {
  PASS: { zh: "通过", en: "PASS" },
  FAIL: { zh: "未通过", en: "FAIL" },
  SKIP: { zh: "跳过", en: "SKIP" },
}

export const INTEGRITY_LABEL: Record<string, { zh: string; en: string }> = {
  VALID: { zh: "有效", en: "VALID" },
  WARNING: { zh: "警告", en: "WARNING" },
  INVALID: { zh: "无效", en: "INVALID" },
}

/** Engine emits English labels for pipeline stages and input-check rows; map them for zh. */
const ENGINE_LABEL_ZH: Record<string, string> = {
  "READING REALITY": "读取现实",
  "NORMALIZING COURT STATE": "归一化球场状态",
  "DETECTING EVENTS": "检测事件",
  "TESTING CAUSAL EDGES": "检验因果边",
  "LINKING EVIDENCE": "链接证据",
  "GENERATING EXPLANATION": "生成解释",
  "Coordinate System": "坐标系",
  "Court Bounds": "球场边界",
  "Timestamp Integrity": "时间戳完整性",
  "Player Identity": "球员身份",
  "Physical Movement": "物理移动",
  Schema: "数据结构",
}

export function engineLabel(label: string, locale: UiLocale) {
  return locale === "zh" ? (ENGINE_LABEL_ZH[label] ?? label) : label
}
