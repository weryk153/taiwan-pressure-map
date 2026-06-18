# 人禍事件流（新聞）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 從 Google News RSS 抓人禍新聞（火災/車禍/命案…），依縣市比對，作為事件 overlay 的 `incident` 類型，沿用 #3 的地圖/drawer/警示清單；drawer 標題可點開原始新聞。

**Architecture:** 沿用 #3 模式——本地 Supabase Edge Function `news`（薄 proxy，**無需 key**：Google News RSS 公開）對 6 類別查 RSS、回原始 XML + CORS + 快取；前端 `src/lib/incidents/parse.ts`（純函式、Vitest 測）解析 RSS → 標題掃縣市 + 分類 + 去重 + 近 48h → `DisasterEvent[]`（`type:'incident'`、`url` 新聞連結）。App 把天災 ∪ 人禍一起餵現有事件層。不進壓力分數。

**Tech Stack:** Supabase（本地，OrbStack；**無 key**）+ Deno、Vite + React + TS、TanStack Query、Vitest。

**Spec:** `docs/superpowers/specs/2026-06-18-incidents-news-design.md`

**Branch:** `feat/incidents-news`（off master）。

**前置（Phase B 才需要）:** OrbStack 啟動。**不需任何 API key**。Phase A 不需後端。

---

## File Structure

```
src/lib/disasters/types.ts     # 改：DisasterType 加 'incident'；DisasterEvent 加 url?
src/lib/disasters/parse.ts     # 改：export countyCodesInText（供 #4 重用）
src/lib/incidents/
  categories.ts                # 6 類別（key/label/query/severity）
  parse.ts                     # parseRssItems / itemsToIncidents / dedupeIncidents / parseIncidents
  parse.test.ts
  fixtures/rss.xml             # Google News RSS 樣本
src/hooks/useIncidents.ts      # TanStack Query，graceful
src/App.tsx                    # 改：合併 events ∪ incidents 餵事件層
src/components/CountyDrawer.tsx# 改：incident 標題為可點連結
src/components/AlertsList.tsx  # 改：incident 顯示來源標示（NEWS）
supabase/functions/news/index.ts  # 薄 proxy（Deno，無 key）
```

---

## 階段 A — 前端（不需後端，graceful）

### Task 1: 型別 + 類別 + RSS 解析

**Files:** Modify `src/lib/disasters/types.ts`, `src/lib/disasters/parse.ts`; Create `src/lib/incidents/categories.ts`, `src/lib/incidents/parse.ts`, `src/lib/incidents/parse.test.ts`, `src/lib/incidents/fixtures/rss.xml`

- [ ] **Step 1: 改型別**

`src/lib/disasters/types.ts`：把 `DisasterType` 改為含 `'incident'`，並在 `DisasterEvent` 介面加 `url?: string`：
```ts
export type DisasterType = 'earthquake' | 'weather' | 'alert' | 'incident'
```
在 `DisasterEvent` 介面內（其他欄位不動）新增一行：
```ts
  url?: string
```

- [ ] **Step 2: export countyCodesInText 供重用**

`src/lib/disasters/parse.ts`：把現有的 `function countyCodesInText(` 改為 `export function countyCodesInText(`（只加 export，內容不變）。

- [ ] **Step 3: 類別**

`src/lib/incidents/categories.ts`：
```ts
import type { Severity } from '@/lib/disasters/types'

export interface IncidentCategory {
  key: string
  label: string
  query: string
  severity: Severity
}

export const INCIDENT_CATEGORIES: IncidentCategory[] = [
  { key: 'fire', label: '火災', query: '火災', severity: 'warning' },
  { key: 'crash', label: '車禍', query: '車禍 OR 死亡車禍', severity: 'info' },
  { key: 'homicide', label: '命案', query: '命案 OR 兇殺', severity: 'warning' },
  { key: 'shooting', label: '槍擊', query: '槍擊', severity: 'warning' },
  { key: 'industrial', label: '工安', query: '工安意外 OR 墜樓意外', severity: 'info' },
  { key: 'explosion', label: '氣爆', query: '氣爆 OR 爆炸', severity: 'warning' },
]

export const CATEGORY_BY_KEY: Record<string, IncidentCategory> =
  Object.fromEntries(INCIDENT_CATEGORIES.map((c) => [c.key, c]))
```

- [ ] **Step 4: RSS fixture**

