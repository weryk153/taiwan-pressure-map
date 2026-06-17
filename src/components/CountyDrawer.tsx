import { useTranslation } from 'react-i18next'
import { scoreColor, LEVEL_LABEL } from '@/lib/colors'
import { toRiskLevel } from '@/lib/score'
import { METRIC_KEYS, type CountyRisk } from '@/lib/types'

interface Props {
  risk: CountyRisk | null
  onClose: () => void
}

export function CountyDrawer({ risk, onClose }: Props) {
  const { t } = useTranslation()
  if (!risk) return null

  const level = toRiskLevel(risk.score)
  const color = scoreColor(risk.score)

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-[var(--color-panel)]/95 backdrop-blur-md border-l border-[var(--color-edge)] p-5 overflow-y-auto">
      <div className="flex items-start justify-between mb-6">
        <h2 className="text-xl font-bold tracking-wide">{risk.name}</h2>
        <button
          onClick={onClose}
          className="text-white/35 hover:text-white text-base leading-none mt-1 transition"
          aria-label="關閉"
        >
          ✕
        </button>
      </div>

      <div className="flex items-end gap-3 mb-1.5">
        <span className="font-mono text-[56px] font-semibold tabular-nums leading-[0.85]" style={{ color }}>
          {risk.score}
        </span>
        <span
          className="mb-1.5 font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 rounded"
          style={{ background: `${color}22`, color }}
        >
          {LEVEL_LABEL[level]}
        </span>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-wide text-white/35 mb-7">
        {t('drawer.score')} · {t('drawer.confidence')} {Math.round(risk.confidence * 100)}% · {risk.asOf}
      </p>

      <h3 className="section-label font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)] mb-3">
        {t('drawer.subScores')}
      </h3>
      <div className="flex flex-col gap-2.5 mb-7">
        {METRIC_KEYS.map((k) => {
          const v = risk.subScores[k]
          return (
            <div key={k} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs text-white/65">{t(`metrics.${k}`)}</span>
              <span className="flex-1 h-[5px] rounded-full bg-white/[0.06] overflow-hidden">
                <span
                  className="block h-full rounded-full transition-all"
                  style={{ width: `${v}%`, background: scoreColor(v) }}
                />
              </span>
              <span
                className="font-mono text-xs tabular-nums w-6 text-right"
                style={{ color: scoreColor(v) }}
              >
                {v}
              </span>
            </div>
          )
        })}
      </div>

      <h3 className="section-label font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)] mb-2">
        {t('drawer.events')}
      </h3>
      <p className="text-sm text-white/35">{t('drawer.noEvents')}</p>
    </div>
  )
}
