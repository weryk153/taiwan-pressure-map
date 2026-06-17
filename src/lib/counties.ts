import type { County } from './types'

export const COUNTIES: County[] = [
  { code: '63000', name: '臺北市' },
  { code: '65000', name: '新北市' },
  { code: '68000', name: '桃園市' },
  { code: '66000', name: '臺中市' },
  { code: '67000', name: '臺南市' },
  { code: '64000', name: '高雄市' },
  { code: '10002', name: '宜蘭縣' },
  { code: '10004', name: '嘉義市' },
  { code: '10005', name: '新竹縣' },
  { code: '10007', name: '苗栗縣' },
  { code: '10008', name: '彰化縣' },
  { code: '10009', name: '南投縣' },
  { code: '10010', name: '雲林縣' },
  { code: '10013', name: '屏東縣' },
  { code: '10014', name: '臺東縣' },
  { code: '10015', name: '花蓮縣' },
  { code: '10016', name: '澎湖縣' },
  { code: '10017', name: '基隆市' },
  { code: '10018', name: '新竹市' },
  { code: '10020', name: '嘉義縣' },
  { code: '09007', name: '金門縣' },
  { code: '09020', name: '連江縣' },
]

/** 台 → 臺 正規化（官方用「臺」）。只影響含「台」的縣市名。 */
export function normalizeCountyName(name: string): string {
  return name.replace(/台/g, '臺')
}

const BY_NORMALIZED_NAME = new Map(COUNTIES.map((c) => [normalizeCountyName(c.name), c]))

export function findCountyByName(name: string): County | undefined {
  return BY_NORMALIZED_NAME.get(normalizeCountyName(name))
}

export const BY_CODE = new Map(COUNTIES.map((c) => [c.code, c]))
