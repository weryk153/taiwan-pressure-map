import { describe, it, expect } from 'vitest'
import { buildRiskData } from './buildRiskData'
import { COUNTIES } from './counties'
import type { CountySignal } from './types'

const sig = (code: string, metric: any, value: number): CountySignal =>
  ({ code, metric, value, confidence: 0.85, asOf: '2024' })

describe('buildRiskData（真實訊號或留空）', () => {
  it('涵蓋全部 22 縣市', () => {
    expect(buildRiskData([])).toHaveLength(COUNTIES.length)
  })
  it('零訊號縣市 → hasData=false, score=null, subScores={}', () => {
    const r = buildRiskData([]).find((x) => x.code === '63000')!
    expect(r.hasData).toBe(false)
    expect(r.score).toBeNull()
    expect(r.subScores).toEqual({})
    expect(r.asOf).toBeNull()
  })
  it('部分指標 → 只計有資料者（重正規化），hasData=true', () => {
    const r = buildRiskData([sig('63000', 'economic', 80)]).find((x) => x.code === '63000')!
    expect(r.hasData).toBe(true)
    expect(r.subScores).toEqual({ economic: 80 })
    expect(r.score).toBe(80)
    expect(r.asOf).toBe('2024')
  })
  it('多來源同 (code, metric) 取 MAX', () => {
    const r = buildRiskData([sig('64000', 'safety', 40), sig('64000', 'safety', 70)])
      .find((x) => x.code === '64000')!
    expect(r.subScores.safety).toBe(70)
  })
  it('不同縣市互不影響', () => {
    const all = buildRiskData([sig('63000', 'economic', 90)])
    expect(all.find((x) => x.code === '64000')!.hasData).toBe(false)
  })
})
