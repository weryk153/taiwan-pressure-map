import type { CountySignal, SourceMeta } from '../../src/lib/types'

export interface SourceResult {
  signals: CountySignal[]
  meta: SourceMeta
}

export type SourceFetcher = () => Promise<SourceResult>
