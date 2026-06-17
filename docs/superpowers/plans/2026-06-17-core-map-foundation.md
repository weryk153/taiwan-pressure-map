# 核心地圖地基 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建一個能跑通的台灣 22 縣市互動壓力地圖（指數先 mock）：choropleth 填色 + 3D 柱 + 左控制面板 + 縣市 drawer，全繁中。

**Architecture:** Vite SPA。純資料層（縣市清單、計分、mock、合併）與 UI 層（MapLibre 地圖、控制面板、drawer）分離。資料層以 `DataSourceAdapter` 介面設計，#1 只有 mock adapter，#2~#4 的真實 adapter 之後以相同介面插入。地圖以行政區代碼 `COUNTYCODE` join GeoJSON。

**Tech Stack:** Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui + MapLibre（react-map-gl/maplibre）+ TanStack Query + Recharts + i18next + Vitest，pnpm。

**Spec:** `docs/superpowers/specs/2026-06-17-core-map-foundation-design.md`

**Working dir:** `/Users/kurenpeng/Documents/kuren/taiwan-pressure-map`（已 git init，master 分支）。實作前先開分支 `feat/core-map-foundation`。

---

## File Structure

```
taiwan-pressure-map/
├── package.json, vite.config.ts, tsconfig.json, tsconfig.app.json, tsconfig.node.json
├── index.html, components.json (shadcn)
├── public/
│   └── taiwan-counties.json          # 縣市界 GeoJSON（Task 7 取得）
├── src/
│   ├── main.tsx, App.tsx, index.css
│   ├── lib/
│   │   ├── types.ts                  # County, MetricKey, CountySignal, CountyRisk, RiskLevel
│   │   ├── counties.ts               # 22 縣市清單 + 臺/台 正規化 + 查找
│   │   ├── score.ts                  # WEIGHTS, calculateRiskScore, toRiskLevel
│   │   ├── mock.ts                   # 決定性 PRNG + buildMockSignals
│   │   ├── buildRiskData.ts          # signals → CountyRisk[]
│   │   ├── colors.ts                 # score → 色階 + 等級標籤
│   │   └── i18n.ts                   # i18next zh-Hant
│   ├── locales/zh-Hant.json
│   ├── hooks/
│   │   └── useRiskData.ts            # TanStack Query
│   ├── components/
│   │   ├── MapView.tsx               # MapLibre choropleth + 3D 柱
│   │   ├── ControlPanel.tsx          # 指標切換 + 排行榜
│   │   ├── CountyDrawer.tsx          # 詳情 drawer
│   │   ├── Legend.tsx
│   │   └── ui/                       # shadcn 元件
│   └── test/setup.ts
└── docs/superpowers/...
```

---

### Task 1: 專案 scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/test/setup.ts`

- [ ] **Step 1: 用 Vite 建立 React+TS 專案骨架**

在專案根目錄執行（目錄已存在且有 git/docs，故用 `.` 並保留現有檔案）：

```bash
cd /Users/kurenpeng/Documents/kuren/taiwan-pressure-map
pnpm create vite@latest . --template react-ts
# 若提示目錄非空，選擇 "Ignore files and continue"
pnpm install
```

- [ ] **Step 2: 安裝相依套件**

```bash
pnpm add maplibre-gl react-map-gl @tanstack/react-query recharts i18next react-i18next
pnpm add -D tailwindcss @tailwindcss/vite vitest @testing-library/react @testing-library/jest-dom jsdom @types/node
```

- [ ] **Step 3: 設定 Tailwind v4 + path alias**

`vite.config.ts`：

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

`src/index.css`（取代預設內容）：

```css
@import "tailwindcss";

@theme {
  --color-bg: #0a0e14;
  --color-panel: #121821;
  --color-accent: #38bdf8;
}

html, body, #root { height: 100%; margin: 0; background: var(--color-bg); color: #e5e7eb; }
```

`src/test/setup.ts`：

```ts
import '@testing-library/jest-dom'
```

在 `tsconfig.app.json` 的 `compilerOptions` 加入：

```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

- [ ] **Step 4: 加 vitest script**

`package.json` 的 `scripts` 加入：`"test": "vitest run"`、`"test:watch": "vitest"`。

- [ ] **Step 5: 驗證骨架可建置**

Run: `pnpm build`
Expected: 建置成功，產生 `dist/`。

Run: `pnpm test`
Expected: "No test files found" 或 0 tests（尚未寫測試，正常）。

- [ ] **Step 6: Commit**

```bash
git checkout -b feat/core-map-foundation
git add -A
git commit -m "chore: vite + react + ts + tailwind v4 + vitest 骨架"
```

---

### Task 2: 型別 + 縣市清單 + 臺/台 正規化

**Files:**
- Create: `src/lib/types.ts`, `src/lib/counties.ts`, `src/lib/counties.test.ts`

- [ ] **Step 1: 定義型別**

`src/lib/types.ts`：

```ts
export type CountyCode = string

export interface County {
  code: CountyCode
  name: string // 繁中官方名（臺/台 正規化後）
}

export type MetricKey = 'economic' | 'housing' | 'demographic' | 'safety' | 'healthcare'

export const METRIC_KEYS: MetricKey[] = ['economic', 'housing', 'demographic', 'safety', 'healthcare']

export interface CountySignal {
  code: CountyCode
  metric: MetricKey
  value: number // 0–100
  confidence: number // 0–1
  asOf: string
  raw?: unknown
}

