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
  const valueFor = (r: CountyRisk) => (colorBy === 'composite' ? r.score : r.subScores[colorBy])
  const ranked = [...risks].sort((a, b) => valueFor(b) - valueFor(a))

  return (
    <aside className="w-72 shrink-0 h-full overflow-y-auto bg-[var(--color-panel)] border-r border-[var(--color-edge)] p-4 flex flex-col gap-5">
      <div>
        <h2 className="section-label font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)] mb-2.5">
          {t('panel.colorBy')}
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => (
            <button
              key={o}
              onClick={() => onColorBy(o)}
              className={`px-2.5 py-1 rounded text-xs transition border ${
                colorBy === o
                  ? 'bg-[var(--color-accent)] text-black border-transparent font-medium'
                  : 'bg-transparent text-[var(--color-muted)] border-[var(--color-edge)] hover:text-[var(--color-ink)] hover:border-white/25'
              }`}
            >
              {t(`metrics.${o}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1">
        <h2 className="section-label font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)] mb-2">
          {t('panel.ranking')}
        </h2>
        <ol className="flex flex-col">
          {ranked.map((r, i) => {
            const v = valueFor(r)
            const active = selectedCode === r.code
            return (
              <li key={r.code}>
                <button
                  onClick={() => onSelect(r.code)}
                  className={`group w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-left text-sm transition ${
                    active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="font-mono text-[11px] w-4 text-right text-white/30 tabular-nums">{i + 1}</span>
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: scoreColor(v) }}
                  />
                  <span className={`flex-1 ${active ? 'text-[var(--color-ink)]' : 'text-white/80'}`}>{r.name}</span>
                  <span className="font-mono w-8 text-right tabular-nums font-medium" style={{ color: scoreColor(v) }}>
                    {v}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </aside>
  )
}
