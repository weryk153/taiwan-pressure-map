import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseAreaCode, parseBeds } from './healthcare'

const beds = readFileSync(resolve(__dirname, '../fixtures/beds.csv'), 'utf-8')
const area = readFileSync(resolve(__dirname, '../fixtures/beds-areacode.csv'), 'utf-8')

describe('parseAreaCode', () => {
  const map = parseAreaCode(area)
  it('鄉鎮市區碼 → 區域名稱', () => {
    expect(map['101']).toBe('臺北市松山區')
    expect(map['102']).toBe('臺北市大安區')
  })
})

describe('parseBeds', () => {
  const byCode = parseBeds(beds, area)
  it('加總縣市病床總計', () => {
    // fixture 五區皆臺北市：1089+1853+2888+1118+2248 = 9196
    expect(byCode['63000']).toBe(9196)
  })
  it('只回傳有對應的縣市', () => {
    expect(Object.keys(byCode)).toEqual(['63000'])
  })
})
