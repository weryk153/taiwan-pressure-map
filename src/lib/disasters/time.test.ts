import { describe, it, expect } from 'vitest'
import { parseTaiwanTime, formatTaipei } from './time'

describe('parseTaiwanTime', () => {
  it('無時區的 ISO 視為台灣時間（+08）', () => {
    expect(parseTaiwanTime('2026-06-18 18:00:00')).toBe(Date.parse('2026-06-18T18:00:00+08:00'))
    expect(parseTaiwanTime('2026-06-18T18:00:00')).toBe(Date.parse('2026-06-18T18:00:00+08:00'))
  })
  it('已帶時區則不變動', () => {
    expect(parseTaiwanTime('2026-05-20T20:25:35+08:00')).toBe(Date.parse('2026-05-20T20:25:35+08:00'))
    expect(parseTaiwanTime('2026-06-18T02:10:00Z')).toBe(Date.parse('2026-06-18T02:10:00Z'))
  })
  it('RFC822 GMT（Google News）原樣解析', () => {
    expect(parseTaiwanTime('Wed, 18 Jun 2026 02:10:00 GMT')).toBe(Date.parse('Wed, 18 Jun 2026 02:10:00 GMT'))
  })
  it('空/無效 → NaN', () => {
    expect(Number.isNaN(parseTaiwanTime(''))).toBe(true)
  })
})

describe('formatTaipei', () => {
  it('UTC 時間轉成台灣時間（+8）', () => {
    // 02:10 UTC = 台灣 10:10
    expect(formatTaipei('2026-06-18T02:10:00.000Z')).toBe('06-18 10:10')
  })
  it('已是 +08 的時間維持台灣壁鐘時間', () => {
    expect(formatTaipei('2026-05-20T20:25:35+08:00')).toBe('05-20 20:25')
  })
  it('無效字串原樣回傳', () => {
    expect(formatTaipei('not-a-date')).toBe('not-a-date')
  })
})
