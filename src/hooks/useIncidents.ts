import { useQuery } from '@tanstack/react-query'
import { parseIncidents } from '@/lib/incidents/parse'
import { locateIncidents, type TownCentroid } from '@/lib/incidents/locate'
import type { DisasterEvent } from '@/lib/disasters/types'

const URL = import.meta.env.VITE_NEWS_URL ?? 'http://127.0.0.1:54321/functions/v1/news'

interface NewsResponse {
  feeds: { category: string; xml: string }[]
}

// 鄉鎮中心點（靜態 ~26KB）只載一次、快取於模組
let townsPromise: Promise<TownCentroid[]> | null = null
function loadTowns(): Promise<TownCentroid[]> {
  if (!townsPromise) {
    townsPromise = fetch('/taiwan-town-centroids.json')
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
  }
  return townsPromise
}

async function fetchIncidents(): Promise<DisasterEvent[]> {
  try {
    const res = await fetch(URL)
    if (!res.ok) return []
    const data = (await res.json()) as NewsResponse
    const events = parseIncidents(data.feeds ?? [])
    const towns = await loadTowns()
    return locateIncidents(events, towns) // 標題寫到區鄉鎮 → 補上鄉鎮級座標
  } catch {
    return []
  }
}

export function useIncidents() {
  return useQuery<DisasterEvent[]>({
    queryKey: ['incidents'],
    queryFn: fetchIncidents,
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  })
}
