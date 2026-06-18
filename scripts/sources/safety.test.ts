import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseCrime } from './safety'

const raw = readFileSync(resolve(__dirname, '../fixtures/safety.csv'), 'utf-8')

describe('parseCrime', () => {
  const rows = parseCrime(raw)
  const byCode = Object.fromEntries(rows.map((r) => [r.code, r.count]))

  it('解析整年度縣市件數', () => {
    expect(byCode['65000']).toBe(62682) // 新北市
    expect(byCode['63000']).toBe(48250) // 臺北市
    expect(byCode['09020']).toBe(249) // 連江縣
  })

  it('排除機關別總計與署所屬機關', () => {
    expect(rows.find((r) => r.count === 399926)).toBeUndefined() // 機關別總計
    expect(rows.find((r) => r.count === 7353)).toBeUndefined() // 署所屬機關
  })

  it('排除月份區塊（只取整年度）', () => {
    // 113年 1月 新北市=3100 不應出現；新北市應只有整年度的 62682
    expect(rows.filter((r) => r.code === '65000').length).toBe(1)
  })
})
