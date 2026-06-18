import type { Severity } from '@/lib/disasters/types'

export interface IncidentCategory {
  key: string
  label: string
  query: string
  severity: Severity
}

export const INCIDENT_CATEGORIES: IncidentCategory[] = [
  { key: 'fire', label: '火災', query: '火災', severity: 'warning' },
  { key: 'crash', label: '車禍', query: '車禍 OR 死亡車禍', severity: 'info' },
  { key: 'homicide', label: '命案', query: '命案 OR 兇殺', severity: 'warning' },
  { key: 'shooting', label: '槍擊', query: '槍擊', severity: 'warning' },
  { key: 'industrial', label: '工安', query: '工安意外 OR 墜樓意外', severity: 'info' },
  { key: 'explosion', label: '氣爆', query: '氣爆 OR 爆炸', severity: 'warning' },
]

export const CATEGORY_BY_KEY: Record<string, IncidentCategory> =
  Object.fromEntries(INCIDENT_CATEGORIES.map((c) => [c.key, c]))
