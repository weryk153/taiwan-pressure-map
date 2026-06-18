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
  rawValues: Partial<Record<MetricKey, number>> // 原始真實值（失業率%/老化指數/刑案率/病床/房價所得比）
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