`src/lib/incidents/fixtures/rss.xml`（Google News RSS 縮樣；標題含「 - 媒體」後綴、含縣市名）：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>火災 - Google News</title>
<item>
<title>新北市某工廠深夜火災 釀2人輕傷 - 中央社</title>
<link>https://news.google.com/rss/articles/AAA</link>
<guid>AAA</guid>
<pubDate>Wed, 18 Jun 2026 02:10:00 GMT</pubDate>
<source url="https://www.cna.com.tw">中央社</source>
</item>
<item>
<title>高雄市住宅火警 消防即時撲滅 - 自由時報</title>
<link>https://news.google.com/rss/articles/BBB</link>
<guid>BBB</guid>
<pubDate>Wed, 18 Jun 2026 01:40:00 GMT</pubDate>
<source url="https://ltn.com.tw">自由時報</source>
</item>
<item>
<title>關於消防演習的一般報導（無縣市）- 某媒體</title>
<link>https://news.google.com/rss/articles/CCC</link>
<guid>CCC</guid>
<pubDate>Wed, 18 Jun 2026 00:00:00 GMT</pubDate>
<source url="https://x.com">某媒體</source>
</item>
<item>
<title>新北市某工廠深夜火災 釀2人輕傷 - 聯合報</title>
<link>https://news.google.com/rss/articles/DDD</link>
<guid>DDD</guid>
<pubDate>Wed, 18 Jun 2026 02:30:00 GMT</pubDate>
<source url="https://udn.com">聯合報</source>
</item>
</channel></rss>
```

- [ ] **Step 5: 失敗測試**

`src/lib/incidents/parse.test.ts`：
```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseRssItems, itemsToIncidents, dedupeIncidents, parseIncidents } from './parse'

const xml = readFileSync(resolve(__dirname, './fixtures/rss.xml'), 'utf8')
const NOW = Date.parse('2026-06-18T03:00:00Z')

describe('parseRssItems', () => {
  const items = parseRssItems(xml)
  it('解析出 4 個 item', () => expect(items).toHaveLength(4))
  it('title/link/pubDate', () => {
    expect(items[0].title).toContain('新北市某工廠深夜火災')
    expect(items[0].link).toBe('https://news.google.com/rss/articles/AAA')
    expect(items[0].pubDate).toContain('2026')
  })
})

describe('itemsToIncidents', () => {
  const items = parseRssItems(xml)
  const events = itemsToIncidents(items, { key: 'fire', label: '火災', query: '火災', severity: 'warning' }, NOW)
  it('無縣市的項目被丟棄（剩 3 筆有縣市）', () => {
    expect(events).toHaveLength(3)
  })
  it('新北市火災 → countyCode 65000、type incident、url、warning', () => {
    const e = events.find((x) => x.title.includes('新北市'))!
    expect(e.countyCodes).toContain('65000')
    expect(e.type).toBe('incident')
    expect(e.severity).toBe('warning')
    expect(e.source).toBe('NEWS')
    expect(e.url).toContain('news.google.com')
  })
  it('近 48h 過濾：過舊丟棄', () => {
    const old = itemsToIncidents(items, { key: 'fire', label: '火災', query: '火災', severity: 'warning' }, Date.parse('2026-06-25T00:00:00Z'))
    expect(old).toHaveLength(0)
  })
})

describe('dedupeIncidents', () => {
  it('同縣市+相似標題（去媒體後綴）去重', () => {
    const items = parseRssItems(xml)
    const events = itemsToIncidents(items, { key: 'fire', label: '火災', query: '火災', severity: 'warning' }, NOW)
    const deduped = dedupeIncidents(events)
    // 「新北市某工廠深夜火災 釀2人輕傷」中央社 & 聯合報 → 合一
    const xinbei = deduped.filter((e) => e.countyCodes.includes('65000') && e.title.includes('工廠'))
    expect(xinbei).toHaveLength(1)
  })
})

describe('parseIncidents', () => {
  it('多 feed 合併 + 去重', () => {
    const out = parseIncidents([{ category: 'fire', xml }], NOW)
    expect(out.length).toBeGreaterThan(0)
    expect(out.every((e) => e.type === 'incident')).toBe(true)
  })
})
```

- [ ] **Step 6: 跑、確認失敗** — `pnpm test src/lib/incidents/parse.test.ts` → FAIL

- [ ] **Step 7: 實作 parse.ts**

`src/lib/incidents/parse.ts`：
```ts
import { countyCodesInText } from '@/lib/disasters/parse'
import { CATEGORY_BY_KEY, type IncidentCategory } from './categories'
import type { DisasterEvent } from '@/lib/disasters/types'

