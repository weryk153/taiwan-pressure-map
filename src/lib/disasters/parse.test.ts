import { describe, it, expect } from 'vitest'
import eq from './fixtures/eq.json'
import weather from './fixtures/weather.json'
import cap from './fixtures/cap.json'
import { parseEarthquakes, parseWeatherAlerts, parseCapAlerts } from './parse'

describe('parseEarthquakes', () => {
  const events = parseEarthquakes(eq)
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
})

describe('parseWeatherAlerts', () => {
  const events = parseWeatherAlerts(weather)
  it('兩個縣市特報', () => expect(events).toHaveLength(2))
  it('宜蘭豪雨 → warning、對到 code', () => {
    const yilan = events.find((e) => e.countyCodes.includes('10002'))!
    expect(yilan.type).toBe('weather')
    expect(yilan.severity).toBe('warning')
    expect(yilan.title).toContain('豪雨')
  })
})

describe('parseCapAlerts', () => {
  const events = parseCapAlerts(cap)
  it('兩筆告警', () => expect(events).toHaveLength(2))
  it('土石流紅色警戒 Severe → severe、南投', () => {
    const e = events.find((x) => x.countyCodes.includes('10009'))!
    expect(e.type).toBe('alert')
    expect(e.severity).toBe('severe')
    expect(e.source).toBe('NCDR')
  })
})
