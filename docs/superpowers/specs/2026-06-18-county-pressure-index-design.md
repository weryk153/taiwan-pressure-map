# 子專案 #2：縣市壓力指數（真實統計）— 設計文件

> 接續 #1 核心地圖地基。把 mock 指數換成真實政府開放統計。
> 後續：#3 即時災害（CWA/NCDR）、#4 人禍事件流（新聞/社群）。

## 目標

用**真實政府開放資料**算出每縣市的綜合壓力指數，取代 #1 的 deterministic mock。
五個子指標各對應一份政府統計，以**絕對參考門檻**正規化成 0–100，靜態快照打包進前端。

## 核心決策（brainstorm 拍板）

1. **自動抓、抓不到留空、不要 mock。** build 腳本嘗試抓每個指標；成功的轉真值，失敗的該指標**留空**（不以假資料填補）。
2. **絕對參考門檻正規化**（非相對 min-max）：每指標設定可信、可跨年比較、可校準的門檻；裁切到 0–100。
3. **靜態快照**：build 腳本產出 `public/taiwan-pressure.json` 並 committed；無後端（後端留給 #3/#4）。

## 架構與資料流

```
scripts/build-pressure.mjs (Node, 手動/CI 執行)
  └─ 對每個指標：fetch 政府開放資料 → 解析縣市別原始值
       → 臺/台 正規化、對到 COUNTYCODE → 絕對門檻正規化(0–100)
       → 產出 CountySignal + 來源 metadata；抓不到則該指標略過
  └─ 寫出 public/taiwan-pressure.json   ← committed 快照
        { signals: CountySignal[], sources: SourceMeta[], builtAt }

App
  useRiskData → fetch('/taiwan-pressure.json') → buildRiskData(signals)
  buildRiskData：只用真實訊號組 CountyRisk；缺的指標不計（權重重分配）
```

### 資料模型增修

```ts
// 既有 CountySignal 不變：{ code, metric, value(0–100), confidence(0–1), asOf, raw? }

interface SourceMeta {
  metric: MetricKey
  label: string            // 「失業率」
  agency: string           // 「主計總處」
  asOf: string             // 資料期，如 '2024' 或 '2024-Q3'
  status: 'live' | 'missing'
  url?: string
}

interface PressureData {
  signals: CountySignal[]
  sources: SourceMeta[]
  builtAt: string          // 快照建立時間（由腳本以實際時間戳寫入）
}

// CountyRisk 增修：允許「無資料」
interface CountyRisk {
  code: CountyCode
  name: string
  score: number | null     // 全部指標皆缺 → null（無資料）
  subScores: Partial<Record<MetricKey, number>>  // 只含有資料的指標
  confidence: number       // 有資料指標的平均；無資料 → 0
  asOf: string | null
  hasData: boolean
}
```

### buildRiskData 改寫（退役 mock）

- 不再呼叫 `buildMockSignals`。對每縣市：把該縣市的真實訊號依 metric 收集（多來源同 metric 取 MAX，沿用既有邏輯）。
- `subScores` 只含有訊號的指標；`score = calculateRiskScore(subScores)`（已支援缺值重正規化）。
- 若該縣市**零訊號** → `score=null, hasData=false, subScores={}`。
- `asOf` 取該縣市各訊號中最新者；無 → null。
- **`src/lib/mock.ts` 及其測試退役（刪除）**；`buildRiskData.test.ts` 改用真實訊號 fixture。
- `useRiskData` 改為先 fetch JSON 再 `buildRiskData(data.signals)`；JSON 載入失敗 → error 狀態（不 fallback mock）。

## 資料來源（實作時逐一驗證可得性）

| 指標 | metric | 來源 | 原始量 | 取得風險 |
|---|---|---|---|---|
| 經濟壓力 | economic | 主計總處／data.gov.tw | 縣市別失業率 % | 低 |
| 人口壓力 | demographic | 內政部戶政司 | 老化指數（老年/幼年×100） | 低 |
| 治安 | safety | 警政署／內政部統計 | 全般刑案發生數 → 件/十萬人（需人口） | 中 |
| 醫療資源 | healthcare | 衛福部 | 病床數 → 每萬人病床（需人口，**反向**） | 中 |
| 居住壓力 | housing | 內政部不動產資訊平台 季報 | 房價所得比（倍） | **高**（常為 Excel/HTML） |

