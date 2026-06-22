import type { DisasterEvent } from '@/lib/disasters/types'

export interface TownCentroid {
  town: string
  county_id: string
  lng: number
  lat: number
}

/**
 * county_id → 該縣市鄉鎮清單（名稱長者優先，避免短名誤配長名的子字串）。
 * county_id 與本專案 COUNTYCODE 同為內政部 5 碼，可直接對應。
 */
export function buildTownIndex(towns: TownCentroid[]): Map<string, TownCentroid[]> {
  const idx = new Map<string, TownCentroid[]>()
  for (const t of towns) {
    if (!idx.has(t.county_id)) idx.set(t.county_id, [])
    idx.get(t.county_id)!.push(t)
  }
  for (const list of idx.values()) list.sort((a, b) => b.town.length - a.town.length)
  return idx
}

/**
 * 在事件影響的縣市範圍內，找新聞標題提到的鄉鎮市區 → 回其中心 [lng,lat]；找不到回 null。
 * 限定在「已比對到的縣市」內比對，可消除同名區（東區/中正區…）的歧義。
 * 比對完整鄉鎮名（含 區/鄉/鎮/市 字尾），避免「和平」誤配「和平區」之類。
 */
export function locateTown(
  title: string,
  countyCodes: string[],
  idx: Map<string, TownCentroid[]>,
): [number, number] | null {
  for (const code of countyCodes) {
    const towns = idx.get(code)
    if (!towns) continue
    for (const t of towns) {
      if (title.includes(t.town)) return [t.lng, t.lat]
    }
  }
  return null
}

/** 對事件補上鄉鎮級經緯度（標題有寫到區鄉鎮時）；已有座標者（如地震）原樣保留。 */
export function locateIncidents(events: DisasterEvent[], towns: TownCentroid[]): DisasterEvent[] {
  if (towns.length === 0) return events
  const idx = buildTownIndex(towns)
  return events.map((e) => {
    if (e.lat != null || e.lon != null) return e
    const p = locateTown(e.title, e.countyCodes, idx)
    return p ? { ...e, lon: p[0], lat: p[1] } : e
  })
}
