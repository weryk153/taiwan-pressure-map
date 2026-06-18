import { describe, it, expect } from 'vitest'
import eq from './fixtures/eq.json'
import weather from './fixtures/weather.json'
import cap from './fixtures/cap.json'
import ncdrReal from './fixtures/ncdr-real.json'
import { parseEarthquakes, parseWeatherAlerts, parseCapAlerts } from './parse'

// 固定「現在」對齊 fixtures 日期，避免時間流逝讓 recency/expiry 過濾改變結果
const NOW = Date.parse('2026-06-18T10:00:00+08:00')

describe('parseEarthquakes', () => {
  const events = parseEarthquakes(eq, NOW)
  it('一個地震事件', () => expect(events).toHaveLength(1))
  it('規模、震央、來源', () => {
    const e = events[0]
    expect(e.type).toBe('earthquake')
    expect(e.magnitude).toBe(5.4)
    expect(e.lat).toBe(23.7)
    expect(e.lon).toBe(121.4)
    expect(e.source).toBe('CWA')
  })
  it('受影響縣市對到 code（花蓮/臺東/南投）', () => {
    expect(events[0].countyCodes).toEqual(expect.arrayContaining(['10015', '10014', '10009']))
  })
  it('規模 5.4 + 震度 5弱 → severe', () => {
    expect(events[0].severity).toBe('severe')
  })
  it('超過 30 天的地震被過濾', () => {
    const old = parseEarthquakes(eq, Date.parse('2026-08-01T00:00:00+08:00'))
    expect(old).toHaveLength(0)
  })
})

describe('parseWeatherAlerts', () => {
  const events = parseWeatherAlerts(weather, NOW)
  it('兩個縣市特報', () => expect(events).toHaveLength(2))
  it('宜蘭豪雨 → warning、對到 code', () => {
    const yilan = events.find((e) => e.countyCodes.includes('10002'))!
    expect(yilan.type).toBe('weather')
    expect(yilan.severity).toBe('warning')
    expect(yilan.title).toContain('豪雨')
  })
  it('已過期特報被過濾', () => {
    const expired = parseWeatherAlerts(weather, Date.parse('2026-06-19T00:00:00+08:00'))
    expect(expired).toHaveLength(0)
  })
})

describe('parseCapAlerts（簡化 {alerts} 格式）', () => {
  const events = parseCapAlerts(cap)
  it('兩筆告警', () => expect(events).toHaveLength(2))
  it('土石流紅色警戒 Severe → severe、南投', () => {
    const e = events.find((x) => x.countyCodes.includes('10009'))!
    expect(e.type).toBe('alert')
    expect(e.severity).toBe('severe')
    expect(e.source).toBe('NCDR')
  })
})

describe('parseCapAlerts（真實 NCDR {entry} 格式）', () => {
  const events = parseCapAlerts(ncdrReal)
  it('排除例行「停水」', () => {
    expect(events.every((e) => !e.title.includes('停水'))).toBe(true)
  })
  it('高溫 → 從 summary 內文抓出多縣市（彰化/雲林/花蓮/臺東）', () => {
    const heat = events.find((e) => e.title === '高溫')!
    expect(heat.countyCodes).toEqual(expect.arrayContaining(['10008', '10010', '10015', '10014']))
  })
  it('淹水「一級警戒」→ severe、屏東', () => {
    const flood = events.find((e) => e.title === '淹水')!
    expect(flood.countyCodes).toContain('10013')
    expect(flood.severity).toBe('severe')
  })
})
