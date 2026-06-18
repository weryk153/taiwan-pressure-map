import { useQuery } from '@tanstack/react-query'
import { parseDisasters } from '@/lib/disasters/parse'
import type { DisasterEvent, DisasterResponse } from '@/lib/disasters/types'

const URL = import.meta.env.VITE_DISASTERS_URL ?? 'http://127.0.0.1:54321/functions/v1/disasters'

async function fetchEvents(): Promise<DisasterEvent[]> {
  try {
    const res = await fetch(URL)
    if (!res.ok) return []
    const data = (await res.json()) as DisasterResponse
    return parseDisasters(data.eq, data.weather, data.cap)
  } catch {
    return []
  }
}

export function useDisasterEvents() {
  return useQuery<DisasterEvent[]>({
    queryKey: ['disasters'],
    queryFn: fetchEvents,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  })
}
