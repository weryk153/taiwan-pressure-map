import { findCountyByName } from '../../src/lib/counties'
import { normalizeMetric } from '../../src/lib/normalize'
import { loadPopulation } from './population'
import type { SourceFetcher } from './types'

/**
 * 警政署「刑案發生件數」（data.gov.tw dataset 103351，statis.moi.gov.tw）。
 * CSV 兩欄："<年>年/ <地區>", 件數。整年度區塊在最前，後接 12 個月份區塊。
 * 只取「整年度」縣市列（標籤不含「月」），排除「機關別總計」「署所屬機關」。
 * 發生率＝件數 / 人口 × 100000。
 */
const YEAR_ROC = 113 // 民國113年 = 2024
const AS_OF = '2024'
const URL =
  `https://statis.moi.gov.tw/micst/webMain.aspx?sys=220&kind=21&type=1&funid=c0620101&cycle=41&outmode=12&utf=1&compmode=0&outkind=3&fld0=1&codspc0=0,2,3,2,6,1,9,1,12,1,15,17,&rdm=NIirnBpa&ym=${YEAR_ROC}00&ymt=${YEAR_ROC}12`

/** 解析整年度各縣市刑案件數。回傳 { code, raw: 件數 }[]。 */
export function parseCrime(raw: string): { code: string; count: number }[] {
  const out: { code: string; count: number }[] = []
  for (const line of raw.trim().split(/\r?\n/).slice(1)) {
    const cols = line.replace(/^\uFEFF/, '').split(',')
    const label = (cols[0] ?? '').replace(/"/g, '').trim()
    // 整年度列形如「113年/ 新北市」；月份列含「月」，跳過。
    if (!/^\d+年\/\s/.test(label)) continue
    const area = label.split('/')[1]?.trim() ?? ''
    if (area === '機關別總計' || area === '署所屬機關') continue
    const c = findCountyByName(area)
    const count = Number((cols[1] ?? '').replace(/[",\s]/g, ''))
    if (c && Number.isFinite(count)) out.push({ code: c.code, count })
  }
  return out
}

export const safety: SourceFetcher = async () => {
  const res = await fetch(URL, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`safety ${res.status}`)
  const crimes = parseCrime(await res.text())
  if (crimes.length === 0) throw new Error('safety 解析 0 筆')
  const pop = await loadPopulation()
  const signals = crimes
    .filter((x) => pop[x.code] > 0)
    .map((x) => {
      const rate = (x.count / pop[x.code]) * 100000
      return {
        code: x.code,
        metric: 'safety' as const,
        value: normalizeMetric('safety', rate),
        confidence: 0.8,
        asOf: AS_OF,
        raw: Math.round(rate * 10) / 10,
      }
    })
  if (signals.length === 0) throw new Error('safety 無對應人口')
  return {
    signals,
    meta: { metric: 'safety', label: '刑案發生率', agency: '警政署', asOf: AS_OF, status: 'live', url: URL },
  }
}
