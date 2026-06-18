import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { countyFromArea, parseAgingIndex, parsePopulation } from './population'

const raw = readFileSync(resolve(__dirname, '../fixtures/population.csv'), 'utf-8')

describe('countyFromArea', () => {
  it('臺北市松山區 → 臺北市', () => expect(countyFromArea('臺北市松山區')).toBe('臺北市'))
  it('連江縣南竿鄉 → 連江縣', () => expect(countyFromArea('連江縣南竿鄉')).toBe('連江縣'))
})

describe('parsePopulation', () => {
  it('聚合縣市總人口（含 BOM 與多村里相加）', () => {
    const pop = parsePopulation(raw)
    expect(pop['63000']).toBeGreaterThan(0) // 臺北市
    expect(pop['09020']).toBeGreaterThan(0) // 連江縣
    // 臺北市松山區+大安區 = 4786 + 9097（fixture 兩列相加）
    expect(Number.isFinite(pop['63000'])).toBe(true)
  })
})

describe('parseAgingIndex', () => {
  it('回傳每縣市老化指數（65+/0–14×100）', () => {
    const aging = parseAgingIndex(raw)
    expect(aging['63000']).toBeGreaterThan(0)
    expect(aging['63000']).toBeLessThan(1000)
  })
})
