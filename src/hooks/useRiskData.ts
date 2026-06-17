import { useQuery } from '@tanstack/react-query'
import { buildRiskData } from '@/lib/buildRiskData'
import type { CountyRisk, PressureData } from '@/lib/types'

export interface RiskBundle {
  risks: CountyRisk[]
  sources: PressureData['sources']
  builtAt: string
}

async function fetchRiskData(): Promise<RiskBundle> {
  const res = await fetch('/taiwan-pressure.json')
  if (!res.ok) throw new Error(`載入壓力資料失敗：${res.status}`)
  const data = (await res.json()) as PressureData
  return { risks: buildRiskData(data.signals), sources: data.sources, builtAt: data.builtAt }
}

export function useRiskData() {
  return useQuery<RiskBundle>({
    queryKey: ['riskData'],
    queryFn: fetchRiskData,
    staleTime: Infinity,
  })
}
