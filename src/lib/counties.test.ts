import { describe, it, expect } from 'vitest'
import { COUNTIES, normalizeCountyName, findCountyByName } from './counties'

describe('COUNTIES', () => {
  it('有 22 個縣市', () => {
    expect(COUNTIES).toHaveLength(22)
  })
  it('code 唯一', () => {
    const codes = new Set(COUNTIES.map((c) => c.code))
    expect(codes.size).toBe(22)
  })
  it('包含六都與離島', () => {
    const names = COUNTIES.map((c) => c.name)
    expect(names).toContain('臺北市')
    expect(names).toContain('高雄市')
    expect(names).toContain('連江縣')
    expect(names).toContain('金門縣')
  })
})

describe('normalizeCountyName', () => {
  it('台 → 臺', () => {
    expect(normalizeCountyName('台北市')).toBe('臺北市')
    expect(normalizeCountyName('台中市')).toBe('臺中市')
  })
  it('已是臺則不變', () => {
    expect(normalizeCountyName('臺南市')).toBe('臺南市')
  })
  it('無台字不受影響', () => {
    expect(normalizeCountyName('新北市')).toBe('新北市')
  })
})

describe('findCountyByName', () => {
  it('台/臺 皆對到同一 code', () => {
    expect(findCountyByName('台北市')?.code).toBe('63000')
    expect(findCountyByName('臺北市')?.code).toBe('63000')
  })
  it('找不到回 undefined', () => {
    expect(findCountyByName('火星市')).toBeUndefined()
  })
})
