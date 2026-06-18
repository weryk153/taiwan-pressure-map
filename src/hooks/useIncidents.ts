import { useQuery } from '@tanstack/react-query'
import { parseIncidents } from '@/lib/incidents/parse'
import type { DisasterEvent } from '@/lib/disasters/types'

const URL = import.meta.env.VITE_NEWS_URL ?? 'http://127.0.0.1:54321/functions/v1/news'

interface NewsResponse {
  feeds: { category: string; xml: string }[]
}

async function fetchIncidents(): Promise<DisasterEvent[]> {
  try {
    const res = await fetch(URL)
    if (!res.ok) return []
    const data = (await res.json()) as NewsResponse
    return parseIncidents(data.feeds ?? [])
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
