import { COUNTIES } from './counties'
import { calculateRiskScore } from './score'
import {
  METRIC_KEYS,
  type CountyRisk,
  type CountySignal,
  type MetricKey,
} from './types'

/**
 * 由真實訊號組出每縣市 CountyRisk。無 mock：缺的指標就缺。
 * 同一 (code, metric) 多來源取 MAX。零訊號縣市 → 無資料。
 */
export function buildRiskData(signals: CountySignal[]): CountyRisk[] {
  const byCounty = new Map<string, Map<MetricKey, CountySignal>>()
  for (const s of signals) {
    if (!byCounty.has(s.code)) byCounty.set(s.code, new Map())
    const m = byCounty.get(s.code)!
    const existing = m.get(s.metric)
    if (!existing || s.value > existing.value) m.set(s.metric, s)
  }

  return COUNTIES.map((county) => {
    const m = byCounty.get(county.code)
    const subScores: Partial<Record<MetricKey, number>> = {}
    const rawValues: Partial<Record<MetricKey, number>> = {}
    let confSum = 0
    let n = 0
    let asOf: string | null = null
    if (m) {
      for (const k of METRIC_KEYS) {
        const sig = m.get(k)
        if (!sig) continue
        subScores[k] = sig.value
        if (typeof sig.raw === 'number') rawValues[k] = sig.raw // 原始真實值
        confSum += sig.confidence
        n += 1
        if (sig.asOf && (!asOf || sig.asOf > asOf)) asOf = sig.asOf
      }
    }
    const hasData = n > 0
    return {
      code: county.code,
      name: county.name,
      score: hasData ? calculateRiskScore(subScores) : null,
      subScores,
      rawValues,
      confidence: hasData ? Math.round((confSum / n) * 100) / 100 : 0,
      asOf,
      hasData,
    }
  })
}
