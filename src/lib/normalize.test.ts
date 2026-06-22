import { describe, it, expect } from 'vitest'
import { THRESHOLDS, normalizeMetric } from './normalize'
import { METRIC_KEYS } from './types'

describe('THRESHOLDS', () => {
  it('五個指標都有 lo/hi', () => {
    for (const k of METRIC_KEYS) {
      expect(THRESHOLDS[k]).toBeDefined()
      expect(typeof THRESHOLDS[k].lo).toBe('number')
      expect(typeof THRESHOLDS[k].hi).toBe('number')
    }
  })
})

describe('normalizeMetric', () => {
  it('lo→0、hi→100、中間線性', () => {
    expect(normalizeMetric('safety', 800)).toBe(0)
    expect(normalizeMetric('safety', 2500)).toBe(100)
    expect(normalizeMetric('safety', 1650)).toBe(50)
  })
  it('超界裁切', () => {
    expect(normalizeMetric('safety', 100)).toBe(0)
    expect(normalizeMetric('safety', 9999)).toBe(100)
  })
  it('醫療為反向（床多→壓力低）', () => {
    expect(normalizeMetric('healthcare', 80)).toBe(0)
    expect(normalizeMetric('healthcare', 20)).toBe(100)
    expect(normalizeMetric('healthcare', 50)).toBe(50)
  })
  it('每戶可支配所得為反向（所得高→壓力低）', () => {
    expect(normalizeMetric('economic', 155)).toBe(0)
    expect(normalizeMetric('economic', 75)).toBe(100)
    expect(normalizeMetric('economic', 115)).toBe(50)
  })
})