export interface CountyRisk {
  code: CountyCode
  name: string
  score: number // 0–100
  subScores: Record<MetricKey, number>
  confidence: number // 0–1
  asOf: string
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
```

- [ ] **Step 2: 寫失敗測試（縣市清單 + 正規化）**

`src/lib/counties.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { COUNTIES, normalizeCountyName, findCountyByName } from './counties'

describe('COUNTIES', () => {
  it('有 22 個縣市', () => {
    expect(COUNTIES).toHaveLength(22)
  })
  it('code 唯一', () => {
    const codes = new Set(COUNTIES.map((c) => c.code))
    expect(codes.size).toBe(22)
  })
  it('包含六都與離島', () => {
    const names = COUNTIES.map((c) => c.name)
    expect(names).toContain('臺北市')
    expect(names).toContain('高雄市')
    expect(names).toContain('連江縣')
    expect(names).toContain('金門縣')
  })
})

describe('normalizeCountyName', () => {
  it('台 → 臺', () => {
    expect(normalizeCountyName('台北市')).toBe('臺北市')
    expect(normalizeCountyName('台中市')).toBe('臺中市')
  })
  it('已是臺則不變', () => {
    expect(normalizeCountyName('臺南市')).toBe('臺南市')
  })
  it('無台字不受影響', () => {
    expect(normalizeCountyName('新北市')).toBe('新北市')
  })
})

describe('findCountyByName', () => {
  it('台/臺 皆對到同一 code', () => {
    expect(findCountyByName('台北市')?.code).toBe('63000')
    expect(findCountyByName('臺北市')?.code).toBe('63000')
  })
  it('找不到回 undefined', () => {
    expect(findCountyByName('火星市')).toBeUndefined()
  })
})
```

- [ ] **Step 3: 執行測試確認失敗**

Run: `pnpm test src/lib/counties.test.ts`
Expected: FAIL（counties.ts 不存在）。

- [ ] **Step 4: 實作 counties.ts**

`src/lib/counties.ts`：

```ts
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
```

> 註：`新竹市` 行政區代碼為 `10018`（spec 表格寫 10003 為筆誤，以本清單為準）。實作 Task 7 時若 GeoJSON 的 code 與此不符，以 GeoJSON 為準並回頭修正本清單，讓 join 測試通過。

- [ ] **Step 5: 執行測試確認通過**

Run: `pnpm test src/lib/counties.test.ts`
Expected: PASS（全部）。

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/counties.ts src/lib/counties.test.ts
git commit -m "feat: 縣市型別 + 22 縣市清單 + 臺/台 正規化"
```

---

### Task 3: 計分純函式

**Files:**
- Create: `src/lib/score.ts`, `src/lib/score.test.ts`

- [ ] **Step 1: 寫失敗測試**

`src/lib/score.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { WEIGHTS, calculateRiskScore, toRiskLevel } from './score'

describe('WEIGHTS', () => {
  it('權重和為 1', () => {
    const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 5)
  })
})

describe('calculateRiskScore', () => {
  it('全指標相同值 → 同值', () => {
    expect(calculateRiskScore({
      economic: 50, housing: 50, demographic: 50, safety: 50, healthcare: 50,
    })).toBe(50)
  })
  it('依權重加權', () => {
    // economic=100 其餘=0；權重 0.25 → 25
    expect(calculateRiskScore({
      economic: 100, housing: 0, demographic: 0, safety: 0, healthcare: 0,
    })).toBe(25)
  })
  it('缺值時重新分配權重（只算現有指標）', () => {
    // 只有 economic=80 → 應為 80（權重重正規化）
    expect(calculateRiskScore({ economic: 80 })).toBe(80)
  })
  it('全缺 → 0', () => {
    expect(calculateRiskScore({})).toBe(0)
  })
})

describe('toRiskLevel', () => {
  it('分級', () => {
    expect(toRiskLevel(10)).toBe('low')
    expect(toRiskLevel(40)).toBe('medium')
    expect(toRiskLevel(60)).toBe('high')
    expect(toRiskLevel(90)).toBe('critical')
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `pnpm test src/lib/score.test.ts`
Expected: FAIL（score.ts 不存在）。

- [ ] **Step 3: 實作 score.ts**

`src/lib/score.ts`：

```ts
import type { MetricKey, RiskLevel } from './types'

export const WEIGHTS: Record<MetricKey, number> = {
  economic: 0.25,
  housing: 0.20,
  demographic: 0.20,
  safety: 0.20,
  healthcare: 0.15,
}

/** 加權平均；缺值指標其權重會被排除（剩餘權重重正規化）。回 0–100 整數。 */
export function calculateRiskScore(subScores: Partial<Record<MetricKey, number>>): number {
  let weighted = 0
  let totalWeight = 0
  for (const key of Object.keys(WEIGHTS) as MetricKey[]) {
    const v = subScores[key]
    if (v == null || Number.isNaN(v)) continue
    weighted += v * WEIGHTS[key]
    totalWeight += WEIGHTS[key]
  }
  if (totalWeight === 0) return 0
  return Math.round(weighted / totalWeight)
}

export function toRiskLevel(score: number): RiskLevel {
  if (score < 25) return 'low'
  if (score < 50) return 'medium'
  if (score < 75) return 'high'
  return 'critical'
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `pnpm test src/lib/score.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/score.ts src/lib/score.test.ts
git commit -m "feat: 綜合壓力指數計分（加權+缺值重正規化）"
```

---

### Task 4: Mock 資料層

**Files:**
- Create: `src/lib/mock.ts`, `src/lib/buildRiskData.ts`, `src/lib/mock.test.ts`, `src/lib/buildRiskData.test.ts`

- [ ] **Step 1: 寫失敗測試（決定性 mock）**

`src/lib/mock.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { buildMockSignals } from './mock'
import { METRIC_KEYS } from './types'

describe('buildMockSignals', () => {
  it('每縣市每指標各一筆訊號', () => {
    const sigs = buildMockSignals('63000')
    expect(sigs).toHaveLength(METRIC_KEYS.length)
    expect(sigs.every((s) => s.code === '63000')).toBe(true)
  })
  it('決定性：同 code 兩次結果相同', () => {
    expect(buildMockSignals('64000')).toEqual(buildMockSignals('64000'))
  })
  it('不同 code 結果不同', () => {
    expect(buildMockSignals('63000')).not.toEqual(buildMockSignals('64000'))
  })
  it('value 在 0–100、confidence 在 0–1', () => {
    for (const s of buildMockSignals('10016')) {
      expect(s.value).toBeGreaterThanOrEqual(0)
      expect(s.value).toBeLessThanOrEqual(100)
      expect(s.confidence).toBeGreaterThanOrEqual(0)
      expect(s.confidence).toBeLessThanOrEqual(1)
    }
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `pnpm test src/lib/mock.test.ts`
Expected: FAIL。

- [ ] **Step 3: 實作 mock.ts**

`src/lib/mock.ts`：

```ts
import { METRIC_KEYS, type CountyCode, type CountySignal } from './types'

/** 字串雜湊 → 32-bit 種子 */
function hashSeed(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32 決定性 PRNG */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const AS_OF = '2026-06-01'

export function buildMockSignals(code: CountyCode): CountySignal[] {
  return METRIC_KEYS.map((metric) => {
    const rand = mulberry32(hashSeed(`${code}:${metric}`))
    const value = Math.round(rand() * 100)
    const confidence = Math.round((0.5 + rand() * 0.5) * 100) / 100 // 0.5–1.0
    return { code, metric, value, confidence, asOf: AS_OF }
  })
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `pnpm test src/lib/mock.test.ts`
Expected: PASS。

- [ ] **Step 5: 寫失敗測試（buildRiskData）**

`src/lib/buildRiskData.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { buildRiskData } from './buildRiskData'
import { COUNTIES } from './counties'

describe('buildRiskData', () => {
  const risks = buildRiskData()
  it('涵蓋全部 22 縣市', () => {
    expect(risks).toHaveLength(COUNTIES.length)
  })
  it('每縣市有名稱、score、5 個 subScores、confidence', () => {
    const taipei = risks.find((r) => r.code === '63000')!
    expect(taipei.name).toBe('臺北市')
    expect(taipei.score).toBeGreaterThanOrEqual(0)
    expect(taipei.score).toBeLessThanOrEqual(100)
    expect(Object.keys(taipei.subScores)).toHaveLength(5)
    expect(taipei.confidence).toBeGreaterThan(0)
  })
  it('決定性', () => {
    expect(buildRiskData()).toEqual(risks)
  })
})
```

- [ ] **Step 6: 執行測試確認失敗**

Run: `pnpm test src/lib/buildRiskData.test.ts`
Expected: FAIL。

- [ ] **Step 7: 實作 buildRiskData.ts**

`src/lib/buildRiskData.ts`：

```ts
import { COUNTIES } from './counties'
import { buildMockSignals } from './mock'
import { calculateRiskScore } from './score'
import {
  METRIC_KEYS,
  type CountyRisk,
  type CountySignal,
  type MetricKey,
} from './types'

/**
 * 由訊號組出每縣市的 CountyRisk。
 * #1：realSignals 省略 → 全用 mock。#2~#4：傳入真實訊號覆蓋對應 (code, metric)，
 * 同一格多來源時取較大值（MAX），與全球版一致。
 */
export function buildRiskData(realSignals: CountySignal[] = []): CountyRisk[] {
  return COUNTIES.map((county) => {
    const byMetric = new Map<MetricKey, CountySignal>()
    for (const s of buildMockSignals(county.code)) byMetric.set(s.metric, s)
    for (const s of realSignals) {
      if (s.code !== county.code) continue
      const existing = byMetric.get(s.metric)
      if (!existing || s.value > existing.value) byMetric.set(s.metric, s)
    }

    const subScores = {} as Record<MetricKey, number>
    let confSum = 0
    for (const k of METRIC_KEYS) {
      const sig = byMetric.get(k)!
      subScores[k] = sig.value
      confSum += sig.confidence
    }
    const score = calculateRiskScore(subScores)
    const confidence = Math.round((confSum / METRIC_KEYS.length) * 100) / 100
    const asOf = byMetric.get('economic')!.asOf

    return { code: county.code, name: county.name, score, subScores, confidence, asOf }
  })
}
```

- [ ] **Step 8: 執行測試確認通過**

Run: `pnpm test src/lib/buildRiskData.test.ts`
Expected: PASS。

- [ ] **Step 9: Commit**

```bash
git add src/lib/mock.ts src/lib/buildRiskData.ts src/lib/mock.test.ts src/lib/buildRiskData.test.ts
git commit -m "feat: 決定性 mock 訊號 + buildRiskData 合併（MAX override）"
```

---

### Task 5: 色階與等級標籤

**Files:**
- Create: `src/lib/colors.ts`, `src/lib/colors.test.ts`

- [ ] **Step 1: 寫失敗測試**

`src/lib/colors.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { scoreColor, LEVEL_LABEL } from './colors'

describe('scoreColor', () => {
  it('回傳 hex 顏色字串', () => {
    expect(scoreColor(10)).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(scoreColor(90)).toMatch(/^#[0-9a-fA-F]{6}$/)
  })
  it('低分與高分顏色不同', () => {
    expect(scoreColor(10)).not.toBe(scoreColor(90))
  })
})

describe('LEVEL_LABEL', () => {
  it('四級皆有繁中標籤', () => {
    expect(LEVEL_LABEL.low).toBe('低')
    expect(LEVEL_LABEL.critical).toBe('危急')
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `pnpm test src/lib/colors.test.ts`
Expected: FAIL。

- [ ] **Step 3: 實作 colors.ts**

`src/lib/colors.ts`：

```ts
import type { RiskLevel } from './types'

/** 低→危急 的色階（深藍綠 → 黃 → 橙 → 紅） */
const STOPS: { at: number; color: string }[] = [
  { at: 0, color: '#1e3a5f' },
  { at: 25, color: '#3b9c8f' },
  { at: 50, color: '#e0c341' },
  { at: 75, color: '#e07b39' },
  { at: 100, color: '#d6334c' },
]

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t)
}
function hexToRgb(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}

export function scoreColor(score: number): string {
  const s = Math.max(0, Math.min(100, score))
  let lo = STOPS[0], hi = STOPS[STOPS.length - 1]
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (s >= STOPS[i].at && s <= STOPS[i + 1].at) { lo = STOPS[i]; hi = STOPS[i + 1]; break }
  }
  const t = hi.at === lo.at ? 0 : (s - lo.at) / (hi.at - lo.at)
  const [r1, g1, b1] = hexToRgb(lo.color)
  const [r2, g2, b2] = hexToRgb(hi.color)
  return rgbToHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t))
}

