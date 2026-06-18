# 即時災害（CWA + NCDR）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在壓力地圖上疊一層即時災害事件（CWA 地震、CWA 天氣特報、NCDR 災防告警），透過本地 Supabase Edge Function 薄 proxy 藏 CWA key。

**Architecture:** Edge Function `disasters` 是**薄 proxy**：fetch 三來源（CWA 需 key、NCDR 公開）、加 CORS、短 TTL 快取、回傳**原始合併 JSON** `{ eq, weather, cap, fetchedAt, sources }`。**解析成 `DisasterEvent[]` 在前端**（`src/lib/disasters/parse.ts`，Vitest 測、重用 `findCountyByName`）。災害是純 overlay，不進壓力分數；後端不可用時前端 graceful（事件為空、壓力地圖照常）。

**Tech Stack:** Supabase（本地，OrbStack）+ Deno Edge Function、Vite + React + TS、TanStack Query、MapLibre、Vitest。

**Spec:** `docs/superpowers/specs/2026-06-18-realtime-disasters-design.md`

**Branch:** `feat/realtime-disasters`（off master）。

**前置（Phase B 才需要）:** 使用者啟動 OrbStack、至 opendata.cwa.gov.tw 免費註冊取得授權碼。Phase A 不需要後端。

---

## File Structure

```
src/lib/disasters/
  types.ts            # DisasterEvent, DisasterType, Severity, DisasterResponse(raw)
  parse.ts            # parseEarthquakes / parseWeatherAlerts / parseCapAlerts / parseDisasters
  parse.test.ts       # Vitest，用 fixtures
  fixtures/           # eq.json / weather.json / cap.json（真實/文件樣本）
  group.ts            # eventsByCounty(events) → Record<code, DisasterEvent[]>；activeAlerts 排序
  group.test.ts
src/hooks/useDisasterEvents.ts   # TanStack Query，graceful
src/components/
  MapView.tsx         # 改：地震點標記 + 受影響縣市描邊 + 事件層
  CountyDrawer.tsx    # 改：事件區換成真實事件清單
  AlertsList.tsx      # 新增：控制面板底「目前警示」清單
  App.tsx             # 改：事件層 toggle、傳 events、AlertsList
src/locales/zh-Hant.json         # 加字串
supabase/
  config.toml         # supabase init 產生
  functions/disasters/index.ts   # 薄 proxy（Deno）
  functions/.env.example         # CWA_KEY 範本（committed）
  functions/.env                 # gitignored（使用者填）
.env.local 或 vite env           # VITE_DISASTERS_URL 預設本地
```

---

## 階段 A — 前端事件層（不需後端，graceful）

### Task 1: 事件型別 + 解析（fixtures + Vitest）

**Files:** Create `src/lib/disasters/types.ts`, `src/lib/disasters/parse.ts`, `src/lib/disasters/parse.test.ts`, `src/lib/disasters/fixtures/{eq,weather,cap}.json`

- [ ] **Step 1: 型別**

`src/lib/disasters/types.ts`：
```ts
export type DisasterType = 'earthquake' | 'weather' | 'alert'
export type Severity = 'info' | 'warning' | 'severe'

export interface DisasterEvent {
  id: string
  type: DisasterType
  title: string
  severity: Severity
  countyCodes: string[]
  time: string            // ISO
  source: 'CWA' | 'NCDR'
  lat?: number
  lon?: number
  magnitude?: number
  raw?: unknown
}

/** Edge Function 薄 proxy 回傳的原始合併結構 */
export interface DisasterResponse {
  eq: unknown | null        // CWA E-A0015-001 原始 JSON
  weather: unknown | null   // CWA W-C0033-001 原始 JSON
  cap: unknown | null       // NCDR 告警原始 JSON
  fetchedAt: string
  sources: { eq: 'ok' | 'error'; weather: 'ok' | 'error'; cap: 'ok' | 'error' }
}
```

