import { describe, it, expect } from 'vitest'
import { eventsByCounty, sortBySeverity, todaysEventsLatestFirst } from './group'
import type { DisasterEvent } from './types'

const ev = (id: string, codes: string[], severity: any, time = ''): DisasterEvent =>
  ({ id, type: 'alert', title: id, severity, countyCodes: codes, time, source: 'NCDR' })

describe('eventsByCounty', () => {
  it('一事件多縣市 → 每縣市都收到', () => {
    const map = eventsByCounty([ev('a', ['10009', '10014'], 'severe')])
    expect(map['10009']).toHaveLength(1)
    expect(map['10014']).toHaveLength(1)
  })
})

describe('sortBySeverity', () => {
  it('severe 排最前', () => {
    const sorted = sortBySeverity([ev('a', [], 'info'), ev('b', [], 'severe'), ev('c', [], 'warning')])
    expect(sorted.map((e) => e.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('todaysEventsLatestFirst', () => {
  // 台灣時間 2026-06-26 12:00 = UTC 04:00
  const now = Date.parse('2026-06-26T04:00:00Z')

  it('只保留台灣今天的事件，最新排最前', () => {
    const out = todaysEventsLatestFirst(
      [
        ev('morning', [], 'info', '2026-06-26 08:30'),
        ev('yesterday', [], 'severe', '2026-06-25 23:00'),
        ev('noon', [], 'warning', '2026-06-26 11:50'),
      ],
      now,
    )
    expect(out.map((e) => e.id)).toEqual(['noon', 'morning'])
  })

  it('忽略無法解析或空白時間的事件', () => {
    const out = todaysEventsLatestFirst([ev('blank', [], 'info', ''), ev('bad', [], 'info', 'nope')], now)
    expect(out).toHaveLength(0)
  })

  it('跨日邊界以台灣時區判斷（UTC 仍是前一天）', () => {
    // 台灣 2026-06-26 00:30 = UTC 2026-06-25 16:30
    const out = todaysEventsLatestFirst([ev('justAfterMidnight', [], 'info', '2026-06-26 00:30')], now)
    expect(out.map((e) => e.id)).toEqual(['justAfterMidnight'])
  })
})