export const LEVEL_LABEL: Record<RiskLevel, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '危急',
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `pnpm test src/lib/colors.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/colors.ts src/lib/colors.test.ts
git commit -m "feat: 分數色階 + 等級繁中標籤"
```

---

### Task 6: i18n（zh-Hant 單語系）

**Files:**
- Create: `src/lib/i18n.ts`, `src/locales/zh-Hant.json`
- Modify: `src/main.tsx`

- [ ] **Step 1: 建立 locale 檔**

`src/locales/zh-Hant.json`：

```json
{
  "app": {
    "title": "台灣縣市壓力地圖",
    "subtitle": "各縣市綜合壓力指數（示範資料）"
  },
  "metrics": {
    "composite": "綜合",
    "economic": "經濟壓力",
    "housing": "居住壓力",
    "demographic": "人口壓力",
    "safety": "治安",
    "healthcare": "醫療資源"
  },
  "panel": {
    "colorBy": "著色維度",
    "ranking": "縣市排行榜"
  },
  "drawer": {
    "score": "壓力指數",
    "subScores": "子指標",
    "trend": "趨勢",
    "events": "事件",
    "confidence": "資料信心",
    "asOf": "資料時間",
    "noEvents": "目前無事件資料"
  },
  "legend": {
    "title": "壓力等級"
  },
  "level": { "low": "低", "medium": "中", "high": "高", "critical": "危急" },
  "state": { "loading": "載入中…", "error": "載入失敗", "empty": "無資料" }
}
```

