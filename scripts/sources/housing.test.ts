import { describe, expect, it } from 'vitest'
import { housing, parseHousing } from './housing'

// 房價所得比目前無可用來源（PDF only）；以手造樣本驗證預備 parser 正確。
const sample = `縣市,房價所得比
臺北市,15.8
新北市,12.3
高雄市,8.1`

describe('parseHousing (預備 parser)', () => {
  it('解析兩欄 CSV', () => {
    const rows = parseHousing(sample)
    const byCode = Object.fromEntries(rows.map((r) => [r.code, r.raw]))
    expect(byCode['63000']).toBe(15.8) // 臺北市
    expect(byCode['65000']).toBe(12.3) // 新北市
    expect(byCode['64000']).toBe(8.1) // 高雄市
  })
})

describe('housing fetcher', () => {
  it('因無穩定來源而 throw（留空）', async () => {
    await expect(housing()).rejects.toThrow('無穩定來源')
  })
})
