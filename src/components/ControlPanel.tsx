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
    <aside className="w-72 shrink-0 h-full overflow-y-auto bg-[var(--color-panel)] border-r border-white/10 p-4 flex flex-col gap-4">
      <div>
        <h2 className="text-xs uppercase tracking-wide text-white/50 mb-2">{t('panel.colorBy')}</h2>
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => (
            <button
              key={o}
              onClick={() => onColorBy(o)}
              className={`px-2.5 py-1 rounded text-sm transition ${
                colorBy === o ? 'bg-[var(--color-accent)] text-black' : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              {t(`metrics.${o}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1">
        <h2 className="text-xs uppercase tracking-wide text-white/50 mb-2">{t('panel.ranking')}</h2>
        <ol className="flex flex-col gap-1">
          {ranked.map((r, i) => (
            <li key={r.code}>
              <button
                onClick={() => onSelect(r.code)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition ${
                  selectedCode === r.code ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <span className="w-5 text-white/40 tabular-nums">{i + 1}</span>
                <span className="flex-1">{r.name}</span>
                <span
                  className="w-9 text-right tabular-nums font-medium"
                  style={{ color: scoreColor(valueFor(r)) }}
                >
                  {valueFor(r)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  )
}
