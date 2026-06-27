import { scoreColor } from '@/lib/colors'
import { METRIC_KEYS, type CountyRisk, type MetricKey } from '@/lib/types'

type ColorBy = 'composite' | MetricKey

// 缺幾項指標（離島常缺房價所得比、每戶可支配所得）→ 分數僅供參考
const missingCount = (r: CountyRisk): number =>
  METRIC_KEYS.filter((k) => r.subScores[k] == null).length

interface Props {
  risks: CountyRisk[]
  colorBy: ColorBy
  selectedCode: string | null
  onSelect: (code: string) => void
}

export function ControlPanel({ risks, colorBy, selectedCode, onSelect }: Props) {
  const valueFor = (r: CountyRisk): number | null =>
    colorBy === 'composite' ? r.score : (r.subScores[colorBy] ?? null)
  const ranked = [...risks].sort((a, b) => {
    const av = valueFor(a)
    const bv = valueFor(b)
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    return bv - av
  })

  return (
    <div className="px-6 py-5 bg-[var(--color-paper)] rise">
      <div className="kicker mb-1">縣市排行</div>
      <ol aria-label="縣市排行">
        {ranked.map((r, i) => {
          const v = valueFor(r)
          const active = selectedCode === r.code
          return (
            <li key={r.code} className="border-b border-[var(--color-ink)]/10 last:border-0">
              <button
                onClick={() => onSelect(r.code)}
                className="group w-full flex items-center gap-3 py-2 text-left transition-colors"
              >
                <span className="font-display text-xs w-5 text-right text-[var(--color-ink-2)]/60 tabular-nums">
                  {i + 1}
                </span>
                <span
                  className={`flex-1 text-[15px] transition-colors ${
                    active ? 'text-[var(--color-accent)] font-medium' : 'text-[var(--color-ink)] group-hover:text-[var(--color-accent)]'
                  }`}
                >
                  {r.name}
                  {missingCount(r) > 0 && (
                    <span
                      className="ml-1.5 align-middle text-[10px] text-[var(--color-ink-2)]/70 border border-[var(--color-ink)]/20 rounded-sm px-1 py-px whitespace-nowrap"
                      title={`有 ${missingCount(r)} 項指標未發布（離島部分統計從缺），分數僅供參考`}
                    >
                      資料不全
                    </span>
                  )}
                </span>
                <span className="w-16 h-[3px] rounded-full bg-[var(--color-ink)]/10 relative overflow-hidden">
                  {v !== null && (
                    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${v}%`, background: scoreColor(v) }} />
                  )}
                </span>
                {v === null ? (
                  <span className="font-display text-[15px] w-7 text-right text-[var(--color-ink-2)]">—</span>
                ) : (
                  <span className="font-display text-[15px] w-7 text-right tabular-nums" style={{ color: scoreColor(v) }}>{v}</span>
                )}
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
