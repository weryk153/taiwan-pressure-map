import { findCountyByName } from '../../src/lib/counties'

/**
 * 戶政司「村里戶數、單一年齡人口」CSV（dataset 77132）。
 * 一列一村里；縣市為「區域別」欄前綴。聚合到縣市的總人口（人口數欄）。
 *
 * 欄位（0-based）：2=區域別, 5=人口數, 8=0歲-男 … 209=100歲以上-女。
 * 年齡 N 男女在索引 8+2N、9+2N。0–14 歲＝索引 8..37；65+＝索引 138..209。
 */
const POP_URL =
  'https://opdadm.moi.gov.tw/api/v1/no-auth/resource/api/dataset/2C7688CB-B505-4D00-B11C-66C4D31B024F/resource/4CAA7169-5E84-46FB-BA91-72ED6274B84A/download'

const COL_AREA = 2
const COL_POP = 5
const IDX_AGE0 = 8 // 0歲-男
const IDX_AGE14_END = 37 // 14歲-女
const IDX_AGE65 = 138 // 65歲-男
const IDX_AGE100_END = 209 // 100歲以上-女

function num(s: string | undefined): number {
  return Number((s ?? '').replace(/[",\s]/g, ''))
}

/** 區域別字串（如「臺北市松山區」）取縣市段：第一個「縣」或「市」為止。 */
export function countyFromArea(area: string): string {
  const m = area.match(/^.+?[縣市]/)
  return m ? m[0] : area
}

function range(cols: string[], start: number, end: number): number {
  let s = 0
  for (let i = start; i <= end; i++) s += num(cols[i]) || 0
  return s
}

/** 聚合每縣市總人口。回傳 { code: 人口數 }。 */
export function parsePopulation(raw: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const line of raw.trim().split(/\r?\n/).slice(1)) {
    const cols = line.split(',')
    const c = findCountyByName(countyFromArea((cols[COL_AREA] ?? '').trim()))
    const pop = num(cols[COL_POP])
    if (c && Number.isFinite(pop)) out[c.code] = (out[c.code] ?? 0) + pop
  }
  return out
}

/** 聚合每縣市 0–14 與 65+ 人口，計算老化指數＝65+/0–14×100。回傳 { code: 老化指數 }。 */
export function parseAgingIndex(raw: string): Record<string, number> {
  const young: Record<string, number> = {}
  const old: Record<string, number> = {}
  for (const line of raw.trim().split(/\r?\n/).slice(1)) {
    const cols = line.split(',')
    const c = findCountyByName(countyFromArea((cols[COL_AREA] ?? '').trim()))
    if (!c) continue
    young[c.code] = (young[c.code] ?? 0) + range(cols, IDX_AGE0, IDX_AGE14_END)
    old[c.code] = (old[c.code] ?? 0) + range(cols, IDX_AGE65, IDX_AGE100_END)
  }
  const out: Record<string, number> = {}
  for (const code of Object.keys(young)) {
    if (young[code] > 0) out[code] = (old[code] / young[code]) * 100
  }
  return out
}

async function fetchPopRaw(): Promise<string> {
  const res = await fetch(POP_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`population ${res.status}`)
  return res.text()
}

export async function loadPopulation(): Promise<Record<string, number>> {
  return parsePopulation(await fetchPopRaw())
}

export async function loadAgingIndex(): Promise<Record<string, number>> {
  return parseAgingIndex(await fetchPopRaw())
}
