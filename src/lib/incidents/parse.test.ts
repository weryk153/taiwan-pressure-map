import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseRssItems, itemsToIncidents, dedupeIncidents, parseIncidents } from './parse'

const xml = readFileSync(resolve(__dirname, './fixtures/rss.xml'), 'utf8')
const NOW = Date.parse('2026-06-18T03:00:00Z')
const FIRE = { key: 'fire', label: '火災', query: '火災', severity: 'warning' as const }

describe('parseRssItems', () => {
  const items = parseRssItems(xml)
  it('解析出 4 個 item', () => expect(items).toHaveLength(4))
  it('title/link/pubDate', () => {
    expect(items[0].title).toContain('新北市某工廠深夜火災')
    expect(items[0].link).toBe('https://news.google.com/rss/articles/AAA')
    expect(items[0].pubDate).toContain('2026')
  })
})

describe('itemsToIncidents', () => {
  const items = parseRssItems(xml)
  const events = itemsToIncidents(items, FIRE, NOW)
  it('無縣市的項目被丟棄（剩 3 筆有縣市）', () => {
    expect(events).toHaveLength(3)
  })
  it('新北市火災 → 65000、type incident、url、warning、NEWS', () => {
    const e = events.find((x) => x.title.includes('新北市'))!
    expect(e.countyCodes).toContain('65000')
    expect(e.type).toBe('incident')
    expect(e.severity).toBe('warning')
    expect(e.source).toBe('NEWS')
    expect(e.url).toContain('news.google.com')
  })
  it('近 7 天過濾：過舊丟棄', () => {
    const old = itemsToIncidents(items, FIRE, Date.parse('2026-06-30T00:00:00Z'))
    expect(old).toHaveLength(0)
  })
})

describe('dedupeIncidents', () => {
  it('同縣市+相似標題（去媒體後綴）去重', () => {
    const events = itemsToIncidents(parseRssItems(xml), FIRE, NOW)
    const deduped = dedupeIncidents(events)
    const xinbei = deduped.filter((e) => e.countyCodes.includes('65000') && e.title.includes('工廠'))
    expect(xinbei).toHaveLength(1)
  })
})

describe('parseIncidents', () => {
  it('多 feed 合併 + 去重', () => {
    const out = parseIncidents([{ category: 'fire', xml }], NOW)
    expect(out.length).toBeGreaterThan(0)
    expect(out.every((e) => e.type === 'incident')).toBe(true)
  })
})