- [ ] **Step 2: 設定 i18next**

`src/lib/i18n.ts`：

```ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhHant from '@/locales/zh-Hant.json'

i18n.use(initReactI18next).init({
  resources: { 'zh-Hant': { translation: zhHant } },
  lng: 'zh-Hant',
  fallbackLng: 'zh-Hant',
  interpolation: { escapeValue: false },
})

export default i18n
```

- [ ] **Step 3: 在 main.tsx 載入 i18n**

`src/main.tsx` 在最上方 import 加：`import '@/lib/i18n'`（在 import App 之前）。

- [ ] **Step 4: 驗證建置**

Run: `pnpm build`
Expected: 建置成功（json import 正常）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n.ts src/locales/zh-Hant.json src/main.tsx
git commit -m "feat: i18next zh-Hant 單語系"
```

---

### Task 7: 取得縣市界 GeoJSON + join 驗證

**Files:**
- Create: `public/taiwan-counties.json`, `src/lib/geojson.test.ts`

- [ ] **Step 1: 取得縣市界 GeoJSON**

下載一份**縣市級**（非鄉鎮）台灣 GeoJSON 到 `public/taiwan-counties.json`。候選來源（依序嘗試，取得後檢查 properties 欄位）：

```bash
cd /Users/kurenpeng/Documents/kuren/taiwan-pressure-map
# 候選 1：g0v twgeojson（縣市界）
curl -sL -o public/taiwan-counties.json \
  "https://raw.githubusercontent.com/g0v/twgeojson/master/json/twCounty2010.geo.json"
