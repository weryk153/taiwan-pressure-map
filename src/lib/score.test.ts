import { describe, it, expect } from 'vitest'
import { WEIGHTS, calculateRiskScore, toRiskLevel } from './score'

describe('WEIGHTS', () => {
  it('權重和為 1', () => {
    const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 5)
  })
})

describe('calculateRiskScore', () => {
  it('全指標相同值 → 同值', () => {
    expect(calculateRiskScore({
      economic: 50, housing: 50, demographic: 50, safety: 50, healthcare: 50,
    })).toBe(50)
  })
  it('依權重加權', () => {
    expect(calculateRiskScore({
      economic: 100, housing: 0, demographic: 0, safety: 0, healthcare: 0,
    })).toBe(25)
  })
  it('缺值時重新分配權重（只算現有指標）', () => {
    expect(calculateRiskScore({ economic: 80 })).toBe(80)
  })
  it('全缺 → 0', () => {
    expect(calculateRiskScore({})).toBe(0)
  })
})

describe('toRiskLevel', () => {
  it('分級', () => {
    expect(toRiskLevel(10)).toBe('low')
    expect(toRiskLevel(40)).toBe('medium')
    expect(toRiskLevel(60)).toBe('high')
    expect(toRiskLevel(90)).toBe('critical')
  })
})
