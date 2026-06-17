import { useQuery } from '@tanstack/react-query'
import { buildRiskData } from '@/lib/buildRiskData'
import type { CountyRisk } from '@/lib/types'

async function fetchRiskData(): Promise<CountyRisk[]> {
  // #1：純 mock（同步包成 Promise）。#2~#4 在此改為先抓真實訊號再 buildRiskData(signals)。
  return buildRiskData()
}

export function useRiskData() {
  return useQuery<CountyRisk[]>({
    queryKey: ['riskData'],
    queryFn: fetchRiskData,
    staleTime: Infinity,
  })
}