export interface RssItem {
  title: string
  link: string
  pubDate: string
  source?: string
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

function pick(body: string, tag: string): string {
  const m = body.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
  return m ? decodeEntities(m[1]) : ''
}

export function parseRssItems(xml: string): RssItem[] {
  const out: RssItem[] = []
  const blocks = xml.split(/<item>/).slice(1)
  for (const b of blocks) {
    const body = b.split(/<\/item>/)[0] ?? ''
    const title = pick(body, 'title')
    if (!title) continue
    out.push({ title, link: pick(body, 'link'), pubDate: pick(body, 'pubDate'), source: pick(body, 'source') })
  }
  return out
}

const DAY = 86_400_000
const WINDOW = 2 * DAY // 近 48h

/** 去掉 Google News 標題的「 - 媒體」後綴，作為去重與顯示基準 */
export function stripSourceSuffix(title: string): string {
  return title.replace(/\s+[-–—]\s+[^-–—]+$/, '').trim()
}

export function itemsToIncidents(items: RssItem[], category: IncidentCategory, nowMs: number = Date.now()): DisasterEvent[] {
  const out: DisasterEvent[] = []
  for (const it of items) {
    const codes = countyCodesInText(it.title)
    if (codes.length === 0) continue // 無可辨識縣市 → 丟棄
    const t = Date.parse(it.pubDate)
    if (!Number.isNaN(t) && nowMs - t > WINDOW) continue // 過舊
    out.push({
      id: `news-${it.link || it.title}`,
      type: 'incident',
      title: stripSourceSuffix(it.title),
      severity: category.severity,
      countyCodes: codes,
      time: Number.isNaN(t) ? it.pubDate : new Date(t).toISOString(),
      source: 'NEWS',
      url: it.link || undefined,
      raw: { category: category.key, source: it.source, originalTitle: it.title },
    })
  }
  return out
}

export function dedupeIncidents(events: DisasterEvent[]): DisasterEvent[] {
  const seen = new Set<string>()
  const out: DisasterEvent[] = []
  for (const e of events) {
    const key = `${stripSourceSuffix(e.title)}|${[...e.countyCodes].sort().join(',')}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(e)
  }
  return out
}

export function parseIncidents(feeds: { category: string; xml: string }[], nowMs: number = Date.now()): DisasterEvent[] {
  const all: DisasterEvent[] = []
  for (const f of feeds) {
    const cat = CATEGORY_BY_KEY[f.category]
    if (!cat) continue
    all.push(...itemsToIncidents(parseRssItems(f.xml), cat, nowMs))
  }
  return dedupeIncidents(all)
}
```
> 註：`DisasterEvent.source` 型別目前是 `'CWA' | 'NCDR'`。Step 1 之外，這裡需把它放寬。請在 `types.ts` 把 `source` 型別改為 `'CWA' | 'NCDR' | 'NEWS'`（與 Step 1 一起做）。

- [ ] **Step 8: 補 types.ts 的 source 放寬**（與上註一致）

`src/lib/disasters/types.ts`：將 `source: 'CWA' | 'NCDR'` 改為 `source: 'CWA' | 'NCDR' | 'NEWS'`。

- [ ] **Step 9: 跑、確認通過** — `pnpm test src/lib/incidents/parse.test.ts` → PASS

- [ ] **Step 10: Commit**
```bash
git checkout -b feat/incidents-news
git add src/lib/incidents/ src/lib/disasters/types.ts src/lib/disasters/parse.ts
git commit -m "feat: 人禍新聞型別/類別/RSS 解析（標題掃縣市+分類+去重+近48h）"
```

---

### Task 2: useIncidents hook + App 合併

**Files:** Create `src/hooks/useIncidents.ts`; Modify `src/App.tsx`

- [ ] **Step 1: hook**

`src/hooks/useIncidents.ts`：
```ts
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
```

- [ ] **Step 2: App 合併天災 ∪ 人禍**

`src/App.tsx`：
- import：`import { useIncidents } from '@/hooks/useIncidents'`
- 在 `useDisasterEvents` 之後加：`const { data: incidents = [] } = useIncidents()`
- 把原本的 `events` 用法改為合併集合。將：
```tsx
const { data: events = [] } = useDisasterEvents()
```
之下新增：
```tsx
const { data: incidents = [] } = useIncidents()
const allEvents = useMemo(() => [...events, ...incidents], [events, incidents])
const byCounty = useMemo(() => eventsByCounty(allEvents), [allEvents])
```
並把先前傳給 MapView / AlertsList 的 `events`、以及 `eventsByCounty(events)` 全部改用 `allEvents`：
  - `<AlertsList events={allEvents} ... />`
  - `<MapView events={allEvents} ... />`
  - `byCounty` 改用 `allEvents`（CountyDrawer 的 `events={byCounty[...]}` 不變）
（若先前已有 `const byCounty = useMemo(() => eventsByCounty(events), [events])`，改成 `allEvents`。）

- [ ] **Step 3: 驗證** — `pnpm exec tsc --noEmit -p tsconfig.app.json` → 無錯；`pnpm build` 成功；`pnpm test` 全綠。（後端未起 → incidents 空，graceful。）

- [ ] **Step 4: Commit**
```bash
git add src/hooks/useIncidents.ts src/App.tsx
git commit -m "feat: useIncidents hook + App 合併天災∪人禍餵事件層"
```

---

### Task 3: drawer 可點新聞 + AlertsList 來源標示

**Files:** Modify `src/components/CountyDrawer.tsx`, `src/components/AlertsList.tsx`

- [ ] **Step 1: drawer 標題可點連結**

`src/components/CountyDrawer.tsx`：在事件清單渲染每筆 `e` 的標題處，若 `e.url` 存在則用連結。把標題那行改為：
```tsx
{e.url ? (
  <a
    href={e.url}
    target="_blank"
    rel="noopener noreferrer"
    className="text-[var(--color-ink)] underline decoration-[var(--color-ink-2)]/40 hover:decoration-[var(--color-accent)] hover:text-[var(--color-accent)] transition"
  >
    {e.title}
  </a>
) : (
  <span className="text-[var(--color-ink)]">{e.title}</span>
)}
```
（其餘 `e.source · 時間` 行不變；NEWS 來源會顯示 `NEWS`，可保留或在下方 Step 顯示媒體名。）

- [ ] **Step 2: drawer 顯示媒體名（incident）**

在事件的 `來源 · 時間` 行，若是 NEWS 且 `raw.source` 有媒體名，優先顯示媒體名：
```tsx
<div className="text-[11px] text-[var(--color-ink-2)] font-display">
  {(e.source === 'NEWS' && (e.raw as any)?.source) ? (e.raw as any).source : e.source} · {e.time?.slice(5, 16).replace('T', ' ')}
</div>
```

- [ ] **Step 3: AlertsList 區分人禍**

`src/components/AlertsList.tsx`：在每列標題前，依 `e.type === 'incident'` 顯示一個小標（如「新聞」）。把列內容改為（保留既有 severity 點與 countyCodes 計數）：
```tsx
<span className="flex-1 text-[var(--color-ink)] truncate">
  {e.type === 'incident' && <span className="text-[var(--color-ink-2)]">[新聞] </span>}
  {e.title}
</span>
```

- [ ] **Step 4: 驗證** — `pnpm build`、`pnpm test` 綠；`pnpm dev` 後端未起時：人禍空、天災/壓力照常（graceful）。

- [ ] **Step 5: Commit**
```bash
git add src/components/CountyDrawer.tsx src/components/AlertsList.tsx
git commit -m "feat: drawer 新聞標題可點開 + 顯示媒體名 + 警示清單標示人禍"
```

---

## 階段 B — 後端 news proxy + 真實驗證（需 OrbStack，無 key）

### Task 4: news Edge Function（薄 proxy，無 key）

**Files:** Create `supabase/functions/news/index.ts`

- [ ] **Step 1: Edge Function**

`supabase/functions/news/index.ts`：
```ts
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 與前端 src/lib/incidents/categories.ts 對應（query 同步維護）
const CATEGORIES: { key: string; query: string }[] = [
  { key: 'fire', query: '火災' },
  { key: 'crash', query: '車禍 OR 死亡車禍' },
  { key: 'homicide', query: '命案 OR 兇殺' },
  { key: 'shooting', query: '槍擊' },
  { key: 'industrial', query: '工安意外 OR 墜樓意外' },
  { key: 'explosion', query: '氣爆 OR 爆炸' },
]

function rssUrl(query: string): string {
  const q = encodeURIComponent(query)
  return `https://news.google.com/rss/search?q=${q}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`
}

let cache: { at: number; body: string } | null = null
const TTL = 10 * 60 * 1000

async function getText(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!r.ok) return null
    return await r.text()
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (cache && Date.now() - cache.at < TTL) {
    return new Response(cache.body, { headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const feeds: { category: string; xml: string }[] = []
  for (const c of CATEGORIES) {
    const xml = await getText(rssUrl(c.query))
    if (xml) feeds.push({ category: c.key, xml })
  }

  const body = JSON.stringify({ feeds, fetchedAt: new Date().toISOString() })
  if (feeds.length === CATEGORIES.length) cache = { at: Date.now(), body }
  return new Response(body, { headers: { ...cors, 'Content-Type': 'application/json' } })
})
```

- [ ] **Step 2: 本機啟動驗證（需 OrbStack）**
```bash
cd /Users/kurenpeng/Documents/kuren/taiwan-pressure-map
pnpm dlx supabase start
pnpm dlx supabase functions serve news --no-verify-jwt
```
（無 env-file，因為不需 key。）

- [ ] **Step 3: Commit**
```bash
git add supabase/functions/news/index.ts
git commit -m "feat(be): news Edge Function 薄 proxy（Google News RSS 6 類別，無 key）"
```

---

### Task 5: 真實驗證 + 校正（OrbStack）

**Files:** 視需要 Modify `src/lib/incidents/parse.ts`, `src/lib/incidents/categories.ts`, `src/lib/incidents/fixtures/rss.xml`

- [ ] **Step 1: 取真實回應**

確認 OrbStack 啟動、`supabase start` + `functions serve news` 跑著。
```bash
curl -s --max-time 60 "http://127.0.0.1:54321/functions/v1/news" -o /tmp/news.json -w "HTTP %{http_code} size %{size_download}\n"
node -e "const d=require('/tmp/news.json'); console.log('feeds:', d.feeds?.map(f=>f.category)); console.log('xml0 len:', d.feeds?.[0]?.xml?.length)"
```

- [ ] **Step 2: 校正解析**

用真實 RSS 比對 `parseRssItems`：確認 `<title>`（是否含「 - 媒體」後綴）、`<link>`、`<pubDate>`、`<source>` 格式與 fixture 一致；若 Google News 標題格式不同（如全形破折號），調 `stripSourceSuffix` 的分隔符 regex。以真實片段更新 `fixtures/rss.xml`，保持 `pnpm test src/lib/incidents/` 綠。

- [ ] **Step 3: 雜訊檢視 + 微調**

用真實資料數一數：每類別命中縣市的筆數、誤判（標題提縣市但非該縣市事件）程度。若過雜，調 `categories.ts` 查詢字串（更精確）或在 `itemsToIncidents` 加排除詞（如「演習」「宣導」）。記錄於 `categories.ts` 註解。

- [ ] **Step 4: 瀏覽器驗證**

`pnpm dev`，點有新聞的縣市，確認 drawer 出現人禍新聞、**標題可點開**原始報導、顯示媒體名；「目前警示」清單出現 `[新聞]` 項。截圖檢視。（若 Playwright MCP 不可用，改由使用者開瀏覽器確認。）

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "fix: 依真實 Google News RSS 校正人禍解析 + 雜訊微調"
```

---

## Self-Review

**1. Spec coverage:**
- 只新聞 RSS、6 類別 → Task 1(categories) + Task 4(news function) ✓
- 沿用 #3 事件層（incident 型別）→ Task 1(types) + Task 2(App 合併) + Task 3(UI) ✓
- 標題掃縣市 + 分類 + 去重 + 近 48h → Task 1(parse) ✓
- 人禍不上地圖標點：MapView `quakeGeo` 只收 earthquake、`alertedCodes` 只收 severe（incident 為 warning/info）→ 無需改 MapView，incident 自然不上點/不描邊 ✓
- drawer 標題可點新聞 + 媒體名 → Task 3 ✓；警示清單標示 → Task 3 ✓
- 不進壓力分數：App 只把 allEvents 餵事件層，不碰 buildRiskData ✓
- 後端薄 proxy 無 key + 快取 + graceful → Task 4 + Task 2(hook try/catch) ✓
- 測試（RSS 解析/縣市比對/去重/近48h/graceful）→ Task 1 ✓

**2. Placeholder scan:** 無 TBD。Task 5 的「以真實回應校正」屬外部資料整合本質（同 #2/#3），有 fixture-TDD + 真實校正流程包覆。

**3. Type consistency:** `DisasterEvent`(+url, source 加 'NEWS', type 加 'incident')於 Task 1 定義，Task 2/3 使用一致；`IncidentCategory`/`CATEGORY_BY_KEY` 於 categories.ts，parse.ts 使用；`parseIncidents(feeds, nowMs)` 與 hook、news function 回傳的 `{feeds:[{category,xml}]}` 對齊；`countyCodesInText` 由 disasters/parse.ts export、incidents/parse.ts import；前端 categories 與後端 CATEGORIES 的 key/query 需手動同步（已在後端註解標明）。
```
