# 縣市壓力指數（真實統計）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用真實政府開放統計算出每縣市綜合壓力指數，取代 #1 的 mock；抓不到的指標留空（不 mock），絕對門檻正規化，靜態快照打包。

**Architecture:** 兩階段。A：確定性核心 — `normalize.ts`（絕對門檻）、`CountyRisk` 型別改為可無資料、`buildRiskData` 改寫成「真實訊號或留空」（退役 mock）、`useRiskData` 改載 `public/taiwan-pressure.json`、UI 無資料樣式 + 資料來源 footnote。B：`scripts/build-pressure.ts`（tsx 執行，重用 src 邏輯）逐來源抓取/解析/正規化 → 產出 committed 快照；任一來源失敗只該指標留空、不中止其他。

**Tech Stack:** Vite + React + TS、tsx（跑 TS 腳本）、Vitest。沿用 #1 全部既有模組。

**Spec:** `docs/superpowers/specs/2026-06-18-county-pressure-index-design.md`

**Branch:** 先開 `feat/county-pressure-index`（off master）。

---

## File Structure

```
src/lib/
  normalize.ts            # 新增：THRESHOLDS + normalizeMetric（絕對門檻、含反向）
  normalize.test.ts       # 新增
  types.ts                # 改：CountyRisk(score:null|number, subScores:Partial, hasData), 新增 SourceMeta/PressureData
  buildRiskData.ts        # 改寫：真實訊號或留空，退役 mock
  buildRiskData.test.ts   # 改：用真實訊號 fixture
  mock.ts / mock.test.ts  # 刪除（退役）
  colors.ts               # 新增 NO_DATA_COLOR 常數
src/hooks/useRiskData.ts  # 改：fetch /taiwan-pressure.json → buildRiskData
src/components/
  MapView.tsx             # 改：無資料縣市灰底
  ControlPanel.tsx        # 改：無資料排末、顯示「—」
  CountyDrawer.tsx        # 改：score=null 顯示無資料；缺的子指標顯示無資料
  DataSources.tsx         # 新增：資料來源 footnote 區塊
src/locales/zh-Hant.json  # 加字串
public/taiwan-pressure.json  # 新增：快照（先放 seed，Task B 由腳本覆蓋）
scripts/
  build-pressure.ts       # 新增：主腳本（runner + writer）
  sources/
    types.ts              # SourceResult / SourceFetcher 介面
    population.ts          # 縣市別人口（safety/healthcare 算率用）
    economic.ts demographic.ts safety.ts healthcare.ts housing.ts
  fixtures/               # 各來源的樣本（解析測試用）
  *.test.ts               # 解析純函式測試
package.json              # 加 tsx devDep + "build:data" script
```

---

## 階段 A — 確定性核心

### Task 1: 絕對門檻正規化

**Files:** Create `src/lib/normalize.ts`, `src/lib/normalize.test.ts`

- [ ] **Step 1: 失敗測試**

`src/lib/normalize.test.ts`：
```ts
import { describe, it, expect } from 'vitest'
import { THRESHOLDS, normalizeMetric } from './normalize'
import { METRIC_KEYS } from './types'

describe('THRESHOLDS', () => {
  it('五個指標都有 lo/hi', () => {
    for (const k of METRIC_KEYS) {
      expect(THRESHOLDS[k]).toBeDefined()
      expect(typeof THRESHOLDS[k].lo).toBe('number')
      expect(typeof THRESHOLDS[k].hi).toBe('number')
    }
  })
})

describe('normalizeMetric', () => {
  it('lo→0、hi→100、中間線性', () => {
    expect(normalizeMetric('economic', 2.5)).toBe(0)
    expect(normalizeMetric('economic', 6.0)).toBe(100)
    expect(normalizeMetric('economic', 4.25)).toBe(50)
  })
  it('超界裁切', () => {
    expect(normalizeMetric('economic', 1)).toBe(0)
    expect(normalizeMetric('economic', 9)).toBe(100)
  })
  it('醫療為反向（床多→壓力低）', () => {
    expect(normalizeMetric('healthcare', 80)).toBe(0)
    expect(normalizeMetric('healthcare', 20)).toBe(100)
    expect(normalizeMetric('healthcare', 50)).toBe(50)
  })
})
```

- [ ] **Step 2: 跑、確認失敗** — `pnpm test src/lib/normalize.test.ts` → FAIL

- [ ] **Step 3: 實作**

`src/lib/normalize.ts`：
```ts
import type { MetricKey } from './types'

/**
 * 絕對參考門檻：raw=lo → 0 分、raw=hi → 100 分，裁切到 0–100。
 * 反向指標（如醫療：床越少壓力越大）以 lo>hi 表達，公式自然反向。
 * 為先驗值，可校準。
 */
export const THRESHOLDS: Record<MetricKey, { lo: number; hi: number }> = {
  economic: { lo: 2.5, hi: 6.0 },    // 失業率 %
  housing: { lo: 5, hi: 17 },        // 房價所得比 倍
  demographic: { lo: 50, hi: 300 },  // 老化指數
  safety: { lo: 800, hi: 2500 },     // 刑案 件/十萬人
  healthcare: { lo: 80, hi: 20 },    // 每萬人病床（反向）
}

export function normalizeMetric(metric: MetricKey, raw: number): number {
  const { lo, hi } = THRESHOLDS[metric]
  const t = (raw - lo) / (hi - lo)
  return Math.round(Math.max(0, Math.min(1, t)) * 100)
}
```

- [ ] **Step 4: 跑、確認通過** — PASS

- [ ] **Step 5: Commit**
```bash
git add src/lib/normalize.ts src/lib/normalize.test.ts
git commit -m "feat: 絕對門檻正規化 normalizeMetric（含反向）"
```