- [ ] **Step 2: 建立 fixtures（文件樣本，Phase B 以真實回應校正）**

`src/lib/disasters/fixtures/eq.json`（CWA 顯著有感地震 E-A0015-001 結構縮樣）：
```json
{
  "records": {
    "Earthquake": [
      {
        "EarthquakeNo": 114001,
        "EarthquakeInfo": {
          "OriginTime": "2026-06-18 03:12:00",
          "FocalDepth": 18.2,
          "Epicenter": { "Location": "花蓮縣政府南南西方", "EpicenterLatitude": 23.7, "EpicenterLongitude": 121.4 },
          "EarthquakeMagnitude": { "MagnitudeType": "ML", "MagnitudeValue": 5.4 }
        },
        "Intensity": {
          "ShakingArea": [
            { "CountyName": "花蓮縣", "AreaIntensity": "5弱" },
            { "CountyName": "臺東縣", "AreaIntensity": "4級" },
            { "CountyName": "南投縣", "AreaIntensity": "3級" }
          ]
        }
      }
    ]
  }
}
```

`src/lib/disasters/fixtures/weather.json`（CWA 天氣特報 W-C0033-001 結構縮樣）：
```json
{
  "records": {
    "location": [
      {
        "locationName": "宜蘭縣",
        "hazardConditions": { "hazards": [
          { "info": { "phenomena": "豪雨", "significance": "" }, "validTime": { "startTime": "2026-06-18 02:00:00", "endTime": "2026-06-18 18:00:00" } }
        ] }
      },
      {
        "locationName": "臺北市",
        "hazardConditions": { "hazards": [
          { "info": { "phenomena": "大雨", "significance": "" }, "validTime": { "startTime": "2026-06-18 02:00:00", "endTime": "2026-06-18 18:00:00" } }
        ] }
      }
    ]
  }
}
```

`src/lib/disasters/fixtures/cap.json`（NCDR 災防告警 縮樣；Phase B 以真實格式校正）：
```json
{
  "alerts": [
    { "id": "ncdr-1", "event": "土石流紅色警戒", "severity": "Severe", "areas": ["南投縣"], "sent": "2026-06-18T01:30:00+08:00", "expires": "2026-06-18T23:59:00+08:00" },
    { "id": "ncdr-2", "event": "淹水二級", "severity": "Moderate", "areas": ["屏東縣"], "sent": "2026-06-18T02:00:00+08:00", "expires": "2026-06-18T20:00:00+08:00" }
  ]
}
```

- [ ] **Step 3: 失敗測試**

`src/lib/disasters/parse.test.ts`：
```ts
import { describe, it, expect } from 'vitest'
import eq from './fixtures/eq.json'
import weather from './fixtures/weather.json'
import cap from './fixtures/cap.json'
import { parseEarthquakes, parseWeatherAlerts, parseCapAlerts } from './parse'

describe('parseEarthquakes', () => {
  const events = parseEarthquakes(eq)
  it('一個地震事件', () => expect(events).toHaveLength(1))
  it('規模、震央、來源', () => {
    const e = events[0]
    expect(e.type).toBe('earthquake')
    expect(e.magnitude).toBe(5.4)
    expect(e.lat).toBe(23.7)
    expect(e.lon).toBe(121.4)
    expect(e.source).toBe('CWA')
  })
  it('受影響縣市對到 code（花蓮/臺東/南投）', () => {
    expect(events[0].countyCodes).toEqual(expect.arrayContaining(['10015', '10014', '10009']))
  })
  it('規模 5.4 + 震度 5弱 → severe', () => {
    expect(events[0].severity).toBe('severe')
  })
})

describe('parseWeatherAlerts', () => {
  const events = parseWeatherAlerts(weather)
  it('兩個縣市特報', () => expect(events).toHaveLength(2))
  it('宜蘭豪雨 → warning、對到 code', () => {
    const yilan = events.find((e) => e.countyCodes.includes('10002'))!
    expect(yilan.type).toBe('weather')
    expect(yilan.severity).toBe('warning')
    expect(yilan.title).toContain('豪雨')
  })
})

describe('parseCapAlerts', () => {
  const events = parseCapAlerts(cap)
  it('兩筆告警', () => expect(events).toHaveLength(2))
  it('土石流紅色警戒 Severe → severe、南投', () => {
    const e = events.find((x) => x.countyCodes.includes('10009'))!
    expect(e.type).toBe('alert')
    expect(e.severity).toBe('severe')
    expect(e.source).toBe('NCDR')
  })
})
```

