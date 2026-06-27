# 台灣縣市壓力指數 Taiwan County Pressure Index

互動式台灣 22 縣市「壓力 / 風險」地圖：以真實政府開放統計算出各縣市綜合壓力指數（choropleth），並疊上即時災害與人禍事件。定位是**可信的數據分析**，非聳動工具——資料一律誠實標示真實 / 無資料，不造假。

> 編輯 / 數據報導風（米白紙感）。Vite + React + TypeScript。

---

## 四個子系統

| # | 子系統 | 內容 | 資料 | 後端 |
|---|---|---|---|---|
| 1 | **核心地圖地基** | 22 縣市 choropleth + 3D/排行 + 縣市 drawer + 控制面板 + i18n | — | 無 |
| 2 | **縣市壓力指數** | 經濟/居住/人口/治安/醫療 5 指標 → 絕對門檻正規化 → 綜合指數 | **真實官方統計**（靜態快照） | 無 |
| 3 | **即時災害** | CWA 地震 / 天氣特報 + NCDR 災防告警，事件 overlay | 即時 | 本地 Supabase Edge（藏 CWA key） |
| 4 | **人禍事件流** | Google News RSS（火災/車禍/命案/槍擊/工安/氣爆）依縣市比對 | 近 7 天新聞 | 本地 Supabase Edge（無 key） |

災害與人禍是**事件 overlay，不影響壓力指數分數**（指數純由 #2 的統計組成）。

---

## 壓力指數（#2）資料來源

絕對參考門檻正規化（可信、可跨年比較；門檻定義於 `src/lib/normalize.ts`，可校準）。

| 指標 | 來源 | 資料期 | 狀態 |
|---|---|---|---|
| 經濟 每戶可支配所得（反向） | 主計總處 | 2025 | ✅（20 縣市；調查不含金門/連江） |
| 人口 老化指數 | 內政部戶政司 | 2026-05 | ✅ 22 |
| 治安 刑案發生率 | 警政署（＋人口算率） | 2024 | ✅ 22 |
| 醫療 每萬人病床（反向） | 衛福部（＋人口算率） | 2024 | ✅ 22 |
| 居住 房價所得比 | 內政部不動產資訊平台 | 2025-Q4 | ✅ 19（統計未列澎湖/金門/連江；手動季快照） |

缺值縣市/指標標示「無資料」，不以 mock 填補。

---

## 開發 / 執行

需求：Node + pnpm；即時事件（#3/#4）另需 [OrbStack](https://orbstack.dev)（Docker）。

```bash
pnpm install
pnpm dev          # 前端（壓力地圖 + #2 真實統計）—— 不需後端
pnpm test         # Vitest
pnpm build        # 型別檢查 + production build
```

### 更新壓力統計（#2）
```bash
pnpm build:data   # 自動抓主計處/戶政/警政/衛福 → public/taiwan-pressure.json
```
房價所得比無 API（內政部不動產平台僅前端表格/PDF），採**手動季快照**：每季開瀏覽器讀官方表格、更新 `scripts/sources/housing.ts` 的 `SNAPSHOT` 與 `AS_OF`，再 `pnpm build:data`。

### 啟用即時事件（#3/#4）
1. 啟動 OrbStack
2. （#3 才需要）至 [opendata.cwa.gov.tw](https://opendata.cwa.gov.tw) 免費註冊授權碼，填入 `supabase/functions/.env` 的 `CWA_KEY=`（**勿提交、勿外洩**；`.env` 已 gitignored，`.env.example` 為範本）。#4 不需任何 key。
3. 啟動本地後端：
   ```bash
   pnpm dlx supabase start
   pnpm dlx supabase functions serve --env-file supabase/functions/.env --no-verify-jwt
   ```
後端未啟動時前端 graceful：事件為空、壓力地圖照常。

---

## 架構

```
src/
  lib/
    counties.ts        22 縣市 + 行政區代碼 + 臺/台 正規化
    score.ts           綜合指數加權（缺值重正規化）
    normalize.ts       絕對門檻正規化
    buildRiskData.ts   真實訊號 → CountyRisk（真實或留空）
    colors.ts          熱度色階
    disasters/         #3 事件型別 + CWA/NCDR 解析 + 分組
    incidents/         #4 新聞類別 + RSS 解析
  hooks/               useRiskData / useDisasterEvents / useIncidents
  components/          MapView / ControlPanel / CountyDrawer / Legend / AlertsList / DataSources
  locales/zh-Hant.json 繁中（保留 i18n 架構）
public/
  taiwan-counties.json 縣市界 GeoJSON
  taiwan-pressure.json #2 靜態快照（pnpm build:data 產生）
scripts/               #2 build:data 抓取/正規化（tsx）
supabase/functions/    disasters（#3，藏 CWA key）/ news（#4，無 key）薄 proxy
docs/superpowers/      各子專案 spec + plan
```

**技術棧**：Vite · React 19 · TypeScript · Tailwind v4 · MapLibre（react-map-gl）· TanStack Query · Recharts · i18next · Vitest · Supabase（本地 Edge Functions / Deno）。

---

## 已知限制（誠實標示）

- **經濟（每戶可支配所得，反向）**：主計總處家庭收支調查不涵蓋金門/連江，故該指標僅 20 縣市。
- **房價所得比**：無 API、手動季快照、19 縣市。
- **人禍新聞稀疏且有雜訊**：僅取標題含縣市名、近 7 天者；分類靠關鍵詞，誤判難免——新聞爬取的本質限制。
- 災害/人禍事件層需後端跑著才有資料。

## 未做（可延伸）

雲端部署、AI 事件摘要、事件層篩選、PTT/社群來源、歷史事件查詢、統計門檻校準。
