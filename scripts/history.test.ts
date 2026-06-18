import { describe, it, expect } from 'vitest'
import { mergeHistory } from './history'
import type { CountyRisk } from '../src/lib/types'

const risk = (code: string, score: number | null): CountyRisk =>
  ({ code, name: code, score, subScores: {}, confidence: 1, asOf: '2026', hasData: score !== null })

describe('mergeHistory', () => {
  it('新增一期，略過 score=null', () => {
    const h = mergeHistory({ periods: [] }, '2026-06-18', [risk('63000', 49), risk('09020', null)])
    expect(h.periods).toHaveLength(1)
    expect(h.periods[0].scores).toEqual({ '63000': 49 })
  })
  it('同日期取代、不重複', () => {
    let h = mergeHistory({ periods: [] }, '2026-06-18', [risk('63000', 49)])
    h = mergeHistory(h, '2026-06-18', [risk('63000', 55)])
    expect(h.periods).toHaveLength(1)
    expect(h.periods[0].scores['63000']).toBe(55)
  })
  it('不同日期累積、升冪排序', () => {
    let h = mergeHistory({ periods: [] }, '2026-06-18', [risk('63000', 49)])
    h = mergeHistory(h, '2026-05-01', [risk('63000', 40)])
    expect(h.periods.map((p) => p.asOf)).toEqual(['2026-05-01', '2026-06-18'])
  })
})