- [ ] **Step 4: 跑、確認失敗** — `pnpm test src/lib/disasters/parse.test.ts` → FAIL

- [ ] **Step 5: 實作 parse.ts**

`src/lib/disasters/parse.ts`：
```ts
import { findCountyByName } from '@/lib/counties'
import type { DisasterEvent, Severity } from './types'

const codeOf = (name: string): string | undefined => findCountyByName(name?.trim())?.code

/** 「5弱」「4級」→ 數字（弱/強當整數級） */
function intensityLevel(s: string): number {
  const m = String(s).match(/(\d+)/)
  return m ? Number(m[1]) : 0
}

export function parseEarthquakes(json: any): DisasterEvent[] {
  const list: any[] = json?.records?.Earthquake ?? []
  return list.map((q, i) => {
    const info = q.EarthquakeInfo ?? {}
    const mag = Number(info.EarthquakeMagnitude?.MagnitudeValue) || undefined
    const lat = Number(info.Epicenter?.EpicenterLatitude) || undefined
    const lon = Number(info.Epicenter?.EpicenterLongitude) || undefined
    const areas: any[] = q.Intensity?.ShakingArea ?? []
    const codes = new Set<string>()
    let maxInt = 0
    for (const a of areas) {
      const c = codeOf(a.CountyName)
      if (c) codes.add(c)
      maxInt = Math.max(maxInt, intensityLevel(a.AreaIntensity))
    }
    const severity: Severity =
      (mag && mag >= 6) || maxInt >= 5 ? 'severe' : (mag && mag >= 4) || maxInt >= 4 ? 'warning' : 'info'
    const originTime = (info.OriginTime ?? '').replace(' ', 'T')
    return {
      id: `cwa-eq-${q.EarthquakeNo ?? i}`,
      type: 'earthquake' as const,
      title: `規模 ${mag ?? '?'} 地震`,
      severity,
      countyCodes: [...codes],
      time: originTime,
      source: 'CWA' as const,
      lat, lon, magnitude: mag, raw: q,
    }
  })
}

const SEVERE_WX = ['大豪雨', '超大豪雨', '颱風', '陸上颱風', '海上颱風']
const WARNING_WX = ['豪雨', '大雨', '強風', '陸上強風', '長浪', '大雷雨']

export function parseWeatherAlerts(json: any): DisasterEvent[] {
  const locs: any[] = json?.records?.location ?? []
  const out: DisasterEvent[] = []
  for (const loc of locs) {
    const code = codeOf(loc.locationName)
    if (!code) continue
    const hazards: any[] = loc.hazardConditions?.hazards ?? []
    for (const h of hazards) {
      const phenom = h.info?.phenomena ?? '特報'
      const severity: Severity = SEVERE_WX.includes(phenom) ? 'severe' : WARNING_WX.includes(phenom) ? 'warning' : 'info'
      const start = (h.validTime?.startTime ?? '').replace(' ', 'T')
      out.push({
        id: `cwa-wx-${code}-${phenom}`,
        type: 'weather', title: `${phenom}特報`, severity,
        countyCodes: [code], time: start, source: 'CWA', raw: h,
      })
    }
  }
  return out
}

const CAP_SEVERITY: Record<string, Severity> = { Extreme: 'severe', Severe: 'severe', Moderate: 'warning', Minor: 'info' }

export function parseCapAlerts(json: any): DisasterEvent[] {
  const alerts: any[] = json?.alerts ?? []
  return alerts.map((a, i) => {
    const codes = (a.areas ?? []).map((n: string) => codeOf(n)).filter(Boolean) as string[]
    return {
      id: `ncdr-${a.id ?? i}`,
      type: 'alert' as const,
      title: a.event ?? '災防告警',
      severity: CAP_SEVERITY[a.severity] ?? 'info',
      countyCodes: codes,
      time: a.sent ?? '',
      source: 'NCDR' as const,
      raw: a,
    }
  })
}

export function parseDisasters(eq: unknown, weather: unknown, cap: unknown): DisasterEvent[] {
  return [
    ...(eq ? parseEarthquakes(eq) : []),
    ...(weather ? parseWeatherAlerts(weather) : []),
    ...(cap ? parseCapAlerts(cap) : []),
  ]
}
```

