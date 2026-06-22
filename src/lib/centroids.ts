import type { CountyCode } from './types'

type FC = { features: { properties: { COUNTYCODE: string }; geometry: any }[] }

/** 單一外環的面積加權重心 + 面積（shoelace）。比頂點平均準，且不受海岸線頂點密度影響。 */
function ringCentroid(ring: number[][]): { c: [number, number]; area: number } {
  let a = 0, cx = 0, cy = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i]
    const [x1, y1] = ring[i + 1]
    const cross = x0 * y1 - x1 * y0
    a += cross
    cx += (x0 + x1) * cross
    cy += (y0 + y1) * cross
  }
  a /= 2
  if (Math.abs(a) < 1e-12) {
    // 退化（面積近 0）→ 退回頂點平均
    let sx = 0, sy = 0
    for (const [x, y] of ring) { sx += x; sy += y }
    return { c: [sx / ring.length, sy / ring.length], area: 0 }
  }
  return { c: [cx / (6 * a), cy / (6 * a)], area: Math.abs(a) }
}

/**
 * 各縣市近似重心：取「面積最大的那塊多邊形」的面積加權重心。
 * 這樣離島小塊（如澎湖周邊、外海島嶼）不會把中心拉到海上，
 * 不規則海岸線也不會因頂點密集而偏移。用於擴散波/標點原點。
 */
export function computeCentroids(geo: FC): Record<CountyCode, [number, number]> {
  const out: Record<string, [number, number]> = {}
  for (const f of geo.features) {
    const polys =
      f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates]
    let best: [number, number] | null = null
    let bestArea = -1
    for (const poly of polys) {
      const { c, area } = ringCentroid(poly[0]) // 外環
      if (area > bestArea) {
        bestArea = area
        best = c
      }
    }
    if (best) out[f.properties.COUNTYCODE] = best
  }
  return out
}
