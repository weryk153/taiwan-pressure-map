import { findCountyByName } from '../../src/lib/counties'
import { normalizeMetric } from '../../src/lib/normalize'
import type { SourceFetcher } from './types'

/**
 * 主計總處「家庭收支調查－平均每戶可支配所得按區域別分」（data.gov.tw dataset 9415），寬表 CSV。
 * 第一列表頭為「年, 臺灣地區-元, 新北市-元, …」，其後每列為一年度；取最新年度各縣市值。
 * 原始值以「萬元」記。不含金門/連江（調查不涵蓋離島）。
 * 反向指標：所得越高、壓力越低（門檻於 normalize.ts 以 lo>hi 表達）。
 *
 * 取代原「失業率」：全台失業率集中在 3.2–3.5%、跨縣市幾乎無差異（鑑別度極低）；
 * 改用可支配所得後，經濟面向才真正反映各縣市差距。
 */
const URL =
  'https://ws.dgbas.gov.tw/001/Upload/461/relfile/11525/232214/006-平均每戶可支配所得按區域別分.csv'

/** 解析寬表 CSV，取最新年度各縣市「平均每戶可支配所得」（萬元，1 位小數）。純函式便於測試。 */
export function parseIncome(raw: string): { rows: { code: string; raw: number }[]; asOf: string } {
  const lines = raw.replace(/^﻿/, '').trim().split(/\r?\n/)
  if (lines.length < 2) return { rows: [], asOf: '' }
  const cell = (s: string) => s.replace(/^"|"$/g, '').trim()
  const header = lines[0].split(',').map(cell) // ['年','臺灣地區-元','新北市-元', …]
  const last = lines[lines.length - 1].split(',').map(cell)
  const asOf = last[0]
  const rows: { code: string; raw: number }[] = []
  for (let i = 1; i < header.length; i++) {
    const name = header[i].replace(/-元$/, '')
    if (name === '臺灣地區') continue // 跳過全國彙總
    const c = findCountyByName(name)
    const yuan = Number((last[i] ?? '').replace(/[",\s]/g, ''))
    if (c && Number.isFinite(yuan) && yuan > 0) {
      rows.push({ code: c.code, raw: Math.round(yuan / 1000) / 10 }) // 元 → 萬元
    }
  }
  return { rows, asOf }
}

export const economic: SourceFetcher = async () => {
  const res = await fetch(encodeURI(URL), { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`economic ${res.status}`)
  const { rows, asOf } = parseIncome(await res.text())
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
    meta: { metric: 'economic', label: '每戶可支配所得', agency: '主計總處', asOf, status: 'live', url: URL },
  }
}
