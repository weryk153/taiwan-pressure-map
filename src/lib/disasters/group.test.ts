import { describe, it, expect } from 'vitest'
import { eventsByCounty, sortBySeverity } from './group'
import type { DisasterEvent } from './types'

const ev = (id: string, codes: string[], severity: any): DisasterEvent =>
  ({ id, type: 'alert', title: id, severity, countyCodes: codes, time: '', source: 'NCDR' })

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
