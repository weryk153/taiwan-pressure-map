# 子專案 #3：即時災害（CWA + NCDR）— 設計文件

> 接續 #1 地基、#2 壓力指數。新增**即時災害事件層**，疊在壓力地圖上。
> 後續：#4 人禍事件流（新聞/社群）。

## 定位

即時災害是**獨立的事件層（overlay）**，疊在 #2 的壓力 choropleth 上。
**災害事件不影響壓力指數分數** —— 指數仍是 #2 的靜態統計；災害是另一種即時資訊維度。

## 核心決策（brainstorm 拍板）

1. **三個來源全做**：CWA 顯著有感地震報告、CWA 天氣特報、NCDR 災防告警（CAP）。
2. **起本地後端**：Supabase（OrbStack）Edge Function proxy，藏 CWA key、加 CORS、短 TTL 快取。
3. **災害不進分數**（純 overlay）。
4. 時間窗：地震近 **72 小時**；天氣特報／CAP 取**進行中（未過期）**的告警。
5. **警示色與壓力色階區隔**（避免混淆）。

## 架構（首次引入後端）

```
本地 Supabase（OrbStack）
  └─ Edge Function: disasters
       ├─ fetch CWA E-A0015-001（地震，需 key）
       ├─ fetch CWA W-C0033-001（天氣特報，需 key）
       ├─ fetch NCDR 災防告警 CAP（公開）
       ├─ 各自解析 → DisasterEvent；單一來源失敗不影響其他（graceful）
       ├─ 短 TTL 快取（避免打爆 API；快取於記憶體 meta 或 events 表）
       └─ 回傳 { events: DisasterEvent[], fetchedAt, sources: {cwaEq, cwaWeather, ncdr: 'ok'|'error'} } + CORS

前端
  useDisasterEvents()（TanStack Query，refetchInterval 5 分鐘）→ Edge Function
  靜態壓力資料（#2）與即時事件（#3）各自 fetch、互不耦合
```

- **靜態壓力（#2）與即時事件（#3）完全分離**：後端只負責事件；壓力地圖不依賴後端。
- 後端端點（本地）：`http://127.0.0.1:54321/functions/v1/disasters`。前端以環境變數或預設指向本地；**後端不可用時前端 graceful（事件為空）**。

## 安全（沿用全球版規矩）

- `CWA_KEY` 放 `supabase/functions/.env`（**gitignored**）；`supabase/functions/.env.example` committed（僅 key 名範本）。
- 使用者自行至 opendata.cwa.gov.tw 免費註冊取得授權碼、自己填入 .env。
- **密碼/key 永不進對話、git、前端**。實作時只檢查 key 是否存在（不讀值）。

## 事件模型

```ts
type DisasterType = 'earthquake' | 'weather' | 'alert'
type Severity = 'info' | 'warning' | 'severe'

interface DisasterEvent {
  id: string
  type: DisasterType
  title: string            // 「規模 5.2 地震」/「豪雨特報」/「土石流紅色警戒」
  severity: Severity
  countyCodes: string[]    // 受影響縣市（地震＝有感震度的縣市；天氣/CAP＝告警區域）
  time: string             // ISO；地震＝發震時間，告警＝發布時間
  source: 'CWA' | 'NCDR'
  lat?: number             // 地震震央
  lon?: number
  magnitude?: number       // 地震規模
  raw?: unknown
}
```

### 來源 → 事件（解析，實作時依實際回應調整）

| 來源 | 端點 | 重點欄位 | severity 判定 |
|---|---|---|---|
| CWA 地震 | `E-A0015-001`（datastore，需 Authorization key）| 發震時間、規模、震央經緯度、各地最大震度 | 規模 ≥6 或震度≥5 → severe；≥4 → warning；否則 info |
| CWA 天氣特報 | `W-C0033-001`（縣市別特報，需 key）| 縣市、現象（豪雨/大豪雨/強風/颱風）、生效時間 | 大豪雨/颱風 → severe；豪雨/強風 → warning；其餘 info |
| NCDR CAP | alerts.ncdr.nat.gov.tw（ATOM/JSON，公開）| 災害類別、區域(縣市/鄉鎮)、嚴重度、有效期 | 依 CAP severity 映射（Extreme/Severe→severe；Moderate→warning；Minor→info）|

- 縣市對應用既有 `findCountyByName`（臺/台正規化）。
- 地震「各地震度」對到縣市 → `countyCodes`；震央 `lat/lon` 供點標記。
- 過期（超出有效期/72 小時）事件不回傳。

## 前端

- **`useDisasterEvents()`**：TanStack Query，`refetchInterval: 5 分鐘`，graceful（後端錯誤 → 空陣列、不拋給 UI 致命）。
- **地圖事件層（MapView）**：
  - 地震：震央**點標記**（圓，半徑/色 ∝ 規模，用警示色系——與壓力的暖色階區隔，例如冷色/洋紅），mono 標規模。
  - 縣市級告警（天氣/CAP）：受影響縣市**描邊**（警示色虛線/實線）或角落小點。
  - 事件層可開關（控制面板一個 toggle「顯示即時災害」）。
- **drawer 事件區**：把 #1 的「目前無事件資料」換成該縣市**進行中事件清單**（類型圖示／標題／嚴重度色／相對時間）；無事件才顯示空狀態。
- **「目前警示」小清單**：控制面板底（資料來源 footnote 上方）或頂部 strip，列出進行中告警數與最嚴重幾筆。
- 視覺沿用編輯/紙感風；警示色克制。

## 錯誤處理 / Graceful

- 後端未啟動、無 key、單一來源失敗 → 對應事件缺，其餘照常；前端事件為空時 UI 正常（無標記、drawer 空狀態）。
- **#2 壓力地圖完全不依賴 #3**：後端掛掉，壓力地圖照常。
- Edge Function 對每個來源 try/catch，回傳各來源狀態供前端（可選）顯示。

## 測試

- **Edge Function 解析純函式**（以 fixture 測，不打網路）：CWA 地震 JSON → DisasterEvent（震度→countyCodes、severity 判定）、CWA 天氣特報 → 縣市事件、NCDR CAP → 事件、過期過濾。
- **縣市對應**：地震各地震度/告警區域 → COUNTYCODE（含臺/台）。
- **前端**：事件 by-county 分組（drawer 用）、`useDisasterEvents` graceful（fetch 失敗 → 空）。
- 後端整合：以 `.env` 有 key 時手動 `supabase functions serve` 驗證真實回應（非單元測試）。

## 範圍（YAGNI）

**做**：Supabase 後端 + disasters Edge Function（三來源、graceful、快取）、事件模型與解析、前端事件 hook、地圖事件層（地震點標記＋縣市告警描邊＋開關）、drawer 事件清單、目前警示小清單、安全（.env）、測試。

**不做**（留後續）：歷史事件查詢、推播通知、雲端部署、地震波形/詳圖、#4 人禍（新聞/社群）、事件進壓力分數。

## 未定／實作時確認

- CWA datastore 實際 JSON 結構（地震「各地震度」陣列欄位名、天氣特報縣市結構）—— 實作以真實回應為準。
- NCDR 災防告警的確切公開端點與格式（ATOM vs JSON；區域到縣市/鄉鎮的粒度）—— 實作驗證；拿不到則該來源留空。
- 快取位置：先用 Edge Function 內記憶體/meta-row 短 TTL；是否需 Postgres `disaster_events` 表視情況（避免過度設計）。
- 事件層警示色的確切色值（實作時與紙感風一起調，與壓力暖色階區隔）。
- 前端後端 URL 設定方式（環境變數 `VITE_DISASTERS_URL` 預設本地）。
