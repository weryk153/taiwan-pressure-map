import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseIncome } from './economic'

const raw = readFileSync(resolve(__dirname, '../fixtures/economic-income.csv'), 'utf-8')

describe('parseIncome', () => {
  const { rows, asOf } = parseIncome(raw)
  const byCode = Object.fromEntries(rows.map((r) => [r.code, r.raw]))

  it('取最新年度（2024）', () => expect(asOf).toBe('2024'))

  it('解析出 20 縣市（不含金門/連江）', () => expect(rows.length).toBe(20))

  it('臺北市每戶可支配所得（萬元）為合理值', () => {
    expect(byCode['63000']).toBeGreaterThan(120)
    expect(byCode['63000']).toBeLessThan(170)
  })

  it('跳過臺灣地區彙總，code 皆為縣市', () => {
    expect(rows.every((r) => /\d{5}/.test(r.code))).toBe(true)
  })
})
