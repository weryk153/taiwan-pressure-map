import type { CountyCode } from './types'

type FC = { features: { properties: { COUNTYCODE: string }; geometry: any }[] }

/** 多邊形頂點平均當近似重心（免額外套件；夠用於放柱位置）。 */
export function computeCentroids(geo: FC): Record<CountyCode, [number, number]> {
  const out: Record<string, [number, number]> = {}
  for (const f of geo.features) {
    let sx = 0, sy = 0, n = 0
    const polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates]
    for (const poly of polys) {
      for (const [x, y] of poly[0]) { sx += x; sy += y; n++ }
    }
    if (n) out[f.properties.COUNTYCODE] = [sx / n, sy / n]
  }
  return out
}
