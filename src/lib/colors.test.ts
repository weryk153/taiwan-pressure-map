import { describe, it, expect } from 'vitest'
import { scoreColor, LEVEL_LABEL } from './colors'

describe('scoreColor', () => {
  it('回傳 hex 顏色字串', () => {
    expect(scoreColor(10)).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(scoreColor(90)).toMatch(/^#[0-9a-fA-F]{6}$/)
  })
  it('低分與高分顏色不同', () => {
    expect(scoreColor(10)).not.toBe(scoreColor(90))
  })
})

describe('LEVEL_LABEL', () => {
  it('四級皆有繁中標籤', () => {
    expect(LEVEL_LABEL.low).toBe('低')
    expect(LEVEL_LABEL.critical).toBe('危急')
  })
})
