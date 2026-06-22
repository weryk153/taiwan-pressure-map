import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import type { MetricKey } from '../src/lib/types'
import { buildRiskData } from '../src/lib/buildRiskData'
import { mergeHistory, type PressureHistory } from './history'
import type { SourceFetcher, SourceResult } from './sources/types'
import { economic } from './sources/economic'
import { demographic } from './sources/demographic'
import { safety } from './sources/safety'
import { healthcare } from './sources/healthcare'
import { housing } from './sources/housing'

// 部分政府主機（如 ws.dgbas.gov.tw）TLS 鏈缺中繼憑證，Node 預設信任庫無法建立路徑。
// 補上官方 TWCA 中繼憑證（scripts/certs）後再執行：若尚未注入，重啟自身並設 NODE_EXTRA_CA_CERTS。
if (process.env.PRESSURE_CA_BOOTSTRAPPED !== '1') {
  const CA_PATH = resolve('scripts/certs/twca-secure-ssl-g3.pem')
  const r = spawnSync(process.execPath, ['--import', 'tsx', resolve('scripts/build-pressure.ts')], {
    stdio: 'inherit',
    env: { ...process.env, NODE_EXTRA_CA_CERTS: CA_PATH, PRESSURE_CA_BOOTSTRAPPED: '1' },
  })
  process.exit(r.status ?? 0)
}

const FETCHERS: { metric: string; fn: SourceFetcher }[] = [
  { metric: 'economic', fn: economic },
  { metric: 'demographic', fn: demographic },
  { metric: 'safety', fn: safety },
  { metric: 'healthcare', fn: healthcare },
  { metric: 'housing', fn: housing },
]

const LABELS: Record<string, { label: string; agency: string }> = {
  economic: { label: '每戶可支配所得', agency: '主計總處' },
  demographic: { label: '老化指數', agency: '內政部戶政司' },
  safety: { label: '刑案發生率', agency: '警政署' },
  healthcare: { label: '每萬人病床數', agency: '衛福部' },
  housing: { label: '房價所得比', agency: '內政部不動產資訊平台' },
}

const results: SourceResult[] = []
for (const { metric, fn } of FETCHERS) {
  try {
    const r = await fn()
    console.log(`✓ ${metric}: ${r.signals.length} signals (${r.meta.asOf})`)
    results.push(r)
  } catch (e) {
    console.warn(`✗ ${metric}: ${(e as Error).message} → 留空`)
    const l = LABELS[metric]
    results.push({ signals: [], meta: { metric: metric as MetricKey, label: l.label, agency: l.agency, asOf: '-', status: 'missing' } })
  }
}

const out = {
  signals: results.flatMap((r) => r.signals),
  sources: results.map((r) => r.meta),
  builtAt: new Date().toISOString(),
}
writeFileSync(resolve('public/taiwan-pressure.json'), JSON.stringify(out, null, 2))
console.log(`寫出 public/taiwan-pressure.json：${out.signals.length} signals`)

// 累積歷史：把本期合成分數附加為一期
const HISTORY_PATH = resolve('public/taiwan-pressure-history.json')
const risks = buildRiskData(out.signals)
const prevHistory: PressureHistory = existsSync(HISTORY_PATH)
  ? (JSON.parse(readFileSync(HISTORY_PATH, 'utf-8')) as PressureHistory)
  : { periods: [] }
const history = mergeHistory(prevHistory, out.builtAt.slice(0, 10), risks)
writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2))
console.log(`寫出 public/taiwan-pressure-history.json：${history.periods.length} 期`)