---

### Task 2: 型別改動 + buildRiskData 改寫 + 退役 mock

**Files:** Modify `src/lib/types.ts`, `src/lib/buildRiskData.ts`, `src/lib/buildRiskData.test.ts`; Delete `src/lib/mock.ts`, `src/lib/mock.test.ts`

- [ ] **Step 1: 改型別**

`src/lib/types.ts` —（保留 CountyCode/County/MetricKey/METRIC_KEYS/CountySignal/RiskLevel）將 `CountyRisk` 改為，並新增 SourceMeta/PressureData：
```ts
export interface CountyRisk {
  code: CountyCode
  name: string
  score: number | null                       // 全指標皆缺 → null
  subScores: Partial<Record<MetricKey, number>>
  confidence: number
  asOf: string | null
  hasData: boolean
}

export interface SourceMeta {
  metric: MetricKey
  label: string
  agency: string
  asOf: string
  status: 'live' | 'missing'
  url?: string
}

export interface PressureData {
  signals: CountySignal[]
  sources: SourceMeta[]
  builtAt: string
}
```

- [ ] **Step 2: 改 buildRiskData 測試（先寫期望行為）**

覆寫 `src/lib/buildRiskData.test.ts`：
```ts
import { describe, it, expect } from 'vitest'
import { buildRiskData } from './buildRiskData'
import { COUNTIES } from './counties'
import type { CountySignal } from './types'

const sig = (code: string, metric: any, value: number): CountySignal =>
  ({ code, metric, value, confidence: 0.85, asOf: '2024' })

describe('buildRiskData（真實訊號或留空）', () => {
  it('涵蓋全部 22 縣市', () => {
    expect(buildRiskData([])).toHaveLength(COUNTIES.length)
  })
  it('零訊號縣市 → hasData=false, score=null, subScores={}', () => {
    const r = buildRiskData([]).find((x) => x.code === '63000')!
    expect(r.hasData).toBe(false)
    expect(r.score).toBeNull()
    expect(r.subScores).toEqual({})
    expect(r.asOf).toBeNull()
  })
  it('部分指標 → 只計有資料者（重正規化），hasData=true', () => {
    const r = buildRiskData([sig('63000', 'economic', 80)]).find((x) => x.code === '63000')!
    expect(r.hasData).toBe(true)
    expect(r.subScores).toEqual({ economic: 80 })
    expect(r.score).toBe(80) // 只有一個指標 → 等於該值
    expect(r.asOf).toBe('2024')
  })
  it('多來源同 (code, metric) 取 MAX', () => {
    const r = buildRiskData([sig('64000', 'safety', 40), sig('64000', 'safety', 70)])
      .find((x) => x.code === '64000')!
    expect(r.subScores.safety).toBe(70)
  })
  it('不同縣市互不影響', () => {
    const all = buildRiskData([sig('63000', 'economic', 90)])
    expect(all.find((x) => x.code === '64000')!.hasData).toBe(false)
  })
})
```

- [ ] **Step 3: 跑、確認失敗** — FAIL（型別/行為未改）

- [ ] **Step 4: 改寫 buildRiskData.ts**

覆寫 `src/lib/buildRiskData.ts`：
```ts
import { COUNTIES } from './counties'
import { calculateRiskScore } from './score'
import {
  METRIC_KEYS,
  type CountyRisk,
  type CountySignal,
  type MetricKey,
} from './types'

/**
 * 由真實訊號組出每縣市 CountyRisk。無 mock：缺的指標就缺。
 * 同一 (code, metric) 多來源取 MAX。零訊號縣市 → 無資料。
 */
export function buildRiskData(signals: CountySignal[]): CountyRisk[] {
  const byCounty = new Map<string, Map<MetricKey, CountySignal>>()
  for (const s of signals) {
    if (!byCounty.has(s.code)) byCounty.set(s.code, new Map())
    const m = byCounty.get(s.code)!
    const existing = m.get(s.metric)
    if (!existing || s.value > existing.value) m.set(s.metric, s)
  }

  return COUNTIES.map((county) => {
    const m = byCounty.get(county.code)
    const subScores: Partial<Record<MetricKey, number>> = {}
    let confSum = 0
    let n = 0
    let asOf: string | null = null
    if (m) {
      for (const k of METRIC_KEYS) {
        const sig = m.get(k)
        if (!sig) continue
        subScores[k] = sig.value
        confSum += sig.confidence
        n += 1
        if (sig.asOf && (!asOf || sig.asOf > asOf)) asOf = sig.asOf
      }
    }
    const hasData = n > 0
    return {
      code: county.code,
      name: county.name,
      score: hasData ? calculateRiskScore(subScores) : null,
      subScores,
      confidence: hasData ? Math.round((confSum / n) * 100) / 100 : 0,
      asOf,
      hasData,
    }
  })
}
```

- [ ] **Step 5: 跑、確認通過** — PASS

- [ ] **Step 6: 退役 mock**
```bash
git rm src/lib/mock.ts src/lib/mock.test.ts
```

- [ ] **Step 7: 全測試 + tsc**

Run: `pnpm test` — 此時 useRiskData/元件仍引用舊型別，TS build 可能紅；單元測試（lib）應綠。
Run: `pnpm exec tsc --noEmit -p tsconfig.app.json` — 預期會報 useRiskData/元件的型別錯（下面 Task 3/4 修）。記下錯誤、繼續。

- [ ] **Step 8: Commit**
```bash
git add -A
git commit -m "feat: buildRiskData 改真實訊號或留空（CountyRisk 可無資料）+ 退役 mock"
```

---

