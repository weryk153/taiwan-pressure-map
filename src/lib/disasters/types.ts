export type DisasterType = 'earthquake' | 'weather' | 'alert' | 'incident'
export type Severity = 'info' | 'warning' | 'severe'

export interface DisasterEvent {
  id: string
  type: DisasterType
  title: string
  severity: Severity
  countyCodes: string[]
  time: string
  source: 'CWA' | 'NCDR' | 'NEWS'
  url?: string
  lat?: number
  lon?: number
  magnitude?: number
  raw?: unknown
}

export interface DisasterResponse {
  eq: unknown | null
  weather: unknown | null
  cap: unknown | null
  fetchedAt: string
  sources: { eq: 'ok' | 'error'; weather: 'ok' | 'error'; cap: 'ok' | 'error' }
}