- 治安、醫療需縣市別**人口數**（內政部戶政，易取）以計算率。
- 任一指標來源抓不到或解析失敗 → 該指標**所有縣市留空**，`SourceMeta.status='missing'`，UI 明確標示。腳本不可因單一來源失敗而中止其他來源。

## 絕對門檻正規化

`normalizeMetric(metric, raw)`：線性映射 [lo→0, hi→100]，裁切到 0–100；醫療為反向（少→壓力大）。

| 指標 | 0 分 (lo) | 100 分 (hi) | 方向 |
|---|---|---|---|
| economic 失業率 | 2.5% | 6.0% | 正 |
| housing 房價所得比 | 5 倍 | 17 倍 | 正 |
| demographic 老化指數 | 50 | 300 | 正 |
| safety 刑案率(件/十萬) | 800 | 2500 | 正 |
| healthcare 每萬人病床 | 80 床 | 20 床 | 反向（lo>hi） |

- 門檻為**先驗值**，集中定義於 `src/lib/normalize.ts` 的 `THRESHOLDS`，附註說明、可校準。
- 反向以 lo>hi 表達：`score = clamp01((raw - lo)/(hi - lo)) * 100`，當 hi<lo 自然反向。
- confidence：真實官方統計給較高值（如 0.85）；可依來源微調。

## 無資料處理（UI）

- **地圖**：無資料縣市填中性灰（如 `#d9d1c0`，紙感）＋細斜線 pattern；不參與色階。
- **排行榜**：無資料縣市分數顯示「—」，排在最後（或獨立分組）。
- **drawer**：總分顯示「無資料」；有資料的子指標照常，缺的子指標該列顯示「無資料」。
- **單一指標缺**（縣市有其他指標）：該子指標列顯示「無資料」，不影響總分（重正規化）。

## UI 變更

- **頭部**：`示範資料` 徽章 → 依實際狀態：全 live 顯示「真實統計」；部分缺顯示「部分指標」。仍標資料期。
- **資料來源 footnote 區塊**（編輯風，置於控制面板底部或 drawer 內）：逐列顯示 `指標 · 機關 · 資料期 · 狀態(已接/無資料)`，附 `builtAt`。強化「可信數據分析」定位。
- 著色維度、排行、drawer 子指標長條沿用 #1，加無資料樣式。

## 測試（Vitest）

- `normalizeMetric`：每指標 lo/hi 邊界、超界裁切、反向（healthcare）、中間值線性。
- `buildRiskData`（改寫後）：純真實訊號組成；單指標缺 → 重正規化；全缺 → `score=null, hasData=false`；多來源同 metric 取 MAX。
- 無資料判定：零訊號縣市 `hasData=false`。
- build 腳本的**純函式**（解析 CSV→縣市值、臺/台＋COUNTYCODE 對應、率計算）以樣本 fixture 測試；網路 fetch 不在單元測試內。
- 既有測試：移除 `mock.test.ts`；調整 `buildRiskData.test.ts`。

## 範圍（YAGNI）

**做**：build 腳本 + 五指標抓取/正規化（能抓多少算多少）、絕對門檻正規化、buildRiskData 改寫、無資料狀態、資料來源 footnote、測試。

**不做**（留後續）：即時資料、後端、災害/人禍事件（#3/#4）、自動排程更新（手動跑腳本即可）、門檻的統計校準（先用先驗值）。

## 未定／實作時確認

- 各來源實際的穩定 URL／格式（CSV vs Excel vs HTML vs data.gov.tw API）—— 實作第一步「資料探勘」逐一確認；抓不到的依「留空」處理。
- 房價所得比若僅 Excel/HTML：嘗試解析；不行則該指標留空。
- 門檻數值依抓到的真實分佈微調（仍維持絕對門檻精神，記錄於 spec/程式註解）。
- 刑案「全般刑案」vs 特定類別的定義；以來源提供的總數為準並註明。
