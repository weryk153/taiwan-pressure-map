import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseUnemployment } from './economic'

const raw = readFileSync(resolve(__dirname, '../fixtures/economic.xml'), 'utf-8')

describe('parseUnemployment', () => {
  const { rows, asOf } = parseUnemployment(raw)
  const byCode = Object.fromEntries(rows.map((r) => [r.code, r.raw]))

  it('取最新整年度（2025）', () => expect(asOf).toBe('2025'))

  it('解析出多個縣市', () => expect(rows.length).toBeGreaterThanOrEqual(15))

  it('臺北市失業率為合理數值', () => {
    expect(byCode['63000']).toBe(3.4)
  })

  it('跳過地區彙總（北部地區等不在縣市表中）', () => {
    // 全部 code 都應對得上已知縣市（彙總名找不到縣市會被丟棄）
    expect(rows.every((r) => /\d{5}/.test(r.code))).toBe(true)
  })
})
