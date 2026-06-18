import { countyCodesInText } from '@/lib/disasters/parse'
import { CATEGORY_BY_KEY, type IncidentCategory } from './categories'
import type { DisasterEvent } from '@/lib/disasters/types'

export interface RssItem {
  title: string
  link: string
  pubDate: string
  source?: string
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

function pick(body: string, tag: string): string {
  const m = body.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
  return m ? decodeEntities(m[1]) : ''
}

export function parseRssItems(xml: string): RssItem[] {
  const out: RssItem[] = []
  const blocks = xml.split(/<item>/).slice(1)
  for (const b of blocks) {
    const body = b.split(/<\/item>/)[0] ?? ''
    const title = pick(body, 'title')
    if (!title) continue
    out.push({ title, link: pick(body, 'link'), pubDate: pick(body, 'pubDate'), source: pick(body, 'source') })
  }
  return out
}

const DAY = 86_400_000
const WINDOW = 2 * DAY

export function stripSourceSuffix(title: string): string {
  return title.replace(/\s+[-–—]\s+[^-–—]+$/, '').trim()
}

export function itemsToIncidents(items: RssItem[], category: IncidentCategory, nowMs: number = Date.now()): DisasterEvent[] {
  const out: DisasterEvent[] = []
  for (const it of items) {
    const codes = countyCodesInText(it.title)
    if (codes.length === 0) continue
    const t = Date.parse(it.pubDate)
    if (!Number.isNaN(t) && nowMs - t > WINDOW) continue
    out.push({
      id: `news-${it.link || it.title}`,
      type: 'incident',
      title: stripSourceSuffix(it.title),
      severity: category.severity,
      countyCodes: codes,
      time: Number.isNaN(t) ? it.pubDate : new Date(t).toISOString(),
      source: 'NEWS',
      url: it.link || undefined,
      raw: { category: category.key, source: it.source, originalTitle: it.title },
    })
  }
  return out
}

export function dedupeIncidents(events: DisasterEvent[]): DisasterEvent[] {
  const seen = new Set<string>()
  const out: DisasterEvent[] = []
  for (const e of events) {
    const key = `${stripSourceSuffix(e.title)}|${[...e.countyCodes].sort().join(',')}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(e)
  }
  return out
}

export function parseIncidents(feeds: { category: string; xml: string }[], nowMs: number = Date.now()): DisasterEvent[] {
  const all: DisasterEvent[] = []
  for (const f of feeds) {
    const cat = CATEGORY_BY_KEY[f.category]
    if (!cat) continue
    all.push(...itemsToIncidents(parseRssItems(f.xml), cat, nowMs))
  }
  return dedupeIncidents(all)
}
