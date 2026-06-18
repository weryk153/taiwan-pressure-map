import type { MetricKey } from './types'

/** 事件來源代號 → 中文（CWA/NCDR 等英文代號避免直接露出）。NEWS 另顯示媒體名。 */
export const SOURCE_LABEL: Record<string, string> = {
  CWA: '中央氣象署',
  NCDR: '災防告警',
  NEWS: '新聞',
}

/** 子指標的「原始真實值」標籤（與壓力框架 metrics.* 不同：這是具體統計名）。 */
export const RAW_LABEL: Record<MetricKey, string> = {
  economic: '失業率',
  housing: '房價所得比',
  demographic: '老化指數',
  safety: '刑案率',
  healthcare: '每萬人病床',
}

/** 把原始值格式化成帶單位的可讀字串。 */
export function formatRaw(metric: MetricKey, v: number): string {
  switch (metric) {
    case 'economic':
      return `${v.toFixed(1)}%`
    case 'housing':
      return `${v.toFixed(1)} 倍`
    case 'demographic':
      return `${Math.round(v)}`
    case 'safety':
      return `${Math.round(v)} 件/十萬人`
    case 'healthcare':
      return `${v.toFixed(1)} 床/萬人`
  }
}
