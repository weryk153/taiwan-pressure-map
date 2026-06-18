import { findCountyByName } from '../../src/lib/counties'
import { normalizeMetric } from '../../src/lib/normalize'
import type { SourceFetcher } from './types'

/**
 * 主計總處「縣市別失業率」（data.gov.tw dataset 6640），XML 寬表。
 * 每筆 <縣市別失業率> 為一時期；縣市為子標籤 <中文_English_百分比>值</...>。
 * 取最新「整年度」（4 位數年份）紀錄。不含金門/連江（調查不涵蓋離島）。
 */
const URL = 'https://ws.dgbas.gov.tw/001/Upload/461/relfile/11525/230038/mp0101a10.xml'

/** 從 XML 取最新整年度各縣市失業率。回傳 { rows, asOf }。 */
export function parseUnemployment(raw: string): { rows: { code: string; raw: number }[]; asOf: string } {
  const recs = raw.match(/<縣市別失業率>[\s\S]*?<\/縣市別失業率>/g) ?? []
  const yearOf = (rec: string) => (rec.match(/<年月別_Year_and_month>(.*?)<\//)?.[1] ?? '').trim()
  const annual = recs.filter((r) => /^\d{4}$/.test(yearOf(r)))
  if (annual.length === 0) return { rows: [], asOf: '' }
  const last = annual[annual.length - 1]
  const asOf = yearOf(last)
  const rows: { code: string; raw: number }[] = []
  // 子標籤如 <臺北市_Taipei_City_百分比>3.4</...>；取中文段（第一個 _ 前）。
  for (const m of last.matchAll(/<([^>_]+)_[^>]*?_百分比>([^<]*)<\//g)) {
    const name = m[1].trim()
    const c = findCountyByName(name)
    const v = Number((m[2] ?? '').replace(/[",\s%]/g, ''))
    if (c && Number.isFinite(v) && m[2].trim() !== '') rows.push({ code: c.code, raw: v })
  }
  return { rows, asOf }
}

export const economic: SourceFetcher = async () => {
  const res = await fetch(URL, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`economic ${res.status}`)
  const { rows, asOf } = parseUnemployment(await res.text())
  if (rows.length === 0) throw new Error('economic 解析 0 筆')
  return {
    signals: rows.map((r) => ({
      code: r.code,
      metric: 'economic' as const,
      value: normalizeMetric('economic', r.raw),
      confidence: 0.85,
      asOf,
      raw: r.raw,
    })),
    meta: { metric: 'economic', label: '失業率', agency: '主計總處', asOf, status: 'live', url: URL },
  }
}
