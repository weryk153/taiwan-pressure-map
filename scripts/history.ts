import type { CountyRisk } from '../src/lib/types'

export interface PressurePeriod { asOf: string; scores: Record<string, number> }
export interface PressureHistory { periods: PressurePeriod[] }

/** 把本期 risks 併入 history：同 asOf(日期) 取代、否則新增，依 asOf 升冪、最多保留 60 期。 */
export function mergeHistory(history: PressureHistory, asOf: string, risks: CountyRisk[]): PressureHistory {
  const scores: Record<string, number> = {}
  for (const r of risks) if (r.score !== null) scores[r.code] = r.score
  const others = (history.periods ?? []).filter((p) => p.asOf !== asOf)
  const periods = [...others, { asOf, scores }].sort((a, b) => a.asOf.localeCompare(b.asOf)).slice(-60)
  return { periods }
}
