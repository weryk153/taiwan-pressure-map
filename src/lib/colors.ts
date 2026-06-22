import type { RiskLevel } from './types'

/**
 * 紙上熱度色階（低＝淡麥金，往上漸深至磚紅、深栗，配米白紙底）。
 * 實測各縣市分數集中在 30–65，故把對比集中在這段、並加大明暗差，
 * 讓相近分數也分得出來；30 以下／75 以上資料罕至，僅作錨點。
 */
const STOPS: { at: number; color: string }[] = [
  { at: 0, color: '#f4ebd2' },   // 極低（資料罕至）：近紙色
  { at: 30, color: '#ecd28a' },  // 低：淡麥金
  { at: 42, color: '#d9aa57' },  // 偏低：赭黃
  { at: 52, color: '#c5803a' },  // 中：琥珀橙
  { at: 62, color: '#ad5a2c' },  // 偏高：燒橙
  { at: 75, color: '#8f3b22' },  // 高：磚紅
  { at: 100, color: '#6b1d16' }, // 危急：深栗
]

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t)
}
function hexToRgb(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}

export function scoreColor(score: number): string {
  const s = Math.max(0, Math.min(100, score))
  let lo = STOPS[0], hi = STOPS[STOPS.length - 1]
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (s >= STOPS[i].at && s <= STOPS[i + 1].at) { lo = STOPS[i]; hi = STOPS[i + 1]; break }
  }
  const t = hi.at === lo.at ? 0 : (s - lo.at) / (hi.at - lo.at)
  const [r1, g1, b1] = hexToRgb(lo.color)
  const [r2, g2, b2] = hexToRgb(hi.color)
  return rgbToHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t))
}

export const LEVEL_LABEL: Record<RiskLevel, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '危急',
}

export const NO_DATA_COLOR = '#d9d1c0' // 紙感中性灰，用於無資料縣市
