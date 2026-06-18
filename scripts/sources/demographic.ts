import { normalizeMetric } from '../../src/lib/normalize'
import { loadAgingIndex } from './population'
import type { SourceFetcher } from './types'

/**
 * 老化指數＝65 歲以上人口 / 0–14 歲人口 × 100。
 * 由戶政司「村里單一年齡人口」CSV（dataset 77132）逐縣市聚合計算（見 population.ts）。
 */
const URL = 'https://data.gov.tw/dataset/77132'
const AS_OF = '2026-05' // 資源 11505（民國115年5月）

export const demographic: SourceFetcher = async () => {
  const aging = await loadAgingIndex()
  const codes = Object.keys(aging)
  if (codes.length === 0) throw new Error('demographic 解析 0 筆')
  return {
    signals: codes.map((code) => ({
      code,
      metric: 'demographic' as const,
      value: normalizeMetric('demographic', aging[code]),
      confidence: 0.85,
      asOf: AS_OF,
      raw: Math.round(aging[code] * 10) / 10,
    })),
    meta: { metric: 'demographic', label: '老化指數', agency: '內政部戶政司', asOf: AS_OF, status: 'live', url: URL },
  }
}
