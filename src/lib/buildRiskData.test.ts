import { describe, it, expect } from 'vitest'
import { buildRiskData } from './buildRiskData'
import { buildMockSignals } from './mock'
import { COUNTIES } from './counties'
import type { CountySignal } from './types'

describe('buildRiskData', () => {
  const risks = buildRiskData()
  it('涵蓋全部 22 縣市', () => {
    expect(risks).toHaveLength(COUNTIES.length)
  })
  it('每縣市有名稱、score、5 個 subScores、confidence', () => {
    const taipei = risks.find((r) => r.code === '63000')!
    expect(taipei.name).toBe('臺北市')
    expect(taipei.score).toBeGreaterThanOrEqual(0)
    expect(taipei.score).toBeLessThanOrEqual(100)
    expect(Object.keys(taipei.subScores)).toHaveLength(5)
    expect(taipei.confidence).toBeGreaterThan(0)
  })
  it('決定性', () => {
    expect(buildRiskData()).toEqual(risks)
  })

  // realSignals 合併路徑：#2~#4 的真實 adapter 全靠這個 seam，先鎖住合約
  it('真實訊號數值較高 → 覆蓋 mock', () => {
    const mockEcon = buildMockSignals('64000').find((s) => s.metric === 'economic')!.value
    const sig: CountySignal = { code: '64000', metric: 'economic', value: mockEcon + 5, confidence: 1, asOf: '2026-06-16' }
    const r = buildRiskData([sig]).find((x) => x.code === '64000')!
    expect(r.subScores.economic).toBe(mockEcon + 5)
  })
  it('真實訊號數值較低 → 不覆蓋（取 MAX）', () => {
    const mockEcon = buildMockSignals('64000').find((s) => s.metric === 'economic')!.value
    const sig: CountySignal = { code: '64000', metric: 'economic', value: Math.max(0, mockEcon - 5), confidence: 1, asOf: '2026-06-16' }
    const r = buildRiskData([sig]).find((x) => x.code === '64000')!
    expect(r.subScores.economic).toBe(mockEcon)
  })
  it('只影響相符的 (code, metric)，其他縣市不受影響', () => {
    const sig: CountySignal = { code: '63000', metric: 'economic', value: 100, confidence: 1, asOf: '2026-06-16' }
    const withSig = buildRiskData([sig])
    const baseline = buildRiskData()
    expect(withSig.find((r) => r.code === '64000')).toEqual(baseline.find((r) => r.code === '64000'))
  })
})
