import { findCountyByName } from '@/lib/counties'
import type { DisasterEvent, Severity } from './types'

const codeOf = (name: string): string | undefined => findCountyByName(name?.trim())?.code

function intensityLevel(s: string): number {
  const m = String(s).match(/(\d+)/)
  return m ? Number(m[1]) : 0
}

export function parseEarthquakes(json: any): DisasterEvent[] {
  const list: any[] = json?.records?.Earthquake ?? []
  return list.map((q, i) => {
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
}

const SEVERE_WX = ['大豪雨', '超大豪雨', '颱風', '陸上颱風', '海上颱風']
const WARNING_WX = ['豪雨', '大雨', '強風', '陸上強風', '長浪', '大雷雨']

export function parseWeatherAlerts(json: any): DisasterEvent[] {
  const locs: any[] = json?.records?.location ?? []
  const out: DisasterEvent[] = []
  for (const loc of locs) {
    const code = codeOf(loc.locationName)
    if (!code) continue
    const hazards: any[] = loc.hazardConditions?.hazards ?? []
    for (const h of hazards) {
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

export function parseCapAlerts(json: any): DisasterEvent[] {
  const alerts: any[] = json?.alerts ?? []
  return alerts.map((a, i) => {
    const codes = (a.areas ?? []).map((n: string) => codeOf(n)).filter(Boolean) as string[]
    return {
      id: `ncdr-${a.id ?? i}`,
      type: 'alert' as const,
      title: a.event ?? '災防告警',
      severity: CAP_SEVERITY[a.severity] ?? 'info',
      countyCodes: codes,
      time: a.sent ?? '',
      source: 'NCDR' as const,
      raw: a,
    }
  })
}

export function parseDisasters(eq: unknown, weather: unknown, cap: unknown): DisasterEvent[] {
  return [
    ...(eq ? parseEarthquakes(eq) : []),
    ...(weather ? parseWeatherAlerts(weather) : []),
    ...(cap ? parseCapAlerts(cap) : []),
  ]
}