### Task 3: useRiskData 載入快照 JSON + seed 檔

**Files:** Modify `src/hooks/useRiskData.ts`; Create `public/taiwan-pressure.json`

- [ ] **Step 1: 建立 seed 快照**（Task B 的腳本之後會覆蓋）

`public/taiwan-pressure.json`：
```json
{
  "signals": [
    { "code": "63000", "metric": "economic", "value": 35, "confidence": 0.85, "asOf": "2024" },
    { "code": "64000", "metric": "economic", "value": 48, "confidence": 0.85, "asOf": "2024" }
  ],
  "sources": [
    { "metric": "economic", "label": "失業率", "agency": "主計總處", "asOf": "2024", "status": "live" },
    { "metric": "housing", "label": "房價所得比", "agency": "內政部不動產資訊平台", "asOf": "-", "status": "missing" },
    { "metric": "demographic", "label": "老化指數", "agency": "內政部戶政司", "asOf": "-", "status": "missing" },
    { "metric": "safety", "label": "刑案發生率", "agency": "警政署", "asOf": "-", "status": "missing" },
    { "metric": "healthcare", "label": "每萬人病床數", "agency": "衛福部", "asOf": "-", "status": "missing" }
  ],
  "builtAt": "2026-06-18T00:00:00.000Z"
}
```

- [ ] **Step 2: 改 useRiskData**

覆寫 `src/hooks/useRiskData.ts`：
```ts
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
```

- [ ] **Step 3: 驗證** — `pnpm build` 仍會因 App/元件用舊 `data` 形狀而紅；Task 4 修。先確認本檔無自身型別錯：`pnpm exec tsc --noEmit -p tsconfig.app.json` 錯誤僅落在元件層。

- [ ] **Step 4: Commit**
```bash
git add src/hooks/useRiskData.ts public/taiwan-pressure.json
git commit -m "feat: useRiskData 改載 taiwan-pressure.json 快照（含 seed）"
```

---

### Task 4: UI 無資料處理 + 資料來源 footnote

**Files:** Modify `src/lib/colors.ts`, `src/App.tsx`, `src/components/MapView.tsx`, `src/components/ControlPanel.tsx`, `src/components/CountyDrawer.tsx`, `src/locales/zh-Hant.json`; Create `src/components/DataSources.tsx`

- [ ] **Step 1: 加無資料色 + 字串**

`src/lib/colors.ts` 末尾加：
```ts
export const NO_DATA_COLOR = '#d9d1c0' // 紙感中性灰，用於無資料縣市
```

`src/locales/zh-Hant.json`：在 `drawer` 加 `"noData": "無資料"`；新增頂層：
```json
"sources": { "title": "資料來源", "live": "已接", "missing": "無資料", "builtAt": "快照" },
"badge": { "real": "真實統計", "partial": "部分指標" }
```

- [ ] **Step 2: App 改用 RiskBundle + badge + footnote**

`src/App.tsx`：`useRiskData()` 現回 `{risks, sources, builtAt}`。改解構與傳遞；header 徽章依 sources 狀態；控制面板下方放 `<DataSources>`。完整覆寫：
```tsx
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapView } from '@/components/MapView'
import { ControlPanel } from '@/components/ControlPanel'
import { CountyDrawer } from '@/components/CountyDrawer'
import { Legend } from '@/components/Legend'
import { DataSources } from '@/components/DataSources'
import { useRiskData } from '@/hooks/useRiskData'
import type { MetricKey } from '@/lib/types'

type ColorBy = 'composite' | MetricKey

export default function App() {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useRiskData()
  const [colorBy, setColorBy] = useState<ColorBy>('composite')
  const [selectedCode, setSelectedCode] = useState<string | null>(null)

  const risks = data?.risks
  const allLive = data ? data.sources.every((s) => s.status === 'live') : false
  const selected = useMemo(
    () => risks?.find((r) => r.code === selectedCode) ?? null,
    [risks, selectedCode],
  )

  return (
    <div className="h-full flex flex-col bg-[var(--color-paper)]">
      <header className="px-7 pt-5 pb-3 border-b border-[var(--color-ink)]/15 rise">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="kicker mb-1.5">區域壓力分析</div>
            <h1 className="font-serif text-[27px] leading-none font-bold tracking-tight">{t('app.title')}</h1>
          </div>
          <div className="text-right shrink-0">
            <div className="font-display text-sm italic text-[var(--color-ink-2)]">Taiwan County Pressure Index</div>
            <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--color-ink-2)] mt-1">
              2026 · {allLive ? t('badge.real') : t('badge.partial')}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex relative overflow-hidden">
        {isLoading && <div className="m-auto text-[var(--color-ink-2)]">{t('state.loading')}</div>}
        {isError && <div className="m-auto text-[var(--color-accent)]">{t('state.error')}</div>}
        {risks && data && (
          <>
            <div className="w-[19rem] shrink-0 h-full flex flex-col border-r border-[var(--color-ink)]/15">
              <div className="flex-1 overflow-y-auto">
                <ControlPanel
                  risks={risks}
                  colorBy={colorBy}
                  onColorBy={setColorBy}
                  selectedCode={selectedCode}
                  onSelect={setSelectedCode}
                />
              </div>
              <DataSources sources={data.sources} builtAt={data.builtAt} />
            </div>
            <div className="flex-1 relative">
              <MapView
                risks={risks}
                colorBy={colorBy}
                selectedCode={selectedCode}
                onSelect={setSelectedCode}
              />
              <Legend />
              <CountyDrawer risk={selected} onClose={() => setSelectedCode(null)} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```