# 檢查是否為合法 GeoJSON FeatureCollection
node -e "const g=require('./public/taiwan-counties.json'); console.log(g.type, (g.features||[]).length, JSON.stringify(g.features?.[0]?.properties))"
```

若候選 1 失效或非縣市界，改用內政部「直轄市縣市界線」開放資料（政府資料開放平臺 dataset，SHP→GeoJSON 用 mapshaper `mapshaper in.shp -o format=geojson`），或其他可得的縣市界 GeoJSON。**目標：22 個 feature、每個有可辨識的縣市代碼與名稱欄位。**

- [ ] **Step 2: 確認 properties 欄位名並正規化為 COUNTYCODE/COUNTYNAME**

檢查上一步印出的 `properties`，找出代碼欄（可能叫 `COUNTYCODE`/`COUNTYID`/`C_Name` 等）與名稱欄。寫一次性腳本把每個 feature 的 properties 正規化成統一鍵 `COUNTYCODE`（字串）與 `COUNTYNAME`（繁中、經 `台→臺`），並對齊 `src/lib/counties.ts` 的 code：

```bash
node -e '
const fs=require("fs");
const g=JSON.parse(fs.readFileSync("public/taiwan-counties.json","utf8"));
const norm=(s)=>String(s).replace(/台/g,"臺");
for(const f of g.features){
  const p=f.properties||{};
  // ↓ 依實際欄位名調整這兩行
  const code=String(p.COUNTYCODE ?? p.COUNTYID ?? p.code ?? "").trim();
  const name=norm(p.COUNTYNAME ?? p.C_Name ?? p.name ?? "");
  f.properties={ COUNTYCODE: code, COUNTYNAME: name };
}
fs.writeFileSync("public/taiwan-counties.json", JSON.stringify(g));
console.log("normalized", g.features.length);
'
```

> 若 GeoJSON 的 code 與 `counties.ts` 不一致（例如新竹市），以 GeoJSON 的 code 為準回頭修正 `counties.ts`，讓下方 join 測試通過。離島若含南海島礁（非縣市）則從 features 移除。

- [ ] **Step 3: 寫 join 驗證測試**

`src/lib/geojson.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { COUNTIES, normalizeCountyName } from './counties'

const geo = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../public/taiwan-counties.json'), 'utf8'),
)

describe('taiwan-counties.json', () => {
  it('是 FeatureCollection', () => {
    expect(geo.type).toBe('FeatureCollection')
  })
  it('有 22 個 feature', () => {
    expect(geo.features).toHaveLength(22)
  })
  it('每個 feature 有非空 COUNTYCODE 且能對到縣市清單', () => {
    const codes = new Set(COUNTIES.map((c) => c.code))
    for (const f of geo.features) {
      const code = f.properties?.COUNTYCODE
      expect(code, JSON.stringify(f.properties)).toBeTruthy()
      expect(codes.has(code), `未知 code: ${code}`).toBe(true)
    }
  })
  it('每個縣市清單項目都對得到一個 feature', () => {
    const geoCodes = new Set(geo.features.map((f: any) => f.properties.COUNTYCODE))
    for (const c of COUNTIES) {
      expect(geoCodes.has(c.code), `GeoJSON 缺 ${c.name}`).toBe(true)
    }
  })
  it('COUNTYNAME 已正規化（無「台」字）', () => {
    for (const f of geo.features) {
      expect(f.properties.COUNTYNAME).toBe(normalizeCountyName(f.properties.COUNTYNAME))
    }
  })
})
```

- [ ] **Step 4: 執行測試直到通過**

Run: `pnpm test src/lib/geojson.test.ts`
Expected: PASS。若失敗，依錯誤訊息回 Step 2 調整欄位對映或 `counties.ts` 的 code。

- [ ] **Step 5: Commit**

```bash
git add public/taiwan-counties.json src/lib/geojson.test.ts src/lib/counties.ts
git commit -m "feat: 縣市界 GeoJSON（正規化 COUNTYCODE/COUNTYNAME）+ join 驗證"
```

---

### Task 8: useRiskData hook + Query Provider

**Files:**
- Create: `src/hooks/useRiskData.ts`
- Modify: `src/main.tsx`

- [ ] **Step 1: 實作 hook**

`src/hooks/useRiskData.ts`：

```ts
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
```

- [ ] **Step 2: 包 QueryClientProvider**

`src/main.tsx`：在 render 外層包：

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
const queryClient = new QueryClient()
// ...
// <QueryClientProvider client={queryClient}><App /></QueryClientProvider>
```

完整 `src/main.tsx`：

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@/lib/i18n'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
```

- [ ] **Step 3: 驗證建置**

Run: `pnpm build`
Expected: 成功。

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useRiskData.ts src/main.tsx
git commit -m "feat: useRiskData hook + TanStack Query provider"
```

---

### Task 9: MapView（choropleth + 3D 柱）

**Files:**
- Create: `src/components/MapView.tsx`, `src/lib/centroids.ts`

- [ ] **Step 1: centroid 工具（縣市重心，用於放柱）**

`src/lib/centroids.ts`：

```ts
import type { CountyCode } from './types'

type FC = { features: { properties: { COUNTYCODE: string }; geometry: any }[] }

/** 多邊形頂點平均當近似重心（免額外套件；夠用於放柱位置）。 */
export function computeCentroids(geo: FC): Record<CountyCode, [number, number]> {
  const out: Record<string, [number, number]> = {}
  for (const f of geo.features) {
    let sx = 0, sy = 0, n = 0
    const polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates]
    for (const poly of polys) {
      for (const [x, y] of poly[0]) { sx += x; sy += y; n++ }
    }
    if (n) out[f.properties.COUNTYCODE] = [sx / n, sy / n]
  }
  return out
}
```

