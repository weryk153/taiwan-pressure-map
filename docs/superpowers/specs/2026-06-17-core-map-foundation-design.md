# 子專案 #1：核心地圖地基 — 設計文件

> 台灣縣市壓力地圖（Taiwan County Pressure Map）的第一個子專案。
> 整個產品拆為 4 個子專案，各自 spec → plan → 實作：
> **#1 核心地圖地基**（本文件）→ #2 縣市壓力指數（定期統計）→ #3 即時災害（CWA/NCDR）→ #4 人禍事件流（新聞/社群爬取）。

## 目標

一個能跑通的**台灣 22 縣市互動壓力地圖**：choropleth 填色 + 3D 柱狀體 + 左側控制面板 + 縣市詳情 drawer。
本階段**指數為 mock（決定性假資料）**，純粹把台灣地理上的整套互動跑穩；真實資料留給 #2~#4。

## 範圍（YAGNI）

**做**：台灣 22 縣市 GeoJSON 地圖、choropleth、3D 柱、控制面板、縣市 drawer、繁中 i18n 架構、計分純函式、mock 資料層。

**明確不做**（留給後續子專案）：真實資料、後端、真實趨勢、真實事件。趨勢/事件在 drawer 中以 mock 或空狀態呈現，但保留 UI 插槽。

## 專案

- 位置：`/Users/kurenpeng/Documents/kuren/taiwan-pressure-map`（與 `pressure-map` 同層、獨立 git repo）
- 沿用全球版（pressure-map）架構並改寫：**Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui + MapLibre（react-map-gl/maplibre）+ TanStack Query + Recharts + Vitest**，pnpm。

## 縣市清單（22）

6 直轄市 + 3 市 + 13 縣，以**行政區代碼**為穩定 join key：

| code | 名稱 | | code | 名稱 |
|---|---|---|---|---|
| 63000 | 臺北市 | | 10004 | 嘉義市 |
| 64000 | 高雄市 | | 10005 | 新竹縣 |
| 65000 | 新北市 | | 10007 | 苗栗縣 |
| 66000 | 臺中市 | | 10008 | 彰化縣 |
| 67000 | 臺南市 | | 10009 | 南投縣 |
| 68000 | 桃園市 | | 10010 | 雲林縣 |
| 10002 | 宜蘭縣 | | 10013 | 屏東縣 |
| 10020 | 嘉義縣 | | 10014 | 臺東縣 |
| 09020 | 連江縣 | | 10015 | 花蓮縣 |
| 09007 | 金門縣 | | 10016 | 澎湖縣 |
| 10003 | 新竹市 | | 10017 | 基隆市 |

> 實作時以 GeoJSON 內實際的 `COUNTYCODE`/`COUNTYNAME` 欄位為準（下方「未定/實作時確認」）。

## 資料模型

```ts
type CountyCode = string            // 行政區代碼，如 '63000'

interface County {
  code: CountyCode
  name: string                      // 繁中官方名，如 '臺北市'（臺/台 正規化後）
}

type MetricKey = 'economic' | 'housing' | 'demographic' | 'safety' | 'healthcare'

interface CountySignal {            // 為 #2~#4 預留：單一來源對單一指標的訊號
  code: CountyCode
  metric: MetricKey
  value: number                     // 0–100 正規化後
  confidence: number                // 0–1
  asOf: string                      // ISO date
  raw?: unknown
}

interface CountyRisk {
  code: CountyCode
  name: string
  score: number                     // 0–100 綜合壓力指數
  subScores: Record<MetricKey, number>
  confidence: number                // 0–1
  asOf: string
}
```

### 指標與權重（綜合壓力指數）

| MetricKey | 中文 | 權重 | 真資料來源（#2） |
|---|---|---|---|
| economic | 經濟壓力 | 0.25 | 主計總處 失業率 |
| housing | 居住壓力 | 0.20 | 內政部 房價所得比 |
| demographic | 人口壓力 | 0.20 | 內政部戶政 老化指數/社會增加率 |
| safety | 治安 | 0.20 | 警政署 刑案/交通事故 |
| healthcare | 醫療資源 | 0.15 | 衛福部 每萬人病床數（反向） |

