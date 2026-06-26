import type { DisasterEvent, Severity } from './types'
import { parseTaiwanTime, taipeiDayKey } from './time'

export function eventsByCounty(events: DisasterEvent[]): Record<string, DisasterEvent[]> {
  const out: Record<string, DisasterEvent[]> = {}
  for (const e of events) {
    for (const code of e.countyCodes) {
      ;(out[code] ??= []).push(e)
    }
  }
  return out
}

const RANK: Record<Severity, number> = { severe: 0, warning: 1, info: 2 }
export function sortBySeverity(events: DisasterEvent[]): DisasterEvent[] {
  return [...events].sort((a, b) => RANK[a.severity] - RANK[b.severity])
}

/** 即時事件清單：只取台灣「今天」發生的事件，最新的排最前。 */
export function todaysEventsLatestFirst(
  events: DisasterEvent[],
  now: number = Date.now(),
): DisasterEvent[] {
  const today = taipeiDayKey(now)
  return events
    .map((e) => ({ e, t: parseTaiwanTime(e.time) }))
    .filter(({ t }) => !Number.isNaN(t) && taipeiDayKey(t) === today)
    .sort((a, b) => b.t - a.t)
    .map(({ e }) => e)
}

const DAY_MS = 86_400_000

/** 只保留近 N 天（以台灣時間解析）的事件，最新的排最前。 */
export function recentEvents(
  events: DisasterEvent[],
  days: number,
  now: number = Date.now(),
): DisasterEvent[] {
  const cutoff = now - days * DAY_MS
  return events
    .map((e) => ({ e, t: parseTaiwanTime(e.time) }))
    .filter(({ t }) => !Number.isNaN(t) && t >= cutoff)
    .sort((a, b) => b.t - a.t)
    .map(({ e }) => e)
}