- [ ] **Step 2: 實作 MapView**

`src/components/MapView.tsx`：

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import MapGL, { Source, Layer, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import bbox from '@turf/bbox'
import { scoreColor } from '@/lib/colors'
import { computeCentroids } from '@/lib/centroids'
import type { CountyRisk, MetricKey } from '@/lib/types'

type ColorBy = 'composite' | MetricKey

function valueFor(r: CountyRisk, colorBy: ColorBy): number {
  return colorBy === 'composite' ? r.score : r.subScores[colorBy]
}

// 圓柱底面多邊形（給 fill-extrusion）
function circlePolygon(lng: number, lat: number, radiusKm: number, seg = 48): number[][] {
  const coords: number[][] = []
  const dLat = radiusKm / 110.574
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * 2 * Math.PI
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)])
  }
  return coords
}

const STYLE = {
  version: 8 as const,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'bg', type: 'background' as const, paint: { 'background-color': '#0a0e14' } }],
}

interface Props {
  risks: CountyRisk[]
  colorBy: ColorBy
  selectedCode: string | null
  onSelect: (code: string) => void
}

export function MapView({ risks, colorBy, selectedCode, onSelect }: Props) {
  const mapRef = useRef<MapRef>(null)
  const [geo, setGeo] = useState<any>(null)

  useEffect(() => {
    fetch('/taiwan-counties.json').then((r) => r.json()).then(setGeo)
  }, [])

  const byCode = useMemo(() => new Map(risks.map((r) => [r.code, r])), [risks])

  // 填色 GeoJSON：把 score/color 寫進 properties
  const fillGeo = useMemo(() => {
    if (!geo) return null
    return {
      ...geo,
      features: geo.features.map((f: any) => {
        const r = byCode.get(f.properties.COUNTYCODE)
        const v = r ? valueFor(r, colorBy) : 0
        return { ...f, properties: { ...f.properties, _v: v, _color: scoreColor(v) } }
      }),
    }
  }, [geo, byCode, colorBy])

  // 3D 柱 GeoJSON
  const barGeo = useMemo(() => {
    if (!geo) return null
    const centroids = computeCentroids(geo)
    return {
      type: 'FeatureCollection',
      features: risks.flatMap((r) => {
        const c = centroids[r.code]
        if (!c) return []
        const v = valueFor(r, colorBy)
        const radius = 4 + r.confidence * 6 // km
        return [{
          type: 'Feature',
          properties: { _height: v * 600, _color: scoreColor(v) }, // 公尺
          geometry: { type: 'Polygon', coordinates: [circlePolygon(c[0], c[1], radius)] },
        }]
      }),
    }
  }, [geo, risks, colorBy])

  // 首次載入 fit-bounds（含離島）
  useEffect(() => {
    if (!geo || !mapRef.current) return
    const [minX, minY, maxX, maxY] = bbox(geo)
    mapRef.current.fitBounds([[minX, minY], [maxX, maxY]], { padding: 40, duration: 0 })
  }, [geo])

  return (
    <MapGL
      ref={mapRef}
      mapStyle={STYLE as any}
      initialViewState={{ longitude: 120.9, latitude: 23.8, zoom: 6, pitch: 45 }}
      interactiveLayerIds={['county-fill']}
      onClick={(e) => {
        const f = e.features?.[0]
        if (f) onSelect(f.properties!.COUNTYCODE)
      }}
      style={{ width: '100%', height: '100%' }}
    >
      {fillGeo && (
        <Source id="counties" type="geojson" data={fillGeo}>
          <Layer
            id="county-fill"
            type="fill"
            paint={{ 'fill-color': ['get', '_color'], 'fill-opacity': 0.55 }}
          />
          <Layer
            id="county-line"
            type="line"
            paint={{
              'line-color': ['case', ['==', ['get', 'COUNTYCODE'], selectedCode ?? ''], '#ffffff', '#2b3banchor'.slice(0, 7)],
              'line-width': ['case', ['==', ['get', 'COUNTYCODE'], selectedCode ?? ''], 2.5, 0.6],
            }}
          />
        </Source>
      )}
      {barGeo && (
        <Source id="bars" type="geojson" data={barGeo}>
          <Layer
            id="county-bars"
            type="fill-extrusion"
            paint={{
              'fill-extrusion-color': ['get', '_color'],
              'fill-extrusion-height': ['get', '_height'],
              'fill-extrusion-opacity': 0.85,
            }}
          />
        </Source>
      )}
    </MapGL>
  )
}
```

> 註：`@turf/bbox` 需安裝：`pnpm add @turf/bbox`。`line-color` 未選取色請用 `#2b3b4d`（上方 slice 只是避免佔位字串，實作時直接寫 `'#2b3b4d'`）。

- [ ] **Step 3: 安裝 turf bbox**

```bash
pnpm add @turf/bbox
```

- [ ] **Step 4: 修正 line-color 佔位**

把 `county-line` 的 `line-color` 改為：

```ts
'line-color': ['case', ['==', ['get', 'COUNTYCODE'], selectedCode ?? ''], '#ffffff', '#2b3b4d'],
```

- [ ] **Step 5: 驗證建置**

Run: `pnpm build`
Expected: 成功（型別無誤）。

- [ ] **Step 6: Commit**