> 註：ControlPanel 原本自帶 `w-[19rem] border-r`，現由外層 wrapper 提供。Step 4 會把 ControlPanel 的 `<aside>` 改為 `<div>` 並移除寬度/邊框/卷軸 class（改由 wrapper 控制），避免重複。

- [ ] **Step 3: MapView 無資料色**

`src/components/MapView.tsx`：`fillGeo` 內，county 無 risk 或 `score===null` → 用 `NO_DATA_COLOR`；label 不顯示數字（顯示空字串）。改 `fillGeo` 與 `labelGeo`：
```tsx
// 檔頭 import 補上：
import { scoreColor, NO_DATA_COLOR } from '@/lib/colors'

// fillGeo map 內：
const r = byCode.get(f.properties.COUNTYCODE)
const noData = !r || r.score === null
const v = r && r.score !== null ? valueFor(r, colorBy) : 0
return { ...f, properties: { ...f.properties, _color: noData ? NO_DATA_COLOR : scoreColor(v) } }

// valueFor 改成防呆（score 可能為 null，但僅在 !noData 時呼叫）；
// labelGeo flatMap 內：score===null 的縣市 return []（不放標籤）
```
其中 `valueFor`：
```tsx
function valueFor(r: CountyRisk, colorBy: ColorBy): number {
  if (colorBy === 'composite') return r.score ?? 0
  return r.subScores[colorBy] ?? 0
}
```
labelGeo：
```tsx
features: risks.flatMap((r) => {
  const c = centroids[r.code]
  if (!c || r.score === null) return []
  const v = valueFor(r, colorBy)
  return [{ type: 'Feature', properties: { label: String(v), _v: v }, geometry: { type: 'Point', coordinates: c } }]
}),
```

- [ ] **Step 4: ControlPanel 無資料**

`src/components/ControlPanel.tsx`：移除 `<aside>` 的寬/邊框/卷軸（改 `<div className="px-6 py-5 flex flex-col gap-7 bg-[var(--color-paper)] rise">`）。排序把無資料排末；無資料列顯示「—」、不畫長條：
```tsx
const valueFor = (r: CountyRisk) =>
  colorBy === 'composite' ? r.score : (r.subScores[colorBy] ?? null)
const ranked = [...risks].sort((a, b) => {
  const av = valueFor(a); const bv = valueFor(b)
  if (av === null && bv === null) return 0
  if (av === null) return 1
  if (bv === null) return -1
  return bv - av
})
// 列內：
const v = valueFor(r)
// 數字欄：v === null ? '—' : v；長條：v === null 時不渲染填充；顏色 scoreColor(v ?? 0)
```
（`v===null` 時數字顯示「—」用 `text-[var(--color-ink-2)]`，長條軌道仍顯示但無填充。）

- [ ] **Step 5: CountyDrawer 無資料**

`src/components/CountyDrawer.tsx`：`risk.score === null` → 大數字區顯示 `t('drawer.noData')`，不顯示等級；子指標逐項：`risk.subScores[k]` 為 undefined → 該列顯示 `t('drawer.noData')`、不畫長條。
```tsx
const has = risk.score !== null
// 大數字：has ? <score+level> : <span className="font-serif text-3xl text-[var(--color-ink-2)]">{t('drawer.noData')}</span>
// 子指標 map：const v = risk.subScores[k];  v === undefined ? 無資料列 : 長條列
// confidence 行：has 時顯示，否則隱藏
```

- [ ] **Step 6: DataSources 元件**

`src/components/DataSources.tsx`：
```tsx
import { useTranslation } from 'react-i18next'
import type { SourceMeta } from '@/lib/types'

interface Props {
  sources: SourceMeta[]
  builtAt: string
}

export function DataSources({ sources, builtAt }: Props) {
  const { t } = useTranslation()
  return (
    <div className="border-t border-[var(--color-ink)]/15 px-6 py-4 bg-[var(--color-paper)]">
      <div className="kicker mb-2.5">{t('sources.title')}</div>
      <ul className="flex flex-col gap-1.5">
        {sources.map((s) => (
          <li key={s.metric} className="flex items-baseline justify-between text-[12px]">
            <span className="text-[var(--color-ink)]">{s.label}</span>
            <span className="text-[var(--color-ink-2)] font-display tabular-nums">
              {s.agency} · {s.status === 'live' ? `${s.asOf}` : t('sources.missing')}
            </span>
          </li>
        ))}
      </ul>
      <div className="text-[10px] text-[var(--color-ink-2)]/70 mt-2.5">
        {t('sources.builtAt')} {builtAt.slice(0, 10)}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: 驗證**

Run: `pnpm exec tsc --noEmit -p tsconfig.app.json` → No errors。
Run: `pnpm build` → 成功。
Run: `pnpm test` → 全綠（lib 測試；元件無單元測試）。

- [ ] **Step 8: Commit**
```bash
git add -A
git commit -m "feat: UI 無資料樣式（地圖灰/排行—/drawer 無資料）+ 資料來源 footnote + 真實/部分徽章"
```

---

## 階段 B — build 腳本（真實資料，逐來源 graceful）

> 重要：每個來源獨立 try/catch。抓不到/解析失敗 → 該指標 `status:'missing'`、不產 signal、**不可中止其他來源**。所有來源都用 `findCountyByName`（含臺/台正規化）對 COUNTYCODE，用 `normalizeMetric` 轉分。

### Task 5: 腳本骨架 + 共用工具（tsx）

**Files:** Modify `package.json`; Create `scripts/build-pressure.ts`, `scripts/sources/types.ts`, `scripts/sources/population.ts`, `scripts/sources/population.test.ts`, `scripts/fixtures/.gitkeep`

- [ ] **Step 1: 加 tsx + script**
```bash
pnpm add -D tsx
```
`package.json` scripts 加：`"build:data": "tsx scripts/build-pressure.ts"`。

- [ ] **Step 2: 來源介面**

`scripts/sources/types.ts`：
```ts
import type { CountySignal, SourceMeta } from '../../src/lib/types'
export interface SourceResult {
  signals: CountySignal[]
  meta: SourceMeta
}
export type SourceFetcher = () => Promise<SourceResult>
```

- [ ] **Step 3: 人口載入（safety/healthcare 算率用）— 含解析純函式測試**

先 scout：找一份縣市別人口的穩定開放資料（內政部戶政司／data.gov.tw）。把回應樣本存到 `scripts/fixtures/population.<csv|json>`。

`scripts/sources/population.test.ts`（用 fixture 測 `parsePopulation`）：
```ts
import { describe, it, expect } from 'vitest'
import { parsePopulation } from './population'

