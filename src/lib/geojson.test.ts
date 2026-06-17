import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { COUNTIES, normalizeCountyName } from './counties'

const geo = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../public/taiwan-counties.json'), 'utf8'),
)

describe('taiwan-counties.json', () => {
  it('是 FeatureCollection', () => {
    expect(geo.type).toBe('FeatureCollection')
  })
  it('有 22 個 feature', () => {
    expect(geo.features).toHaveLength(22)
  })
  it('每個 feature 有非空 COUNTYCODE 且能對到縣市清單', () => {
    const codes = new Set(COUNTIES.map((c) => c.code))
    for (const f of geo.features) {
      const code = f.properties?.COUNTYCODE
      expect(code, JSON.stringify(f.properties)).toBeTruthy()
      expect(codes.has(code), `未知 code: ${code}`).toBe(true)
    }
  })
  it('每個縣市清單項目都對得到一個 feature', () => {
    const geoCodes = new Set(geo.features.map((f: any) => f.properties.COUNTYCODE))
    for (const c of COUNTIES) {
      expect(geoCodes.has(c.code), `GeoJSON 缺 ${c.name}`).toBe(true)
    }
  })
  it('COUNTYNAME 已正規化（無「台」字）', () => {
    for (const f of geo.features) {
      expect(f.properties.COUNTYNAME).toBe(normalizeCountyName(f.properties.COUNTYNAME))
    }
  })
})
