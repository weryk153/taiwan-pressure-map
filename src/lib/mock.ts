import { METRIC_KEYS, type CountyCode, type CountySignal } from './types'

/** 字串雜湊 → 32-bit 種子 */
function hashSeed(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32 決定性 PRNG */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const AS_OF = '2026-06-01'

export function buildMockSignals(code: CountyCode): CountySignal[] {
  return METRIC_KEYS.map((metric) => {
    const rand = mulberry32(hashSeed(`${code}:${metric}`))
    const value = Math.round(rand() * 100)
    const confidence = Math.round((0.5 + rand() * 0.5) * 100) / 100 // 0.5–1.0
    return { code, metric, value, confidence, asOf: AS_OF }
  })
}
