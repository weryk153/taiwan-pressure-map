import type { RiskLevel } from './types'

/** 紙上熱度色階（低＝淡麥，往上漸深至磚紅、深栗，配米白紙底） */
const STOPS: { at: number; color: string }[] = [
  { at: 0, color: '#e7d2a0' },   // 低：淡麥
  { at: 30, color: '#d6a85c' },  // 偏低：赭黃
  { at: 50, color: '#c47e3c' },  // 中：琥珀橙
  { at: 75, color: '#b5532f' },  // 高：磚紅
  { at: 100, color: '#8a2f23' }, // 危急：深栗
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