```bash
git add src/components/MapView.tsx src/lib/centroids.ts package.json
git commit -m "feat: MapView choropleth + 3D 柱 + fit-bounds 含離島"
```

---

### Task 10: ControlPanel（指標切換 + 排行榜）

**Files:**
- Create: `src/components/ControlPanel.tsx`

- [ ] **Step 1: 實作 ControlPanel**

`src/components/ControlPanel.tsx`：

```tsx
import { useTranslation } from 'react-i18next'
import { scoreColor } from '@/lib/colors'
import { METRIC_KEYS, type CountyRisk, type MetricKey } from '@/lib/types'

type ColorBy = 'composite' | MetricKey

interface Props {
  risks: CountyRisk[]
  colorBy: ColorBy
  onColorBy: (c: ColorBy) => void
  selectedCode: string | null
  onSelect: (code: string) => void
}

export function ControlPanel({ risks, colorBy, onColorBy, selectedCode, onSelect }: Props) {
  const { t } = useTranslation()
  const options: ColorBy[] = ['composite', ...METRIC_KEYS]
  const valueFor = (r: CountyRisk) => (colorBy === 'composite' ? r.score : r.subScores[colorBy])
  const ranked = [...risks].sort((a, b) => valueFor(b) - valueFor(a))

  return (
    <aside className="w-72 shrink-0 h-full overflow-y-auto bg-[var(--color-panel)] border-r border-white/10 p-4 flex flex-col gap-4">
      <div>
        <h2 className="text-xs uppercase tracking-wide text-white/50 mb-2">{t('panel.colorBy')}</h2>
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => (
            <button
              key={o}
              onClick={() => onColorBy(o)}
              className={`px-2.5 py-1 rounded text-sm transition ${
                colorBy === o ? 'bg-[var(--color-accent)] text-black' : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              {t(`metrics.${o}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1">
        <h2 className="text-xs uppercase tracking-wide text-white/50 mb-2">{t('panel.ranking')}</h2>
        <ol className="flex flex-col gap-1">
          {ranked.map((r, i) => (
            <li key={r.code}>
              <button
                onClick={() => onSelect(r.code)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition ${
                  selectedCode === r.code ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <span className="w-5 text-white/40 tabular-nums">{i + 1}</span>
                <span className="flex-1">{r.name}</span>
                <span
                  className="w-9 text-right tabular-nums font-medium"
                  style={{ color: scoreColor(valueFor(r)) }}
                >
                  {valueFor(r)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: 驗證建置**

Run: `pnpm build`
Expected: 成功。

- [ ] **Step 3: Commit**

```bash
git add src/components/ControlPanel.tsx
git commit -m "feat: 控制面板（著色維度切換 + 22 縣市排行榜）"
```

---

### Task 11: CountyDrawer（詳情）

**Files:**
- Create: `src/components/CountyDrawer.tsx`

- [ ] **Step 1: 實作 CountyDrawer**

`src/components/CountyDrawer.tsx`：

```tsx
import { useTranslation } from 'react-i18next'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from 'recharts'
import { scoreColor, LEVEL_LABEL } from '@/lib/colors'
import { toRiskLevel } from '@/lib/score'
import { METRIC_KEYS, type CountyRisk } from '@/lib/types'

interface Props {
  risk: CountyRisk | null
  onClose: () => void
}

export function CountyDrawer({ risk, onClose }: Props) {
  const { t } = useTranslation()
  if (!risk) return null

  const level = toRiskLevel(risk.score)
  const radarData = METRIC_KEYS.map((k) => ({
    metric: t(`metrics.${k}`),
    value: risk.subScores[k],
  }))

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-[var(--color-panel)] border-l border-white/10 p-5 overflow-y-auto shadow-2xl">
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-xl font-semibold">{risk.name}</h2>
        <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none">✕</button>
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-4xl font-bold tabular-nums" style={{ color: scoreColor(risk.score) }}>
          {risk.score}
        </span>
        <span className="text-sm text-white/60">{t('drawer.score')} · {LEVEL_LABEL[level]}</span>
      </div>
      <p className="text-xs text-white/40 mb-5">
        {t('drawer.confidence')}: {Math.round(risk.confidence * 100)}% · {t('drawer.asOf')}: {risk.asOf}
      </p>

      <h3 className="text-xs uppercase tracking-wide text-white/50 mb-1">{t('drawer.subScores')}</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} outerRadius="70%">
            <PolarGrid stroke="#ffffff20" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: '#ffffff99', fontSize: 11 }} />
            <Radar dataKey="value" stroke="var(--color-accent)" fill="var(--color-accent)" fillOpacity={0.4} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <h3 className="text-xs uppercase tracking-wide text-white/50 mb-1 mt-4">{t('drawer.events')}</h3>
      <p className="text-sm text-white/40">{t('drawer.noEvents')}</p>
    </div>
  )
}
```

- [ ] **Step 2: 驗證建置**

Run: `pnpm build`
Expected: 成功。

- [ ] **Step 3: Commit**

```bash
git add src/components/CountyDrawer.tsx
git commit -m "feat: 縣市詳情 drawer（總分/等級/子分數雷達/事件空狀態）"
```

---

### Task 12: Legend + App 組裝

**Files:**
- Create: `src/components/Legend.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 實作 Legend**

`src/components/Legend.tsx`：

