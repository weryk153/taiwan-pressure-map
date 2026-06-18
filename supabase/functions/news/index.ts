// news — 薄 proxy（無需 key）：對人禍類別查 Google News RSS、回原始 XML + CORS + 快取。
// 解析（標題掃縣市/分類/去重/近48h）在前端 src/lib/incidents/parse.ts。
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 與前端 src/lib/incidents/categories.ts 對應（key/query 需同步維護）
const CATEGORIES: { key: string; query: string }[] = [
  { key: 'fire', query: '火災' },
  { key: 'crash', query: '車禍 OR 死亡車禍' },
  { key: 'homicide', query: '命案 OR 兇殺' },
  { key: 'shooting', query: '槍擊' },
  { key: 'industrial', query: '工安意外 OR 墜樓意外' },
  { key: 'explosion', query: '氣爆 OR 爆炸' },
]

function rssUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`
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
  // 只在全部類別都成功時才快取，避免把降級結果快取 10 分鐘
  if (feeds.length === CATEGORIES.length) cache = { at: Date.now(), body }
  return new Response(body, { headers: { ...cors, 'Content-Type': 'application/json' } })
})
