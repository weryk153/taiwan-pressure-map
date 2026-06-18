import { describe, expect, it } from 'vitest'
import { housing, parseHousing, snapshotRows } from './housing'

// 房價所得比目前無可用來源（PDF only）；以手造樣本驗證預備 parser 正確。
const sample = `縣市,房價所得比
臺北市,15.8
新北市,12.3
高雄市,8.1`

describe('parseHousing (預備 parser)', () => {
  it('解析兩欄 CSV', () => {
    const rows = parseHousing(sample)
    const byCode = Object.fromEntries(rows.map((r) => [r.code, r.raw]))
    expect(byCode['63000']).toBe(15.8)
    expect(byCode['65000']).toBe(12.3)
    expect(byCode['64000']).toBe(8.1)
  })
})

describe('snapshotRows', () => {
  it('縣市名 → code（含臺/台正規化）', () => {
    const rows = snapshotRows({ 台北市: 14.62, 高雄市: 9.16 })
    const byCode = Object.fromEntries(rows.map((r) => [r.code, r.raw]))
    expect(byCode['63000']).toBe(14.62)
    expect(byCode['64000']).toBe(9.16)
  })
})

describe('housing fetcher（手動快照）', () => {
  it('回傳 19 縣市的 live 訊號', async () => {
    const r = await housing()
    expect(r.meta.status).toBe('live')
    expect(r.signals).toHaveLength(19)
  })
  it('正規化正確：臺北 14.62 倍 → (14.62-5)/12 ≈ 80', async () => {
    const r = await housing()
    const taipei = r.signals.find((s) => s.code === '63000')!
    expect(taipei.value).toBe(80)
    expect(taipei.metric).toBe('housing')
  })
})