```tsx
import { useTranslation } from 'react-i18next'
import { scoreColor } from '@/lib/colors'

export function Legend() {
  const { t } = useTranslation()
  const stops = [0, 25, 50, 75, 100]
  return (
    <div className="absolute bottom-4 left-80 ml-4 bg-[var(--color-panel)]/90 border border-white/10 rounded-lg p-3">
      <div className="text-xs text-white/60 mb-1.5">{t('legend.title')}</div>
      <div className="flex items-center gap-0.5">
        {stops.map((s) => (
          <div key={s} className="flex flex-col items-center">
            <div className="w-8 h-3" style={{ background: scoreColor(s) }} />
            <span className="text-[10px] text-white/40 mt-0.5">{s}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 組裝 App**

`src/App.tsx`：

```tsx
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapView } from '@/components/MapView'
import { ControlPanel } from '@/components/ControlPanel'
import { CountyDrawer } from '@/components/CountyDrawer'
import { Legend } from '@/components/Legend'
import { useRiskData } from '@/hooks/useRiskData'
import type { MetricKey } from '@/lib/types'

type ColorBy = 'composite' | MetricKey

export default function App() {
  const { t } = useTranslation()
  const { data: risks, isLoading, isError } = useRiskData()
  const [colorBy, setColorBy] = useState<ColorBy>('composite')
  const [selectedCode, setSelectedCode] = useState<string | null>(null)

  const selected = useMemo(
    () => risks?.find((r) => r.code === selectedCode) ?? null,
    [risks, selectedCode],
  )

  return (
    <div className="h-full flex flex-col">
      <header className="px-5 py-3 border-b border-white/10 bg-[var(--color-panel)]">
        <h1 className="text-lg font-semibold">{t('app.title')}</h1>
        <p className="text-xs text-white/50">{t('app.subtitle')}</p>
      </header>

      <div className="flex-1 flex relative overflow-hidden">
        {isLoading && <div className="m-auto text-white/50">{t('state.loading')}</div>}
        {isError && <div className="m-auto text-red-400">{t('state.error')}</div>}
        {risks && (
          <>
            <ControlPanel
              risks={risks}
              colorBy={colorBy}
              onColorBy={setColorBy}
              selectedCode={selectedCode}
              onSelect={setSelectedCode}
            />
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

- [ ] **Step 3: 驗證建置 + 全測試**

Run: `pnpm build && pnpm test`
Expected: 建置成功；所有測試 PASS。

- [ ] **Step 4: Commit**

```bash
git add src/components/Legend.tsx src/App.tsx
git commit -m "feat: Legend + App 組裝（地圖/面板/drawer/狀態）"
```

---

### Task 13: 視覺驗證與收尾

**Files:** 無新檔（必要時微調）

- [ ] **Step 1: 起 dev server 人工驗證**

```bash
pnpm dev
```

開瀏覽器確認：(1) 台灣 22 縣市都顯示且含金門/馬祖/澎湖；(2) choropleth 有色階；(3) 3D 柱站在各縣市上、高度/粗細有別；(4) 點縣市開 drawer、雷達圖正常；(5) 切換著色維度地圖與排行榜跟著變；(6) 全繁中無亂碼。

- [ ] **Step 2: 修正視覺問題**

依觀察微調（柱高係數 `v * 600`、半徑 `4 + confidence*6`、`fill-opacity`、padding）。每次調整後 `pnpm build` 確認無誤。

- [ ] **Step 3: 最終 commit**

```bash
git add -A
git commit -m "polish: 地圖視覺微調（柱高/半徑/透明度）"
```

---

## Self-Review

**1. Spec coverage:**
- 22 縣市清單 → Task 2 ✓；GeoJSON join → Task 7 ✓；臺/台 正規化 → Task 2 ✓
- 資料模型（County/MetricKey/CountySignal/CountyRisk）→ Task 2 ✓
- 計分 + 權重 + 缺值重分配 → Task 3 ✓
- 決定性 mock + buildRiskData MAX 合併 → Task 4 ✓
- 色階 + 等級 → Task 5 ✓
- choropleth + 3D 柱 + centroid + fit-bounds 含離島 + 點選 → Task 9 ✓
- 控制面板（維度切換 + 排行榜全列）→ Task 10 ✓
- drawer（總分/等級/子分數/事件空狀態/信心/時間）→ Task 11 ✓
- 趨勢：spec 說 #1 可 mock；本計畫 drawer 先省略趨勢圖（僅子分數雷達 + 事件空狀態），符合 YAGNI；趨勢留待 #2 真資料時加。已是有意縮減，非遺漏。
- i18n zh-Hant 單語系 → Task 6 ✓
- Legend + 狀態 → Task 12 ✓
- 測試（計分/正規化/mock 決定性/清單完整/GeoJSON join）→ Task 2,3,4,5,7 ✓

**2. Placeholder scan:** 無 TBD/TODO。Task 7 的 GeoJSON 來源為「依序嘗試 + 欄位探查」是真實外部相依的正當作法，已給具體指令與驗證測試把關。Task 9 的 line-color 佔位已在 Step 4 明確修正。

**3. Type consistency:** `CountyRisk`/`CountySignal`/`MetricKey`/`ColorBy('composite'|MetricKey)` 跨 Task 一致；`COUNTYCODE`/`COUNTYNAME` 為 GeoJSON 統一鍵跨 Task 7/9 一致；`valueFor`（composite→score，否則 subScores[k]）在 MapView/ControlPanel 定義一致。
