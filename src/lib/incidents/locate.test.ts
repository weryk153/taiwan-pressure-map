import { describe, it, expect } from 'vitest'
import { buildTownIndex, locateTown, locateIncidents, type TownCentroid } from './locate'
import type { DisasterEvent } from '@/lib/disasters/types'

const TOWNS: TownCentroid[] = [
  { town: '西屯區', county_id: '66000', lng: 120.64, lat: 24.18 }, // 臺中
  { town: '東區', county_id: '66000', lng: 120.71, lat: 24.13 }, // 臺中東區
  { town: '東區', county_id: '67000', lng: 120.22, lat: 22.98 }, // 臺南東區
  { town: '板橋區', county_id: '65000', lng: 121.46, lat: 25.01 }, // 新北
]
const idx = buildTownIndex(TOWNS)

describe('locateTown', () => {
  it('標題寫到區 → 回該區中心', () => {
    expect(locateTown('台中市西屯區工廠大火', ['66000'], idx)).toEqual([120.64, 24.18])
  })

  it('同名區用縣市消歧義（台南東區，不是台中東區）', () => {
    expect(locateTown('台南市東區槍擊案', ['67000'], idx)).toEqual([120.22, 22.98])
  })

  it('標題沒寫到區 → null（退回縣市中心）', () => {
    expect(locateTown('宜蘭縣某地火警', ['10002'], idx)).toBeNull()
  })
})

describe('locateIncidents', () => {
  const base: DisasterEvent = {
    id: 'n1',
    type: 'incident',
    title: '新北市板橋區住宅火警',
    severity: 'warning',
    countyCodes: ['65000'],
    time: '2026-06-22T10:00:00',
    source: 'NEWS',
  }

  it('補上鄉鎮級座標', () => {
    const [out] = locateIncidents([base], TOWNS)
    expect(out.lon).toBe(121.46)
    expect(out.lat).toBe(25.01)
  })

  it('已有座標者（如地震）原樣保留', () => {
    const eq: DisasterEvent = { ...base, lat: 23.5, lon: 121.0 }
    const [out] = locateIncidents([eq], TOWNS)
    expect(out.lat).toBe(23.5)
    expect(out.lon).toBe(121.0)
  })
})
