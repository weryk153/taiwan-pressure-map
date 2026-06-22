import type { MetricKey } from './types'

/**
 * 絕對參考門檻：raw=lo → 0 分、raw=hi → 100 分，裁切到 0–100。
 * 反向指標（如醫療：床越少壓力越大）以 lo>hi 表達，公式自然反向。為先驗值，可校準。
 */
export const THRESHOLDS: Record<MetricKey, { lo: number; hi: number }> = {
  economic: { lo: 155, hi: 75 }, // 每戶可支配所得(萬元)；反向：所得高→壓力低
  housing: { lo: 5, hi: 17 },
  demographic: { lo: 50, hi: 300 },
  safety: { lo: 800, hi: 2500 },
  healthcare: { lo: 80, hi: 20 }, // 每萬人病床；反向：病床多→壓力低
}

export function normalizeMetric(metric: MetricKey, raw: number): number {
  const { lo, hi } = THRESHOLDS[metric]
  const t = (raw - lo) / (hi - lo)
  return Math.round(Math.max(0, Math.min(1, t)) * 100)
}
