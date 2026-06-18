// 時區工具：台灣資料一律以 Asia/Taipei 解讀與顯示，部署到任何時區都一致。
const TPE = 'Asia/Taipei'

/**
 * 解析時間字串為 ms epoch；**無時區標記的 ISO 字串視為台灣時間（+08:00）**。
 * - 已帶時區（Z / ±hh:mm）或 RFC822（含 GMT）→ 原樣交給 Date.parse。
 * - 無法解析 → NaN。
 */
export function parseTaiwanTime(s: string): number {
  if (!s) return NaN
  const str = String(s).trim()
  // 純 ISO 日期時間（空格或 T 分隔、無時區）→ 視為台灣時間 +08:00。
  // 已帶時區（Z/±hh:mm）、RFC822（含 GMT）等則原樣解析。
  const m = str.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/)
  if (m) return Date.parse(`${m[1]}T${m[2]}+08:00`)
  return Date.parse(str)
}

/** 顯示用：任何有效時間 → 台灣時間「MM-DD HH:mm」（24 小時制）。無法解析則原樣回傳。 */
export function formatTaipei(time: string | undefined | null): string {
  if (!time) return ''
  const t = Date.parse(time)
  if (Number.isNaN(t)) return String(time)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TPE,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(t))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}