- [ ] **Step 6: 跑、確認通過** — PASS

- [ ] **Step 7: Commit**
```bash
git checkout -b feat/realtime-disasters
git add src/lib/disasters/
git commit -m "feat: 災害事件型別 + CWA/NCDR 解析（fixtures + Vitest）"
```

---

### Task 2: 事件分組 util + useDisasterEvents hook

**Files:** Create `src/lib/disasters/group.ts`, `src/lib/disasters/group.test.ts`, `src/hooks/useDisasterEvents.ts`

- [ ] **Step 1: 失敗測試（分組）**

`src/lib/disasters/group.test.ts`：
```ts
import { describe, it, expect } from 'vitest'
import { eventsByCounty, sortBySeverity } from './group'
import type { DisasterEvent } from './types'

const ev = (id: string, codes: string[], severity: any): DisasterEvent =>
  ({ id, type: 'alert', title: id, severity, countyCodes: codes, time: '', source: 'NCDR' })

describe('eventsByCounty', () => {
  it('一事件多縣市 → 每縣市都收到', () => {
    const map = eventsByCounty([ev('a', ['10009', '10014'], 'severe')])
    expect(map['10009']).toHaveLength(1)
    expect(map['10014']).toHaveLength(1)
  })
})

describe('sortBySeverity', () => {
  it('severe 排最前', () => {
    const sorted = sortBySeverity([ev('a', [], 'info'), ev('b', [], 'severe'), ev('c', [], 'warning')])
    expect(sorted.map((e) => e.id)).toEqual(['b', 'c', 'a'])
  })
})
```

- [ ] **Step 2: 跑、確認失敗** — FAIL

- [ ] **Step 3: 實作 group.ts**
```ts
import type { DisasterEvent, Severity } from './types'

export function eventsByCounty(events: DisasterEvent[]): Record<string, DisasterEvent[]> {
  const out: Record<string, DisasterEvent[]> = {}
  for (const e of events) {
    for (const code of e.countyCodes) {
      ;(out[code] ??= []).push(e)
    }
  }
  return out
}

const RANK: Record<Severity, number> = { severe: 0, warning: 1, info: 2 }
export function sortBySeverity(events: DisasterEvent[]): DisasterEvent[] {
  return [...events].sort((a, b) => RANK[a.severity] - RANK[b.severity])
}
```

- [ ] **Step 4: 跑、確認通過** — PASS

- [ ] **Step 5: 實作 hook（graceful）**

`src/hooks/useDisasterEvents.ts`：
```ts
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
    return [] // 後端未啟動/無 key → 事件為空，不致命
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
```

- [ ] **Step 6: Commit**
```bash
git add src/lib/disasters/group.ts src/lib/disasters/group.test.ts src/hooks/useDisasterEvents.ts
git commit -m "feat: 事件 by-county 分組 + useDisasterEvents（graceful）"
```

---

### Task 3: 地圖事件層（地震標記 + 受影響縣市描邊 + 開關）

**Files:** Modify `src/components/MapView.tsx`

- [ ] **Step 1: MapView 接收 events + 開關，加圖層**

