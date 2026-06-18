import { unzipSync, strFromU8 } from 'fflate'
import { findCountyByName } from '../../src/lib/counties'
import { normalizeMetric } from '../../src/lib/normalize'
import { countyFromArea, loadPopulation } from './population'
import type { SourceFetcher } from './types'

/**
 * 衛福部「醫院病床統計」（data.gov.tw dataset 6473）。
 * 病床 CSV 以鄉鎮市區碼為鍵（無縣市名），需 join 代碼表取縣市名；
 * 病床 CSV 第 3 欄「病床總計」為該區總床數，逐縣市加總。
 * 每萬人病床數＝床數 / 人口 × 10000。
 */
const AS_OF = '2024' // hos_bed113 = 民國113年
const BEDS_ZIP_URL = 'https://www.mohw.gov.tw/dl-96463-834fc03a-ff78-4698-aa55-617af9e1e301.html'
const AREACODE_URL = 'https://www.mohw.gov.tw/dl-84533-fc10435f-231c-4cad-bc31-db4898d20b17.html'
const URL = 'https://data.gov.tw/dataset/6473'

/** 解析代碼表：鄉鎮市區碼 → 區域名稱（103 年以後適用，第 3 欄）。 */
export function parseAreaCode(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of raw.replace(/^\uFEFF/, '').trim().split(/\r?\n/).slice(1)) {
    const cols = line.split(',')
    const code = (cols[0] ?? '').trim()
    const name = (cols[2] ?? cols[1] ?? '').trim()
    if (code && name) out[code] = name
  }
  return out
}

/** 加總每縣市病床總計。回傳 { code: 床數 }。 */
export function parseBeds(bedsCsv: string, areaCsv: string): Record<string, number> {
  const codeToName = parseAreaCode(areaCsv)
  const out: Record<string, number> = {}
  for (const line of bedsCsv.replace(/^\uFEFF/, '').trim().split(/\r?\n/).slice(1)) {
    const cols = line.split(',')
    const areaCode = (cols[0] ?? '').trim()
    const total = Number((cols[2] ?? '').replace(/[",\s]/g, '')) // 病床總計
    const name = codeToName[areaCode]
    if (!name || !Number.isFinite(total)) continue
    const c = findCountyByName(countyFromArea(name))
    if (c) out[c.code] = (out[c.code] ?? 0) + total
  }
  return out
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`healthcare ${res.status}`)
  return res.text()
}

async function fetchBedsCsv(): Promise<string> {
  const res = await fetch(BEDS_ZIP_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`healthcare zip ${res.status}`)
  const buf = new Uint8Array(await res.arrayBuffer())
  const files = unzipSync(buf)
  const name = Object.keys(files).find((n) => /^hos_bed\d+\.csv$/i.test(n))
  if (!name) throw new Error('healthcare zip 內無 hos_bed*.csv')
  return strFromU8(files[name])
}

export const healthcare: SourceFetcher = async () => {
  const [bedsCsv, areaCsv] = await Promise.all([fetchBedsCsv(), fetchText(AREACODE_URL)])
  const beds = parseBeds(bedsCsv, areaCsv)
  if (Object.keys(beds).length === 0) throw new Error('healthcare 解析 0 筆')
  const pop = await loadPopulation()
  const signals = Object.keys(beds)
    .filter((code) => pop[code] > 0)
    .map((code) => {
      const rate = (beds[code] / pop[code]) * 10000
      return {
        code,
        metric: 'healthcare' as const,
        value: normalizeMetric('healthcare', rate),
        confidence: 0.8,
        asOf: AS_OF,
        raw: Math.round(rate * 10) / 10,
      }
    })
  if (signals.length === 0) throw new Error('healthcare 無對應人口')
  return {
    signals,
    meta: { metric: 'healthcare', label: '每萬人病床數', agency: '衛福部', asOf: AS_OF, status: 'live', url: URL },
  }
}
