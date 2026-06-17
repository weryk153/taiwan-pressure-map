import type { MetricKey, RiskLevel } from './types'

export const WEIGHTS: Record<MetricKey, number> = {
  economic: 0.25,
  housing: 0.20,
  demographic: 0.20,
  safety: 0.20,
  healthcare: 0.15,
}

/** 加權平均；缺值指標其權重會被排除（剩餘權重重正規化）。回 0–100 整數。 */
export function calculateRiskScore(subScores: Partial<Record<MetricKey, number>>): number {
  let weighted = 0
  let totalWeight = 0
  for (const key of Object.keys(WEIGHTS) as MetricKey[]) {
    const v = subScores[key]
    if (v == null || Number.isNaN(v)) continue
    weighted += v * WEIGHTS[key]
    totalWeight += WEIGHTS[key]
  }
  if (totalWeight === 0) return 0
  return Math.round(weighted / totalWeight)
}

export function toRiskLevel(score: number): RiskLevel {
  if (score < 25) return 'low'
  if (score < 50) return 'medium'
  if (score < 75) return 'high'
  return 'critical'
}
