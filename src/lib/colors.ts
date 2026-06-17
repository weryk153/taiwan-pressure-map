import type { RiskLevel } from './types'

/** 低→危急 的色階（克制、去飽和的情報風：冷灰藍 → 暗琥珀 → 暗橙 → 暗磚紅） */
const STOPS: { at: number; color: string }[] = [
  { at: 0, color: '#5b6675' },
  { at: 35, color: '#b08a4f' },
  { at: 65, color: '#c2703a' },
  { at: 100, color: '#b13a33' },
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