在 `MapView` 的 `Props` 加：
```tsx
import type { DisasterEvent } from '@/lib/disasters/types'
// Props 增加：
events?: DisasterEvent[]
showEvents?: boolean
```

在 component 內，`sel` 之後，加事件 GeoJSON（震央點 + 受影響縣市集合）：
```tsx
const quakeGeo = useMemo(() => {
  const eqs = (events ?? []).filter((e) => e.type === 'earthquake' && e.lat != null && e.lon != null)
  return {
    type: 'FeatureCollection',
    features: eqs.map((e) => ({
      type: 'Feature',
      properties: { mag: e.magnitude ?? 0, label: `M${e.magnitude ?? '?'}`, sev: e.severity },
      geometry: { type: 'Point', coordinates: [e.lon, e.lat] },
    })),
  }
}, [events])

const alertedCodes = useMemo(() => {
  const s = new Set<string>()
  for (const e of events ?? []) if (e.type !== 'earthquake') e.countyCodes.forEach((c) => s.add(c))
  return s
}, [events])
```

在 `fillGeo` 注入 `_alerted`（受影響縣市）：在 fillGeo 的 feature map 內，將回傳改為：
```tsx
return { ...f, properties: { ...f.properties, _color: noData ? NO_DATA_COLOR : scoreColor(v), _alerted: alertedCodes.has(f.properties.COUNTYCODE) ? 1 : 0 } }
```
並把 `alertedCodes` 加進該 `useMemo` 的依賴陣列。

- [ ] **Step 2: 加圖層（描邊 + 震央標記）**

在 `county-line` Layer 之後、`</Source>`（counties）之前，加受影響縣市描邊：
```tsx
<Layer
  id="county-alert"
  type="line"
  filter={showEvents === false ? ['==', ['get', 'COUNTYCODE'], '__none__'] : ['==', ['get', '_alerted'], 1]}
  paint={{ 'line-color': '#1f6f8b', 'line-width': 2, 'line-dasharray': [2, 1.5], 'line-opacity': 0.9 }}
/>
```
在 labels Source 之後，加震央標記 Source（僅 `showEvents !== false` 時渲染）：
```tsx
{showEvents !== false && (
  <Source id="quakes" type="geojson" data={quakeGeo as any}>
    <Layer
      id="quake-dot"
      type="circle"
      paint={{
        'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 3, 5, 6, 16],
        'circle-color': '#1f6f8b',
        'circle-opacity': 0.25,
        'circle-stroke-color': '#1f6f8b',
        'circle-stroke-width': 1.5,
      }}
    />
    <Layer
      id="quake-label"
      type="symbol"
      layout={{ 'text-field': ['get', 'label'], 'text-font': ['Open Sans Semibold'], 'text-size': 11, 'text-allow-overlap': true }}
      paint={{ 'text-color': '#10394a', 'text-halo-color': '#f4efe4', 'text-halo-width': 1.4 }}
    />
  </Source>
)}
```
> 警示色用冷藍綠 `#1f6f8b`，與壓力暖色階區隔。

- [ ] **Step 3: 驗證** — `pnpm build` 成功（events 預設 undefined → 無事件圖層，不影響現狀）。

- [ ] **Step 4: Commit**
```bash
git add src/components/MapView.tsx
git commit -m "feat: 地圖即時災害層（震央標記 + 受影響縣市描邊 + 開關）"
```

---

### Task 4: drawer 事件清單 + 目前警示清單 + App 串接

**Files:** Modify `src/components/CountyDrawer.tsx`, `src/App.tsx`, `src/locales/zh-Hant.json`; Create `src/components/AlertsList.tsx`

- [ ] **Step 1: i18n 字串**

`src/locales/zh-Hant.json`：在 `drawer` 加 `"eventsNow": "進行中事件"`；新增頂層：
```json
"events": { "title": "目前警示", "none": "目前無警示", "toggle": "顯示即時災害" },
"severity": { "severe": "嚴重", "warning": "注意", "info": "資訊" }
```

