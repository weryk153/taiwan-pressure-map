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
  score: number | null
  subScores: Partial<Record<MetricKey, number>>
  confidence: number
  asOf: string | null
  hasData: boolean
}

export interface SourceMeta {
  metric: MetricKey
  label: string
  agency: string
  asOf: string
  status: 'live' | 'missing'
  url?: string
}

export interface PressureData {
  signals: CountySignal[]
  sources: SourceMeta[]
  builtAt: string
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface PressurePeriod {
  asOf: string
  scores: Record<string, number>
}

export interface PressureHistory {
  periods: PressurePeriod[]
}
