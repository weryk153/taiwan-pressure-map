import { describe, it, expect } from 'vitest'
import { buildRiskData } from './buildRiskData'
import { COUNTIES } from './counties'

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
})
