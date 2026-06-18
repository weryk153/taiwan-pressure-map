import { findCountyByName } from '../../src/lib/counties'
import { normalizeMetric } from '../../src/lib/normalize'
import type { SourceFetcher } from './types'

/**
 * 房價所得比（PIR）— 內政部不動產資訊平台 房價負擔能力統計。
 *
 * 此指標無 data.gov.tw 開放資料、無 CSV/JSON API，官網（pip.moi.gov.tw）受 WAF/session
 * 保護、僅季度 PDF/前端表格，伺服器端無法自動 fetch。
 *
 * 採「手動快照 ingest」（如 V-Dem）：以真實瀏覽器讀取官方頁面的縣市表格，
 * 將官方數值原樣登錄於下方 SNAPSHOT。**為真實官方資料，非估計、非造假。**
 *   來源頁：https://pip.moi.gov.tw/Publicize/Info/E1050
 *   期別：114 年第 4 季（2025-Q4），擷取於 2026-06
 *   欄位：各縣市「房價所得比（倍）」
 *   涵蓋：19 縣市（該統計未列 澎湖/金門/連江 → 該三縣市留空）
 * 更新方式：每季重新讀取官方表格、更新 SNAPSHOT 與 AS_OF。
 */
const AS_OF = '2025-Q4'
const SOURCE_URL = 'https://pip.moi.gov.tw/Publicize/Info/E1050'

const SNAPSHOT: Record<string, number> = {
  臺北市: 14.62, 新北市: 12.47, 臺中市: 11.11, 高雄市: 9.16, 新竹縣: 8.96,
  臺南市: 8.61, 花蓮縣: 8.58, 南投縣: 8.39, 桃園市: 8.29, 新竹市: 8.17,
  彰化縣: 8.03, 臺東縣: 7.80, 宜蘭縣: 7.68, 苗栗縣: 7.40, 嘉義市: 7.26,
  屏東縣: 6.86, 雲林縣: 6.82, 嘉義縣: 6.44, 基隆市: 5.77,
}

/** 把 SNAPSHOT（縣市名→房價所得比）轉成 { code, raw }[]。純函式，便於測試。 */
export function snapshotRows(snapshot: Record<string, number>): { code: string; raw: number }[] {
  const out: { code: string; raw: number }[] = []
  for (const [name, raw] of Object.entries(snapshot)) {
    const c = findCountyByName(name)
    if (c && Number.isFinite(raw)) out.push({ code: c.code, raw })
  }
  return out
}

/** 預備用 parser：未來若釋出兩欄 CSV「縣市,房價所得比」可直接套用。 */
export function parseHousing(raw: string): { code: string; raw: number }[] {
  const out: { code: string; raw: number }[] = []
  for (const line of raw.trim().split(/\r?\n/).slice(1)) {
    const cols = line.split(',')
    const c = findCountyByName((cols[0] ?? '').trim())
    const v = Number((cols[1] ?? '').replace(/[",\s]/g, ''))
    if (c && Number.isFinite(v)) out.push({ code: c.code, raw: v })
  }
  return out
}

export const housing: SourceFetcher = async () => {
  const rows = snapshotRows(SNAPSHOT)
  if (rows.length === 0) throw new Error('housing snapshot 空')
  return {
    signals: rows.map((r) => ({
      code: r.code,
      metric: 'housing' as const,
      value: normalizeMetric('housing', r.raw),
      confidence: 0.8,
      asOf: AS_OF,
      raw: r.raw,
    })),
    meta: {
      metric: 'housing',
      label: '房價所得比',
      agency: '內政部不動產資訊平台',
      asOf: AS_OF,
      status: 'live',
      url: SOURCE_URL,
    },
  }
}
