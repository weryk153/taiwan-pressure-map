import { useQuery } from '@tanstack/react-query'
import { buildRiskData } from '@/lib/buildRiskData'
import type { CountyRisk, PressureData, PressureHistory, PressurePeriod } from '@/lib/types'

export interface RiskBundle {
  risks: CountyRisk[]
  sources: PressureData['sources']
  builtAt: string
  history: PressurePeriod[]
}

async function fetchHistory(): Promise<PressurePeriod[]> {
  try {
    const res = await fetch('/taiwan-pressure-history.json')
    if (!res.ok) return []
    const data = (await res.json()) as PressureHistory
    return data.periods ?? []
  } catch {
    return []
  }
}

async function fetchRiskData(): Promise<RiskBundle> {
  const [res, history] = await Promise.all([fetch('/taiwan-pressure.json'), fetchHistory()])
  if (!res.ok) throw new Error(`載入壓力資料失敗：${res.status}`)
  const data = (await res.json()) as PressureData
  return { risks: buildRiskData(data.signals), sources: data.sources, builtAt: data.builtAt, history }
}

export function useRiskData() {
  return useQuery<RiskBundle>({
    queryKey: ['riskData'],
    queryFn: fetchRiskData,
    staleTime: Infinity,
  })
}
