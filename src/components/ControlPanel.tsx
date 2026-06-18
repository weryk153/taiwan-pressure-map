import { scoreColor } from '@/lib/colors'
import { type CountyRisk, type MetricKey } from '@/lib/types'

type ColorBy = 'composite' | MetricKey

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
