// disasters — 薄 proxy：藏 CWA key、加 CORS、短 TTL 快取，回原始合併 JSON。
// 解析成 DisasterEvent 在前端（src/lib/disasters/parse.ts）。
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CWA = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore'
// NCDR 災防告警公開資料（CAP/ATOM）。實際端點/格式於真實驗證時確認。
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

  if (cache && Date.now() - cache.at < TTL) {
    return new Response(cache.body, { headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const key = Deno.env.get('CWA_KEY') ?? ''
  const eq = key ? await getJson(`${CWA}/E-A0015-001?Authorization=${key}&format=JSON`) : null
  const weather = key ? await getJson(`${CWA}/W-C0033-001?Authorization=${key}&format=JSON`) : null
  const capText = await getText(NCDR_URL)
  // NCDR 回傳 ATOM-JSON（{entry:[...]}）；parse 後原樣帶給前端 parseCapAlerts。
  let cap: unknown | null = null
  if (capText) {
    try {
      cap = JSON.parse(capText)
    } catch {
      cap = null
    }
  }

  const body = {
    eq,
    weather,
    cap,
    fetchedAt: new Date().toISOString(),
    sources: {
      eq: eq ? 'ok' : 'error',
      weather: weather ? 'ok' : 'error',
      cap: cap ? 'ok' : 'error',
    },
  }
  const text = JSON.stringify(body)
  cache = { at: Date.now(), body: text }
  return new Response(text, { headers: { ...cors, 'Content-Type': 'application/json' } })
})