- [ ] **Step 2: CountyDrawer 收 events，渲染事件清單**

`CountyDrawer` Props 加 `events?: DisasterEvent[]`（該縣市的事件，已分組）。把原「事件」區塊改為：
```tsx
import type { DisasterEvent } from '@/lib/disasters/types'
const SEV_COLOR: Record<string, string> = { severe: '#a8322b', warning: '#b5732f', info: '#6f6657' }
// ...原 events kicker 之後：
{(!events || events.length === 0) ? (
  <p className="text-sm text-[var(--color-ink-2)]">{t('drawer.noEvents')}</p>
) : (
  <ul className="flex flex-col gap-2">
    {events.map((e) => (
      <li key={e.id} className="flex items-start gap-2 text-sm">
        <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: SEV_COLOR[e.severity] }} />
        <div>
          <div className="text-[var(--color-ink)]">{e.title}</div>
          <div className="text-[11px] text-[var(--color-ink-2)] font-display">{e.source} · {e.time?.slice(5, 16).replace('T', ' ')}</div>
        </div>
      </li>
    ))}
  </ul>
)}
```

- [ ] **Step 3: AlertsList 元件**

`src/components/AlertsList.tsx`：
```tsx
import { useTranslation } from 'react-i18next'
import { sortBySeverity } from '@/lib/disasters/group'
import type { DisasterEvent } from '@/lib/disasters/types'

const SEV_COLOR: Record<string, string> = { severe: '#a8322b', warning: '#b5732f', info: '#6f6657' }

export function AlertsList({ events }: { events: DisasterEvent[] }) {
  const { t } = useTranslation()
  const top = sortBySeverity(events).slice(0, 5)
  return (
    <div className="border-t border-[var(--color-ink)]/15 px-6 py-4 bg-[var(--color-paper)]">
      <div className="kicker mb-2.5">{t('events.title')}</div>
      {top.length === 0 ? (
        <p className="text-[12px] text-[var(--color-ink-2)]">{t('events.none')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {top.map((e) => (
            <li key={e.id} className="flex items-center gap-2 text-[12px]">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: SEV_COLOR[e.severity] }} />
              <span className="flex-1 text-[var(--color-ink)] truncate">{e.title}</span>
              <span className="text-[var(--color-ink-2)] font-display">{e.countyCodes.length}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: App 串接（events、toggle、傳遞）**

`src/App.tsx`：加 `useDisasterEvents`、toggle state、分組，傳給 MapView/Drawer/AlertsList。在 imports 加：
```tsx
import { useDisasterEvents } from '@/hooks/useDisasterEvents'
import { eventsByCounty } from '@/lib/disasters/group'
import { AlertsList } from '@/components/AlertsList'
```
component 內加：
```tsx
const { data: events = [] } = useDisasterEvents()
const [showEvents, setShowEvents] = useState(true)
const byCounty = useMemo(() => eventsByCounty(events), [events])
```
在左欄 `<DataSources>` 之上插入 `<AlertsList events={events} />`。
在 MapView 傳 `events={events} showEvents={showEvents}`。
在 CountyDrawer 傳 `events={selected ? byCounty[selected.code] ?? [] : []}`。
著色維度區塊加一個 toggle（沿用 ControlPanel 的 chip 樣式，或在地圖右上加一個小開關）；MVP 放在 AlertsList 標題列右側：在 AlertsList 的 kicker 列右側加一個 checkbox/連結觸發 `setShowEvents`（把 `showEvents`/`onToggle` 當 props 傳入 AlertsList）。
> 實作：AlertsList 增加 `showEvents: boolean; onToggle: () => void` props，kicker 右側放一個小文字按鈕 `t('events.toggle')`（開→accent、關→muted）。

- [ ] **Step 5: 驗證**

Run: `pnpm exec tsc --noEmit -p tsconfig.app.json` → No errors
Run: `pnpm build` → 成功
Run: `pnpm test` → 全綠
`pnpm dev` 人工看：後端未啟動 → 事件為空、「目前無警示」、drawer 無事件、壓力地圖照常（graceful 正確）。

- [ ] **Step 6: Commit**
```bash
git add -A
git commit -m "feat: drawer 事件清單 + 目前警示清單 + 事件層開關串接"
```

---

## 階段 B — 後端薄 proxy + 真實驗證（需 OrbStack + 使用者 CWA key）

### Task 5: Supabase 後端 + disasters Edge Function（薄 proxy）

**Files:** Create `supabase/config.toml`（init）, `supabase/functions/disasters/index.ts`, `supabase/functions/.env.example`; Modify `.gitignore`

- [ ] **Step 1: 初始化 Supabase**
```bash
cd /Users/kurenpeng/Documents/kuren/taiwan-pressure-map
pnpm dlx supabase init    # 產生 supabase/config.toml（選擇不覆蓋既有檔）
```
確認 `.gitignore` 含 `supabase/functions/.env`（若無則加）。

- [ ] **Step 2: .env 範本**

`supabase/functions/.env.example`：
```
# 至 https://opendata.cwa.gov.tw 免費註冊取得授權碼，填入下行（勿提交真實值）
CWA_KEY=
```

- [ ] **Step 3: Edge Function（薄 proxy）**

`supabase/functions/disasters/index.ts`：
```ts
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CWA = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore'
// NCDR 災防告警公開資料（實作時以實際可用端點為準；先用 CAP ATOM/JSON）
const NCDR_URL = 'https://alerts.ncdr.nat.gov.tw/JSONATOMFEED.ashx'

