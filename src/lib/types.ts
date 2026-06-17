export type CountyCode = string

export interface County {
  code: CountyCode
  name: string // 繁中官方名（臺/台 正規化後）
}

export type MetricKey = 'economic' | 'housing' | 'demographic' | 'safety' | 'healthcare'

export const METRIC_KEYS: MetricKey[] = ['economic', 'housing', 'demographic', 'safety', 'healthcare']

export interface CountySignal {
  code: CountyCode
  metric: MetricKey
  value: number // 0–100
  confidence: number // 0–1
  asOf: string
  raw?: unknown
}

export interface CountyRisk {
  code: CountyCode
  name: string
  score: number // 0–100
  subScores: Record<MetricKey, number>
  confidence: number // 0–1
  asOf: string
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
