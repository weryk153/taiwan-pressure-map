import type { DisasterEvent, Severity } from './types'

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