let cache: { at: number; body: string } | null = null
const TTL = 5 * 60 * 1000

async function getJson(url: string): Promise<unknown | null> {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

async function getText(url: string): Promise<string | null> {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    return await r.text()
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (cache && Date.now() - cache.at < TTL) {
    return new Response(cache.body, { headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const key = Deno.env.get('CWA_KEY') ?? ''
  const eq = key ? await getJson(`${CWA}/E-A0015-001?Authorization=${key}&format=JSON`) : null
  const weather = key ? await getJson(`${CWA}/W-C0033-001?Authorization=${key}&format=JSON`) : null
  const capText = await getText(NCDR_URL)
  // NCDR 回傳格式於 Task 6 校正；先原樣帶出讓前端/後續處理
  const cap = capText ? { raw: capText } : null

  const body = {
    eq, weather, cap,
    fetchedAt: new Date().toISOString(),
    sources: {
      eq: eq ? 'ok' : 'error',
      weather: weather ? 'ok' : 'error',
      cap: cap ? 'ok' : 'error',
    },
  }
  const text = JSON.stringify(body)
  cache = { at: Date.now(), body: text }
  return json(body)
})
```
> 註：NCDR 端點與回傳格式（ATOM XML vs JSON）於 Task 6 以真實回應確認；若為 XML，於此 function 內轉成前端 `parseCapAlerts` 預期的 `{ alerts: [...] }`，或調整 `parseCapAlerts` 解析 XML。先讓 proxy 把資料帶出。

- [ ] **Step 4: 本機啟動（需 OrbStack 已開、.env 已填 key）**
```bash
pnpm dlx supabase start
pnpm dlx supabase functions serve disasters --env-file supabase/functions/.env --no-verify-jwt
```
（此步由具備 OrbStack + key 的環境執行；CI/無 key 環境略過。）

- [ ] **Step 5: Commit**
```bash
git add supabase/config.toml supabase/functions/disasters/index.ts supabase/functions/.env.example .gitignore
git commit -m "feat(be): disasters Edge Function 薄 proxy（CWA 藏 key + NCDR + CORS + 快取）"
```

---

### Task 6: 真實驗證 + 校正解析（與使用者、OrbStack、CWA key）

**Files:** 視需要 Modify `src/lib/disasters/parse.ts`, `src/lib/disasters/fixtures/*`, `supabase/functions/disasters/index.ts`

- [ ] **Step 1: 起後端、取真實回應**

確認使用者已：啟動 OrbStack、於 `supabase/functions/.env` 填入 `CWA_KEY`。
`curl -s "http://127.0.0.1:54321/functions/v1/disasters" | head -c 2000` 取得真實 `{eq, weather, cap}`。

- [ ] **Step 2: 校正解析**

比對真實回應與 fixtures：
- CWA 地震 `ShakingArea` 實際欄位（`CountyName` vs `AreaDesc`）、`AreaIntensity` 文字 → 調整 `parseEarthquakes` 與 `fixtures/eq.json`。
- CWA 天氣特報 `location/hazardConditions` 實際結構 → 調整 `parseWeatherAlerts` 與 `fixtures/weather.json`。
- NCDR 實際格式（XML/JSON、區域粒度）→ 於 Edge Function 轉成 `{alerts:[{id,event,severity,areas,sent,expires}]}`，或調整 `parseCapAlerts`；更新 `fixtures/cap.json`。
每次調整後 `pnpm test src/lib/disasters/` 維持綠。

- [ ] **Step 3: 過期過濾**

於 `parseWeatherAlerts`/`parseCapAlerts` 過濾 `endTime/expires < now` 的事件；地震過濾 `OriginTime` 早於 72 小時前。加對應測試（用固定 `now` 參數注入，避免 `Date.now()` 不穩）：
```ts
// 例：parseCapAlerts(json, now = Date.now()) 過濾 expires < now
```

- [ ] **Step 4: 瀏覽器驗證**

`pnpm dev`，確認：震央標記出現於正確位置、規模標示；受影響縣市藍綠描邊；drawer 顯示該縣市事件；「目前警示」清單；toggle 開關有效；關掉後端仍 graceful。截圖檢視。

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "fix: 依真實 CWA/NCDR 回應校正災害解析 + 過期過濾"
```

---

## Self-Review

**1. Spec coverage:**
- 三來源（CWA 地震/天氣 + NCDR）→ Task 1 解析 + Task 5 proxy + Task 6 校正 ✓
- 後端薄 proxy 藏 key + CORS + 快取 → Task 5 ✓；.env 安全 → Task 2/5（.env.example committed、.env gitignored）✓
- 事件模型 → Task 1 ✓；不進壓力分數（純 overlay，App 只把 events 傳給 Map/Drawer，不碰 buildRiskData）✓
- 地圖震央標記 + 縣市描邊 + 開關 → Task 3 ✓；drawer 事件清單 → Task 4 ✓；目前警示清單 → Task 4 ✓
- 時間窗（地震 72h、告警進行中）→ Task 6 Step 3 ✓
- 警示色與壓力色階區隔（冷藍綠 #1f6f8b）→ Task 3 ✓
- Graceful（後端掛掉事件為空、壓力地圖照常）→ Task 2 hook try/catch + Task 4 驗證 ✓
- 測試（解析 fixtures、分組、graceful）→ Task 1/2 ✓

**2. Placeholder scan:** 無 TBD。NCDR 端點/格式與 CWA 欄位細節標「Task 6 以真實回應校正」—— 屬外部 API 整合本質（同 #2），已以 fixture-TDD + 真實校正流程包覆，非可省略佔位。Phase B Step 4/Task 6 需真實環境（OrbStack+key）的步驟已明確標示由具該環境者執行。

**3. Type consistency:** `DisasterEvent`/`DisasterType`/`Severity`/`DisasterResponse` 於 Task 1 定義，Task 2–4 一致使用；`parseDisasters(eq,weather,cap)` 簽章與 hook、Edge Function 回傳的 `{eq,weather,cap}` 對齊；`eventsByCounty`/`sortBySeverity` 跨 group/AlertsList/App 一致；警示色 `#1f6f8b`（地圖）與 severity 色（drawer/AlertsList）分屬不同用途，刻意不同。
