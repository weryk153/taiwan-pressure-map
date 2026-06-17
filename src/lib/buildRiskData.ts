import { COUNTIES } from './counties'
import { buildMockSignals } from './mock'
import { calculateRiskScore } from './score'
import {
  METRIC_KEYS,
  type CountyRisk,
  type CountySignal,
  type MetricKey,
} from './types'

/**
 * 由訊號組出每縣市的 CountyRisk。
 * #1：realSignals 省略 → 全用 mock。#2~#4：傳入真實訊號覆蓋對應 (code, metric)，
 * 同一格多來源時取較大值（MAX），與全球版一致。
 */
export function buildRiskData(realSignals: CountySignal[] = []): CountyRisk[] {
  return COUNTIES.map((county) => {
    const byMetric = new Map<MetricKey, CountySignal>()
    for (const s of buildMockSignals(county.code)) byMetric.set(s.metric, s)
    for (const s of realSignals) {
      if (s.code !== county.code) continue
      const existing = byMetric.get(s.metric)
      if (!existing || s.value > existing.value) byMetric.set(s.metric, s)
    }

    const subScores = {} as Record<MetricKey, number>
    let confSum = 0
    for (const k of METRIC_KEYS) {
      const sig = byMetric.get(k)!
      subScores[k] = sig.value
      confSum += sig.confidence
    }
    const score = calculateRiskScore(subScores)
    const confidence = Math.round((confSum / METRIC_KEYS.length) * 100) / 100
    const asOf = byMetric.get('economic')!.asOf

    return { code: county.code, name: county.name, score, subScores, confidence, asOf }
  })
}
