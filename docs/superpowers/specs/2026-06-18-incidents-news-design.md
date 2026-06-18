# 子專案 #4：人禍事件流（新聞）— 設計文件

> 接續 #1 地基、#2 壓力指數、#3 即時災害。新增**人禍事件**（火災/車禍/命案…），來自新聞 RSS。
> 系列最後一塊。

## 定位

人禍新聞是即時事件 overlay 的另一種類型，沿用 #3 的 `DisasterEvent` 與地圖/drawer/警示清單基礎。
**不影響壓力指數分數**（指數仍是 #2 靜態統計）。

## 核心決策（brainstorm 拍板）

1. **只爬新聞 RSS（Google News）**，不爬 PTT/社群（雜訊/ToS）。
2. **沿用 #3 事件層**：人禍為 `type: 'incident'`，走同一套 UI。
3. **人禍不上地圖標點**（RSS 無座標）→ 只在 drawer 事件清單與「目前警示」呈現。
4. **drawer 標題可點開原始新聞**（`url`）。
5. **不進壓力分數**。

## 架構（沿用 #3 後端薄 proxy 模式）

```
本地 Supabase Edge Function: news（薄 proxy）
  └─ 對每個人禍類別查 Google News RSS：
       https://news.google.com/rss/search?q=<關鍵詞>&hl=zh-TW&gl=TW&ceid=TW:zh-Hant
     回 { feeds: [{ category, xml }], fetchedAt } + CORS + 短 TTL 快取
     （單一類別失敗不影響其他）

前端
  src/lib/incidents/parse.ts（純函式，Vitest 測）：
    RSS XML → 新聞項 → 標題掃縣市 + 人禍關鍵詞過濾 + 分類 + 去重 + 近 48h
    → DisasterEvent[]（type:'incident', source:'NEWS', url, countyCodes, time, severity）
  useIncidents() hook（graceful，後端失敗 → []）
  App：events（#3 天災）∪ incidents（#4 人禍）一起餵現有事件層
```

- 與 #3 一致：解析在前端（可測、重用 `findCountyByName`/`countyCodesInText`）；後端只 proxy（RSS 有 CORS，需 server 端抓）。
- live 需後端（OrbStack + `supabase functions serve`）；後端關掉 graceful（incidents 空，天災/壓力照常）。

## 人禍類別與查詢

| category | Google News 查詢關鍵詞 |
|---|---|
| 火災 | 火災 |
| 車禍 | 車禍 OR 死亡車禍 |
| 命案 | 命案 OR 兇殺 |
| 槍擊 | 槍擊 |
| 工安 | 工安意外 OR 墜樓意外 |
| 氣爆 | 氣爆 OR 爆炸 |

- 每類別一個 RSS 查詢（約 6 個 fetch），回近期台灣新聞；縣市由**標題文字**判定。
- 查詢字串可集中於 `src/lib/incidents/categories.ts`，便於調整。

## 事件模型增修

```ts
// types.ts
export type DisasterType = 'earthquake' | 'weather' | 'alert' | 'incident'  // 加 incident
export interface DisasterEvent {
  // ...既有欄位
  url?: string   // 新增：人禍新聞連結
}
```

## 解析（src/lib/incidents/parse.ts）

- `parseRssItems(xml: string): RssItem[]` —— 純字串/正則解析 RSS `<item>`（title/link/pubDate/source/description）。不依賴 DOM，便於 Vitest。
- `itemsToIncidents(items, category, nowMs): DisasterEvent[]`：
  - 標題用 `countyCodesInText`（重用 #3，含臺/台）掃縣市；**無可辨識縣市 → 丟棄**。
  - 近 48h（`pubDate` 解析）；過舊 → 丟棄。
  - severity：命案/火災/氣爆/槍擊 → warning；其餘 → info。
  - `id` 用 link 或 title 雜湊；`url` = link；`time` = pubDate；`source:'NEWS'`，`type:'incident'`，`title` = 新聞標題。
- `dedupeIncidents(events)`：同一縣市集合 + 高度相似標題 → 去重（標題正規化後相同/包含）。
- `parseIncidents(feeds, nowMs)`：對每個 `{category, xml}` 跑 `parseRssItems`+`itemsToIncidents`，合併後 `dedupeIncidents`。

## UI（重用 #3）

- **drawer 事件清單**：incident 與天災事件並列；incident 標題為 `<a href={url} target="_blank">`，可點開原始新聞；附 `來源 · 時間`。
- **「目前警示」清單**：incident 一起列，前綴/圖示區分（新聞）。
- **地圖**：incident 無座標、不放點標記；severity=warning 以上沿用 #3「嚴重才描邊」規則（incident 多為 info/warning，通常不描邊）。
- **事件層開關**（#3 既有）同時控制天災與人禍。

## 錯誤處理 / Graceful

- `news` 後端未啟動/單一類別 RSS 失敗 → 對應 incidents 缺，其餘照常。
- `useIncidents` try/catch → `[]`；App 合併 `events ∪ incidents`，任一為空不影響另一。
- **壓力地圖（#2）與天災（#3）完全不依賴 #4**。

## 測試

- `parseRssItems`：RSS XML fixture → items（title/link/pubDate）。
- `itemsToIncidents`：標題掃縣市（命中/未命中丟棄）、近 48h 過濾（pin nowMs）、分類 severity。
- `dedupeIncidents`：相似標題去重。
- `useIncidents` graceful（fetch 失敗 → []）。
- Edge Function 解析非單元測試；以真實 RSS 於實作驗證。

## 範圍（YAGNI）

**做**：news Edge Function proxy（6 類別、graceful、快取）、RSS 解析 + 縣市比對 + 分類 + 去重 + 近 48h、`DisasterType` 加 incident + `url`、useIncidents hook、drawer 可點新聞、警示清單併入、測試。

**不做**（留後續）：PTT/社群、全文擷取（只用 RSS 標題/摘要）、情緒/嚴重度 AI 分級、人禍進壓力分數、雲端部署、歷史查詢。

## 未定／實作時確認

- Google News RSS 實際 XML 結構（item 內 `<source>`、`<title>` 是否含媒體名後綴）—— 實作以真實回應為準。
- 類別關鍵詞與 severity 對應依真實雜訊微調（記錄於 `categories.ts`）。
- 去重相似度門檻（先用標題正規化相等/包含；過嚴/過鬆再調）。
- incident 是否在「目前警示」與天災混列或分組 —— 先混列、以類型標示；太亂再分組。
