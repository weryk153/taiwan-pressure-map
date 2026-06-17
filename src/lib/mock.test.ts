import { describe, it, expect } from 'vitest'
import { buildMockSignals } from './mock'
import { METRIC_KEYS } from './types'

describe('buildMockSignals', () => {
  it('每縣市每指標各一筆訊號', () => {
    const sigs = buildMockSignals('63000')
    expect(sigs).toHaveLength(METRIC_KEYS.length)
    expect(sigs.every((s) => s.code === '63000')).toBe(true)
  })
  it('決定性：同 code 兩次結果相同', () => {
    expect(buildMockSignals('64000')).toEqual(buildMockSignals('64000'))
  })
  it('不同 code 結果不同', () => {
    expect(buildMockSignals('63000')).not.toEqual(buildMockSignals('64000'))
  })
  it('value 在 0–100、confidence 在 0–1', () => {
    for (const s of buildMockSignals('10016')) {
      expect(s.value).toBeGreaterThanOrEqual(0)
      expect(s.value).toBeLessThanOrEqual(100)
      expect(s.confidence).toBeGreaterThanOrEqual(0)
      expect(s.confidence).toBeLessThanOrEqual(1)
    }
  })
})
