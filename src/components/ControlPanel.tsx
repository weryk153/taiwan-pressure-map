import { useTranslation } from 'react-i18next'
import { scoreColor } from '@/lib/colors'
import { METRIC_KEYS, type CountyRisk, type MetricKey } from '@/lib/types'

type ColorBy = 'composite' | MetricKey

interface Props {
  risks: CountyRisk[]
  colorBy: ColorBy
  onColorBy: (c: ColorBy) => void
  selectedCode: string | null
  onSelect: (code: string) => void
}

export function ControlPanel({ risks, colorBy, onColorBy, selectedCode, onSelect }: Props) {
  const { t } = useTranslation()
  const options: ColorBy[] = ['composite', ...METRIC_KEYS]
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
    <div className="px-6 py-5 flex flex-col gap-7 bg-[var(--color-paper)] rise">
      <div>
        <div className="kicker mb-3">著色維度</div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {options.map((o) => (
            <button
              key={o}
              onClick={() => onColorBy(o)}
              className={`text-sm pb-0.5 border-b transition ${
                colorBy === o
                  ? 'border-[var(--color-accent)] text-[var(--color-accent)] font-medium'
                  : 'border-transparent text-[var(--color-ink-2)] hover:text-[var(--color-ink)]'
              }`}
            >
              {t(`metrics.${o}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1">
        <div className="kicker mb-1">縣市排行</div>
        <ol>
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
    </div>
  )
}
