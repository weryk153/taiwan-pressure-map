import { COUNTIES, findCountyByName, normalizeCountyName } from '@/lib/counties'
import type { DisasterEvent, Severity } from './types'

const codeOf = (name: string): string | undefined => findCountyByName(name?.trim())?.code

/** 從一段文字掃出提到的縣市 code（NCDR 告警把受影響縣市寫在 summary 內文）。 */
function countyCodesInText(text: string): string[] {
  const t = normalizeCountyName(text || '')
  const out: string[] = []
  for (const c of COUNTIES) {
    if (t.includes(normalizeCountyName(c.name))) out.push(c.code)
  }
  return out
}

const DAY = 86_400_000

function intensityLevel(s: string): number {
  const m = String(s).match(/(\d+)/)
  return m ? Number(m[1]) : 0
}

const EQ_WINDOW_DAYS = 30

export function parseEarthquakes(json: any, nowMs: number = Date.now()): DisasterEvent[] {
  const list: any[] = json?.records?.Earthquake ?? []
  return list
    .map((q, i) => {
      const info = q.EarthquakeInfo ?? {}
      const mag = Number(info.EarthquakeMagnitude?.MagnitudeValue) || undefined
      const lat = Number(info.Epicenter?.EpicenterLatitude) || undefined
      const lon = Number(info.Epicenter?.EpicenterLongitude) || undefined
      const areas: any[] = q.Intensity?.ShakingArea ?? []
      const codes = new Set<string>()
      let maxInt = 0
      for (const a of areas) {
        const c = codeOf(a.CountyName)
        if (c) codes.add(c)
        maxInt = Math.max(maxInt, intensityLevel(a.AreaIntensity))
      }
      const severity: Severity =
        (mag && mag >= 6) || maxInt >= 5 ? 'severe' : (mag && mag >= 4) || maxInt >= 4 ? 'warning' : 'info'
      const originTime = (info.OriginTime ?? '').replace(' ', 'T')
      return {
        id: `cwa-eq-${q.EarthquakeNo ?? i}`,
        type: 'earthquake' as const,
        title: `規模 ${mag ?? '?'} 地震`,
        severity,
        countyCodes: [...codes],
        time: originTime,
        source: 'CWA' as const,
        lat, lon, magnitude: mag, raw: q,
      }
    })
    .filter((e) => {
      const t = Date.parse(e.time)
      return Number.isNaN(t) ? true : nowMs - t <= EQ_WINDOW_DAYS * DAY
    })
}

const SEVERE_WX = ['大豪雨', '超大豪雨', '颱風', '陸上颱風', '海上颱風']
const WARNING_WX = ['豪雨', '大雨', '強風', '陸上強風', '長浪', '大雷雨']

export function parseWeatherAlerts(json: any, nowMs: number = Date.now()): DisasterEvent[] {
  const locs: any[] = json?.records?.location ?? []
  const out: DisasterEvent[] = []
  for (const loc of locs) {
    const code = codeOf(loc.locationName)
    if (!code) continue
    const hazards: any[] = loc.hazardConditions?.hazards ?? []
    for (const h of hazards) {
      const end = Date.parse((h.validTime?.endTime ?? '').replace(' ', 'T'))
      if (!Number.isNaN(end) && end < nowMs) continue // 已過期
      const phenom = h.info?.phenomena ?? '特報'
      const severity: Severity = SEVERE_WX.includes(phenom) ? 'severe' : WARNING_WX.includes(phenom) ? 'warning' : 'info'
      const start = (h.validTime?.startTime ?? '').replace(' ', 'T')
      out.push({
        id: `cwa-wx-${code}-${phenom}`,
        type: 'weather', title: `${phenom}特報`, severity,
        countyCodes: [code], time: start, source: 'CWA', raw: h,
      })
    }
  }
  return out
}

const CAP_SEVERITY: Record<string, Severity> = { Extreme: 'severe', Severe: 'severe', Moderate: 'warning', Minor: 'info' }

// 排除例行/行政類（非即時災害）：停水、消防安全檢查、淹水感測、海洋污染
const NCDR_BLOCK = ['停水', '消防', '淹水感測', '海洋污染']

function capSeverityFromText(text: string): Severity {
  if (/紅色|一級|嚴重|劇烈|海嘯警報|陸上颱風|大豪雨/.test(text)) return 'severe'
  // 橙色/二三級/正式特報/明確災害現象 → 注意；黃色燈號、請注意、高溫等屬諮詢性 → info
  if (/橙色|二級|三級|警戒|特報|豪雨|大雨|強風|淹水|土石流|海嘯/.test(text)) return 'warning'
  return 'info'
}

/**
 * NCDR 災防告警。支援兩種輸入：
 *  - 真實 ATOM-JSON `{ entry: [{ id, title, summary:{'#text'}, category:{'@term'} }] }`
 *  - 簡化 `{ alerts: [{ event, severity, areas }] }`（測試用）
 * 受影響縣市：真實格式從 summary 內文掃；簡化格式從 areas。去重（類別+縣市）。
 */
export function parseCapAlerts(json: any): DisasterEvent[] {
  const entries: any[] = json?.entry ?? json?.alerts ?? []
  const seen = new Set<string>()
  const out: DisasterEvent[] = []
  for (const e of entries) {
    const category = e.category?.['@term'] ?? e.title ?? e.event ?? '災防告警'
    if (NCDR_BLOCK.some((b) => String(category).includes(b))) continue
    const summary = e.summary?.['#text'] ?? e.summary ?? ''
    const textCodes = countyCodesInText(`${category} ${summary}`)
    const areaCodes = (e.areas ?? []).map((n: string) => codeOf(n)).filter(Boolean) as string[]
    const codes = textCodes.length ? textCodes : areaCodes
    if (codes.length === 0) continue
    const severity: Severity = e.severity
      ? (CAP_SEVERITY[e.severity] ?? capSeverityFromText(`${category} ${summary}`))
      : capSeverityFromText(`${category} ${summary}`)
    const key = `${category}|${[...codes].sort().join(',')}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      id: `ncdr-${e.id ?? out.length}`,
      type: 'alert',
      title: String(category),
      severity,
      countyCodes: codes,
      time: e.updated ?? e.sent ?? '',
      source: 'NCDR',
      raw: e,
    })
  }
  return out
}

export function parseDisasters(eq: unknown, weather: unknown, cap: unknown, nowMs: number = Date.now()): DisasterEvent[] {
  return [
    ...(eq ? parseEarthquakes(eq, nowMs) : []),
    ...(weather ? parseWeatherAlerts(weather, nowMs) : []),
    ...(cap ? parseCapAlerts(cap) : []),
  ]
}