權重和為 1.0。為**先驗值**，#2 接真資料後可校準。

### 計分純函式

```ts
// 加權平均；缺值指標重新分配權重（與全球版相同邏輯）
calculateRiskScore(subScores: Partial<Record<MetricKey, number>>): number
```

### Mock 資料層

- `buildMockRisk(code)`：以 `code` 為 seed 的**決定性** PRNG，產生穩定的 subScores 與 confidence（重整理頁面不亂跳）。
- 架構與全球版 `DataSourceAdapter` 對齊：mock 視為一個 adapter，之後 #2~#4 的真實 adapter 以相同介面插入，`buildRiskData` 以 MAX/override 合併。

## 地圖

- **GeoJSON**：內政部「直轄市縣市界線」（政府資料開放平臺）轉 GeoJSON 並簡化（toposimplify / mapshaper），放 `public/taiwan-counties.json`。
- **Join key**：`COUNTYCODE`（行政區代碼）。名稱僅供顯示，並做 **臺/台 正規化**（官方用「臺」，如 臺北/臺中/臺南/臺東；輸入端 台/臺 皆對應同一 code）。此為全球版 `ISO_A3_EH`（France -99）那類陷阱的台灣版。
- **Choropleth**：依 `score` 填色，色階 低→中→高→危急（沿用全球版色票）。
- **3D 柱**：縣市 centroid 上 `fill-extrusion` 圓柱（circlePolygon 64 段）：高度 = score、半徑 = 0.7 + confidence × 係數。centroid 由 GeoJSON 以 turf 或預算的 label point 取得。
- **視野**：載入時 `fitBounds` 框住全部 22 縣市（含金門 ~118°E、馬祖 ~119.9°N 北端），離島依**真實地理位置**顯示（不做 inset）。
- **互動**：hover highlight、點縣市 → 開 drawer。

## UI 佈局（沿用全球版，全繁體中文、不中英混用）

- **標題列**：台灣縣市壓力地圖 + 簡述。
- **左控制面板**：
  - 子指標切換（綜合 / 經濟 / 居住 / 人口 / 治安 / 醫療）—— 切換時地圖依該維度著色。
  - 縣市排行榜：22 縣市**全列**（依當前著色維度排序，可捲動），點項目 = 點地圖。
- **右 drawer**（點縣市開啟）：總分 + 等級、子分數（Recharts 雷達或長條）、趨勢（#1 為 mock 折線）、事件（#1 為空狀態，保留區塊）、信心標示、資料時間。
- **圖例 Legend**：色階說明。
- **狀態**：loading / empty / error。

## i18n

- i18next + react-i18next，**僅 zh-Hant 單語系**。
- 保留多語系架構（之後要加 EN 可擴充），但本階段只有 `zh-Hant` 一個 locale，所有字串走翻譯檔。
- 文案全繁中，不中英混用（專有/技術名詞除外）。

## 測試（Vitest）

- `calculateRiskScore`：加權正確、缺值重分配權重、邊界（全缺、單一）。
- 臺/台 正規化：`台北市`/`臺北市` → 同一 code。
- mock 決定性：同 code 兩次呼叫結果相同。
- 縣市清單完整性：22 筆、code 唯一。
- （輕量）GeoJSON join：載入的 GeoJSON 每個 feature 有非空 `COUNTYCODE`，且能對到 22 縣市清單。

## 未定／實作時確認

- 內政部 GeoJSON 實際欄位名（`COUNTYCODE` vs `COUNTY_ID`，`COUNTYNAME`）與離島是否含南海（太平島非縣市，排除）。
- centroid 取法：GeoJSON 內若有 label point 欄位則用之，否則 turf `centerOfMass`。
- 色階閾值沿用全球版或依台灣 mock 分佈微調。