// 用實際存下的 fixture 內容片段；下例為 CSV 兩欄示意，請依實際格式調整
const sample = `縣市,人口數\n臺北市,2500000\n高雄市,2700000\n`

describe('parsePopulation', () => {
  it('回傳 code→人口 map', () => {
    const m = parsePopulation(sample)
    expect(m['63000']).toBe(2500000)
    expect(m['64000']).toBe(2700000)
  })
})
```

`scripts/sources/population.ts`：
```ts
import { findCountyByName } from '../../src/lib/counties'

/** 解析縣市別人口為 code→人口。純函式（吃原始文字），便於測試。
 *  ↓ 依實際 fixture 欄位調整切割與欄位索引。 */
export function parsePopulation(raw: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const line of raw.trim().split(/\r?\n/).slice(1)) {
    const cols = line.split(',')
    const county = findCountyByName((cols[0] ?? '').trim())
    const pop = Number((cols[1] ?? '').replace(/[",\s]/g, ''))
    if (county && Number.isFinite(pop)) out[county.code] = pop
  }
  return out
}

export async function loadPopulation(): Promise<Record<string, number>> {
  const url = '<scout 後填入穩定 URL>'
  const res = await fetch(url)
  if (!res.ok) throw new Error(`population ${res.status}`)
  return parsePopulation(await res.text())
}
```

- [ ] **Step 4: 主腳本 runner + writer**

`scripts/build-pressure.ts`：
```ts
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { SourceFetcher, SourceResult } from './sources/types'
import { economic } from './sources/economic'
import { demographic } from './sources/demographic'
import { safety } from './sources/safety'
import { healthcare } from './sources/healthcare'
import { housing } from './sources/housing'

const FETCHERS: { metric: string; fn: SourceFetcher }[] = [
  { metric: 'economic', fn: economic },
  { metric: 'demographic', fn: demographic },
  { metric: 'safety', fn: safety },
  { metric: 'healthcare', fn: healthcare },
  { metric: 'housing', fn: housing },
]

const results: SourceResult[] = []
for (const { metric, fn } of FETCHERS) {
  try {
    const r = await fn()
    console.log(`✓ ${metric}: ${r.signals.length} signals (${r.meta.asOf})`)
    results.push(r)
  } catch (e) {
    console.warn(`✗ ${metric}: ${(e as Error).message} → 留空`)
    results.push({
      signals: [],
      meta: { metric: metric as any, label: metric, agency: '', asOf: '-', status: 'missing' },
    })
  }
}

const out = {
  signals: results.flatMap((r) => r.signals),
  sources: results.map((r) => r.meta),
  builtAt: new Date().toISOString(),
}
writeFileSync(resolve('public/taiwan-pressure.json'), JSON.stringify(out, null, 2))
console.log(`寫出 public/taiwan-pressure.json：${out.signals.length} signals`)
```
> 此時 `./sources/economic` 等尚未建立 → 下面 Task 6–10 各建一個。為讓 Task 5 可獨立 commit，先建 5 個 stub（各 export 對應名稱、`async`、throw `new Error('未實作')`），Task 6–10 再逐一實作。

Stub 範例（5 個檔案 `scripts/sources/{economic,demographic,safety,healthcare,housing}.ts` 皆先放）：
```ts
import type { SourceFetcher } from './types'
export const economic: SourceFetcher = async () => { throw new Error('未實作') }
```
（各檔 export 名稱對應 metric。）

- [ ] **Step 5: 跑測試 + 試跑腳本**

Run: `pnpm test scripts/sources/population.test.ts` → PASS
Run: `pnpm build:data` → 應印 5 個 `✗ … 留空`，並寫出全 missing 的 JSON（不崩）。確認 graceful runner 正常。
（之後 Task 6–10 逐一把 stub 換實作；最後 Task 11 正式跑。）

- [ ] **Step 6: Commit**
```bash
git add -A
git commit -m "feat(script): build-pressure 腳本骨架 + 人口解析 + graceful runner（來源先 stub）"
```

---

### Task 6: 來源 — 經濟（失業率）

**Files:** Modify `scripts/sources/economic.ts`; Create `scripts/sources/economic.test.ts`, `scripts/fixtures/economic.*`

- [ ] **Step 1: Scout + 存 fixture** — 找主計總處／data.gov.tw 的**縣市別失業率**穩定資料（CSV/JSON）。把回應樣本存 `scripts/fixtures/economic.<ext>`，記下：值欄位、縣市名欄位、資料期、URL。

- [ ] **Step 2: 解析純函式測試**

`scripts/sources/economic.test.ts`（依實際 fixture 調整 sample 與期望）：
```ts
import { describe, it, expect } from 'vitest'
import { parseUnemployment } from './economic'

const sample = `縣市,失業率\n臺北市,3.6\n高雄市,3.9\n`
describe('parseUnemployment', () => {
  it('回傳 {code, rawValue}[]', () => {
    const rows = parseUnemployment(sample)
    expect(rows).toContainEqual({ code: '63000', raw: 3.6 })
    expect(rows).toContainEqual({ code: '64000', raw: 3.9 })
  })
})
```

- [ ] **Step 3: 實作 economic.ts**
```ts
import { findCountyByName } from '../../src/lib/counties'
import { normalizeMetric } from '../../src/lib/normalize'
import type { SourceFetcher } from './types'

const URL = '<scout 後填入>'
const AS_OF = '<scout 後填入，如 2024>'

/** 純函式：原始文字 → {code, raw 失業率%}[]。依實際欄位調整。 */
export function parseUnemployment(raw: string): { code: string; raw: number }[] {
  const out: { code: string; raw: number }[] = []
  for (const line of raw.trim().split(/\r?\n/).slice(1)) {
    const cols = line.split(',')
    const c = findCountyByName((cols[0] ?? '').trim())
    const v = Number((cols[1] ?? '').replace(/[",\s%]/g, ''))
    if (c && Number.isFinite(v)) out.push({ code: c.code, raw: v })
  }
  return out
}

export const economic: SourceFetcher = async () => {
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`economic ${res.status}`)
  const rows = parseUnemployment(await res.text())
  if (rows.length === 0) throw new Error('economic 解析 0 筆')
  return {
    signals: rows.map((r) => ({
      code: r.code, metric: 'economic' as const,
      value: normalizeMetric('economic', r.raw), confidence: 0.85, asOf: AS_OF, raw: r.raw,
    })),
    meta: { metric: 'economic', label: '失業率', agency: '主計總處', asOf: AS_OF, status: 'live', url: URL },
  }
}
```

- [ ] **Step 4: 測試 PASS**（`pnpm test scripts/sources/economic.test.ts`）。若來源實在抓不到（URL 不穩/格式無法解析），保留 stub `throw`、記錄於 commit message，該指標留空（符合 spec）。

- [ ] **Step 5: Commit**
```bash
git add scripts/sources/economic.ts scripts/sources/economic.test.ts scripts/fixtures/economic.*
git commit -m "feat(script): 經濟失業率來源（主計總處）"
```

---

### Task 7: 來源 — 人口（老化指數）

**Files:** Modify `scripts/sources/demographic.ts`; Create `scripts/sources/demographic.test.ts`, `scripts/fixtures/demographic.*`

- [ ] **Step 1: Scout + fixture** — 內政部戶政司**縣市別老化指數**（老年人口/幼年人口×100）。存樣本、記欄位/期/URL。

- [ ] **Step 2: 解析測試**

`scripts/sources/demographic.test.ts`：
```ts
import { describe, it, expect } from 'vitest'
import { parseAgingIndex } from './demographic'
const sample = `縣市,老化指數\n臺北市,180.5\n高雄市,165.0\n`
describe('parseAgingIndex', () => {
  it('回傳 {code, raw}', () => {
    expect(parseAgingIndex(sample)).toContainEqual({ code: '63000', raw: 180.5 })
  })
})
```

- [ ] **Step 3: 實作 demographic.ts**（同 economic 結構，metric='demographic'、label='老化指數'、agency='內政部戶政司'）
```ts
import { findCountyByName } from '../../src/lib/counties'
import { normalizeMetric } from '../../src/lib/normalize'
import type { SourceFetcher } from './types'

const URL = '<scout 後填入>'
const AS_OF = '<scout 後填入>'

export function parseAgingIndex(raw: string): { code: string; raw: number }[] {
  const out: { code: string; raw: number }[] = []
  for (const line of raw.trim().split(/\r?\n/).slice(1)) {
    const cols = line.split(',')
    const c = findCountyByName((cols[0] ?? '').trim())
    const v = Number((cols[1] ?? '').replace(/[",\s]/g, ''))
    if (c && Number.isFinite(v)) out.push({ code: c.code, raw: v })
  }
  return out
}

export const demographic: SourceFetcher = async () => {
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`demographic ${res.status}`)
  const rows = parseAgingIndex(await res.text())
  if (rows.length === 0) throw new Error('demographic 解析 0 筆')
  return {
    signals: rows.map((r) => ({
      code: r.code, metric: 'demographic' as const,
      value: normalizeMetric('demographic', r.raw), confidence: 0.85, asOf: AS_OF, raw: r.raw,
    })),
    meta: { metric: 'demographic', label: '老化指數', agency: '內政部戶政司', asOf: AS_OF, status: 'live', url: URL },
  }
}
```

- [ ] **Step 4: 測試 PASS**（抓不到則保留 stub、記錄、留空）

- [ ] **Step 5: Commit** — `git commit -m "feat(script): 人口老化指數來源（內政部戶政司）"`

---

### Task 8: 來源 — 治安（刑案發生率，需人口）

**Files:** Modify `scripts/sources/safety.ts`; Create `scripts/sources/safety.test.ts`, `scripts/fixtures/safety.*`

- [ ] **Step 1: Scout + fixture** — 警政署／內政部統計**縣市別全般刑案發生數**。存樣本；率 = 發生數 / 人口 × 100000（用 `loadPopulation`）。

- [ ] **Step 2: 解析測試**

`scripts/sources/safety.test.ts`：
```ts
import { describe, it, expect } from 'vitest'
import { parseCrimeCounts, toRatePer100k } from './safety'
const sample = `縣市,發生數\n臺北市,30000\n高雄市,40000\n`
describe('safety', () => {
  it('parseCrimeCounts → {code, count}', () => {
    expect(parseCrimeCounts(sample)).toContainEqual({ code: '63000', count: 30000 })
  })
  it('toRatePer100k 用人口算率', () => {
    expect(toRatePer100k(30000, 2500000)).toBeCloseTo(1200, 0)
  })
})
```

- [ ] **Step 3: 實作 safety.ts**
```ts
import { findCountyByName } from '../../src/lib/counties'
import { normalizeMetric } from '../../src/lib/normalize'
import { loadPopulation } from './population'
import type { SourceFetcher } from './types'

const URL = '<scout 後填入>'
const AS_OF = '<scout 後填入>'

export function parseCrimeCounts(raw: string): { code: string; count: number }[] {
  const out: { code: string; count: number }[] = []
  for (const line of raw.trim().split(/\r?\n/).slice(1)) {
    const cols = line.split(',')
    const c = findCountyByName((cols[0] ?? '').trim())
    const n = Number((cols[1] ?? '').replace(/[",\s]/g, ''))
    if (c && Number.isFinite(n)) out.push({ code: c.code, count: n })
  }
  return out
}

export function toRatePer100k(count: number, population: number): number {
  return population > 0 ? (count / population) * 100000 : 0
}

export const safety: SourceFetcher = async () => {
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`safety ${res.status}`)
  const counts = parseCrimeCounts(await res.text())
  if (counts.length === 0) throw new Error('safety 解析 0 筆')
  const pop = await loadPopulation()
  const signals = counts
    .filter((r) => pop[r.code])
    .map((r) => {
      const rate = toRatePer100k(r.count, pop[r.code])
      return {
        code: r.code, metric: 'safety' as const,
        value: normalizeMetric('safety', rate), confidence: 0.8, asOf: AS_OF, raw: { count: r.count, rate },
      }
    })
  if (signals.length === 0) throw new Error('safety 對不到人口')
  return {
    signals,
    meta: { metric: 'safety', label: '刑案發生率', agency: '警政署', asOf: AS_OF, status: 'live', url: URL },
  }
}
```

- [ ] **Step 4: 測試 PASS**（抓不到則 stub、記錄、留空）

- [ ] **Step 5: Commit** — `git commit -m "feat(script): 治安刑案率來源（警政署，含人口算率）"`

---

### Task 9: 來源 — 醫療（每萬人病床，反向，需人口）

**Files:** Modify `scripts/sources/healthcare.ts`; Create `scripts/sources/healthcare.test.ts`, `scripts/fixtures/healthcare.*`

- [ ] **Step 1: Scout + fixture** — 衛福部**縣市別病床數**。每萬人病床 = 病床數 / 人口 × 10000；normalizeMetric('healthcare') 已反向（床多→低分）。

- [ ] **Step 2: 解析測試**

`scripts/sources/healthcare.test.ts`：
```ts
import { describe, it, expect } from 'vitest'
import { parseBeds, bedsPer10k } from './healthcare'
const sample = `縣市,病床數\n臺北市,30000\n高雄市,27000\n`
describe('healthcare', () => {
  it('parseBeds → {code, beds}', () => {
    expect(parseBeds(sample)).toContainEqual({ code: '63000', beds: 30000 })
  })
  it('bedsPer10k', () => {
    expect(bedsPer10k(30000, 2500000)).toBeCloseTo(120, 0)
  })
})
```

- [ ] **Step 3: 實作 healthcare.ts**
```ts
import { findCountyByName } from '../../src/lib/counties'
import { normalizeMetric } from '../../src/lib/normalize'
import { loadPopulation } from './population'
import type { SourceFetcher } from './types'

const URL = '<scout 後填入>'
const AS_OF = '<scout 後填入>'

export function parseBeds(raw: string): { code: string; beds: number }[] {
  const out: { code: string; beds: number }[] = []
  for (const line of raw.trim().split(/\r?\n/).slice(1)) {
    const cols = line.split(',')
    const c = findCountyByName((cols[0] ?? '').trim())
    const n = Number((cols[1] ?? '').replace(/[",\s]/g, ''))
    if (c && Number.isFinite(n)) out.push({ code: c.code, beds: n })
  }
  return out
}

export function bedsPer10k(beds: number, population: number): number {
  return population > 0 ? (beds / population) * 10000 : 0
}

export const healthcare: SourceFetcher = async () => {
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`healthcare ${res.status}`)
  const rows = parseBeds(await res.text())
  if (rows.length === 0) throw new Error('healthcare 解析 0 筆')
  const pop = await loadPopulation()
  const signals = rows
    .filter((r) => pop[r.code])
    .map((r) => {
      const per = bedsPer10k(r.beds, pop[r.code])
      return {
        code: r.code, metric: 'healthcare' as const,
        value: normalizeMetric('healthcare', per), confidence: 0.8, asOf: AS_OF, raw: { beds: r.beds, per10k: per },
      }
    })
  if (signals.length === 0) throw new Error('healthcare 對不到人口')
  return {
    signals,
    meta: { metric: 'healthcare', label: '每萬人病床數', agency: '衛福部', asOf: AS_OF, status: 'live', url: URL },
  }
}
```

- [ ] **Step 4: 測試 PASS**（抓不到則 stub、記錄、留空）

- [ ] **Step 5: Commit** — `git commit -m "feat(script): 醫療每萬人病床來源（衛福部，反向）"`

---

### Task 10: 來源 — 居住（房價所得比，風險高）

**Files:** Modify `scripts/sources/housing.ts`; Create `scripts/sources/housing.test.ts`, `scripts/fixtures/housing.*`

- [ ] **Step 1: Scout + fixture** — 內政部不動產資訊平台**房價所得比**（縣市別季報）。常為 Excel/HTML：先試 data.gov.tw 是否有 CSV/JSON；若僅 Excel，嘗試以可得格式解析。**若無法穩定取得 → 保留 stub throw，該指標留空**（spec 已允許）。

- [ ] **Step 2: 解析測試**（取得到才寫；格式依實際）
```ts
import { describe, it, expect } from 'vitest'
import { parsePriceIncomeRatio } from './housing'
const sample = `縣市,房價所得比\n臺北市,15.8\n高雄市,8.4\n`
describe('parsePriceIncomeRatio', () => {
  it('回傳 {code, raw}', () => {
    expect(parsePriceIncomeRatio(sample)).toContainEqual({ code: '63000', raw: 15.8 })
  })
})
```

- [ ] **Step 3: 實作 housing.ts**（結構同 economic，metric='housing'、label='房價所得比'、agency='內政部不動產資訊平台'）
```ts
import { findCountyByName } from '../../src/lib/counties'
import { normalizeMetric } from '../../src/lib/normalize'
import type { SourceFetcher } from './types'

const URL = '<scout 後填入；若無穩定來源則保留 stub throw>'
const AS_OF = '<scout 後填入>'

export function parsePriceIncomeRatio(raw: string): { code: string; raw: number }[] {
  const out: { code: string; raw: number }[] = []
  for (const line of raw.trim().split(/\r?\n/).slice(1)) {
    const cols = line.split(',')
    const c = findCountyByName((cols[0] ?? '').trim())
    const v = Number((cols[1] ?? '').replace(/[",\s]/g, ''))
    if (c && Number.isFinite(v)) out.push({ code: c.code, raw: v })
  }
  return out
}

export const housing: SourceFetcher = async () => {
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`housing ${res.status}`)
  const rows = parsePriceIncomeRatio(await res.text())
  if (rows.length === 0) throw new Error('housing 解析 0 筆')
  return {
    signals: rows.map((r) => ({
      code: r.code, metric: 'housing' as const,
      value: normalizeMetric('housing', r.raw), confidence: 0.8, asOf: AS_OF, raw: r.raw,
    })),
    meta: { metric: 'housing', label: '房價所得比', agency: '內政部不動產資訊平台', asOf: AS_OF, status: 'live', url: URL },
  }
}
```

- [ ] **Step 4: 測試 PASS 或記錄留空**

- [ ] **Step 5: Commit** — `git commit -m "feat(script): 居住房價所得比來源（內政部不動產平台；不可得則留空）"`

---

### Task 11: 正式產生快照 + 瀏覽器驗證 + 收尾

**Files:** `public/taiwan-pressure.json`（由腳本產生）

- [ ] **Step 1: 跑腳本產生真實快照**

Run: `pnpm build:data`
Expected: 印出每來源 ✓/✗；寫出 `public/taiwan-pressure.json`。記下哪些 live、哪些 missing。

- [ ] **Step 2: 全測試 + build**

Run: `pnpm test` → 全綠
Run: `pnpm build` → 成功

- [ ] **Step 3: 瀏覽器人工驗證**

`pnpm dev`，確認：(1) 地圖以真實值著色；(2) missing 指標的縣市/維度顯示無資料（灰/—/無資料）；(3) 著色維度切到 missing 指標時，全部或多數無資料正常呈現；(4) 資料來源 footnote 顯示各來源狀態與資料期；(5) header 徽章為「真實統計」或「部分指標」。截圖檢視。

- [ ] **Step 4: 微調門檻（如需）**

依真實分佈，若某指標全部擠在 0 或 100，回 `src/lib/normalize.ts` 調 `THRESHOLDS`（維持絕對門檻精神，註解記錄理由），重跑 `pnpm build:data`。

- [ ] **Step 5: Commit 快照**
```bash
git add public/taiwan-pressure.json src/lib/normalize.ts
git commit -m "feat: 產生真實縣市壓力快照（標示 live/missing）"
```

---

## Self-Review

**1. Spec coverage:**
- 絕對門檻正規化 → Task 1 ✓；自動抓/留空不 mock → Task 2（buildRiskData 改寫、退役 mock）+ Task 5 runner graceful ✓
- 五來源（economic/demographic/safety/healthcare/housing）→ Task 6–10 ✓；人口算率 → Task 5(population)+8+9 ✓
- 靜態快照 public/taiwan-pressure.json → Task 3(seed)+11(真實) ✓；SourceMeta/PressureData → Task 2 ✓
- 無資料處理（地圖灰/排行—/drawer 無資料/單指標缺重正規化/全缺 null）→ Task 2(邏輯)+4(UI) ✓
- 資料來源 footnote + 真實/部分徽章 → Task 4 ✓
- 測試（normalize 邊界/反向、buildRiskData 缺值與 MAX、解析純函式 fixture）→ Task 1,2,5–10 ✓

**2. Placeholder scan:** 程式碼步驟皆完整。`<scout 後填入>` 出現在來源 URL/AS_OF —— 這是真實資料整合的本質（外部 URL/格式不可預先得知），已以「scout→存 fixture→TDD 解析→graceful 留空」流程包覆，等同 #1 GeoJSON Task 7 的處理；非可省略的佔位，而是必經的探勘步驟。每個來源都有「抓不到則保留 stub、留空」的明確出口。

**3. Type consistency:** `CountyRisk`(score:number|null, subScores:Partial, hasData)、`CountySignal`、`SourceMeta`、`PressureData`、`RiskBundle` 跨 Task 一致；`SourceFetcher`/`SourceResult` 在 Task 5 定義、6–10 使用一致；`normalizeMetric`/`findCountyByName`/`calculateRiskScore` 重用既有簽章。MapView/ControlPanel/Drawer 的 `valueFor` 與 null 處理在 Task 4 統一。
