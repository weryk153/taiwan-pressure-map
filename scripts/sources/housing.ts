import { findCountyByName } from '../../src/lib/counties'
import type { SourceFetcher } from './types'

/**
 * 房價所得比（PIR）— 內政部不動產資訊平台 房價負擔能力統計。
 *
 * 經實測（2026-06）：此指標僅以「季度 PDF」發布於 pip.moi.gov.tw，
 * 無 data.gov.tw 開放資料、無 CSV/JSON、官網受 WAF 保護且只提供 PDF。
 * 依「真實或留空，絕不造假」原則，本來源留空（status: missing）。
 *
 * 若未來釋出可 fetch 的 CSV/JSON，下方 parser 可直接套用：
 * 假設兩欄 CSV「縣市,房價所得比」。
 */
// 來源頁（僅 PDF，無法 fetch 解析）：https://pip.moi.gov.tw/Publicize/Info/E1050

/** 預備用 parser：兩欄 CSV「縣市,房價所得比」→ { code, raw }[]。目前無可用來源。 */
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
  throw new Error('房價所得比僅以季度 PDF 發布（pip.moi.gov.tw），無 CSV/JSON 開放資料 — 無穩定來源')
}
