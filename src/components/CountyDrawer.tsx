import { useTranslation } from 'react-i18next'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from 'recharts'
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
  const radarData = METRIC_KEYS.map((k) => ({
    metric: t(`metrics.${k}`),
    value: risk.subScores[k],
  }))

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-[var(--color-panel)]/95 backdrop-blur-sm border-l border-[var(--color-edge)] p-5 overflow-y-auto">
      <div className="flex items-start justify-between mb-5">
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
        <span className="font-mono text-5xl font-semibold tabular-nums leading-none" style={{ color }}>
          {risk.score}
        </span>
        <span
          className="mb-1 font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 rounded"
          style={{ background: `${color}22`, color }}
        >
          {LEVEL_LABEL[level]}
        </span>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-wide text-white/35 mb-6">
        {t('drawer.score')} · {t('drawer.confidence')} {Math.round(risk.confidence * 100)}% · {risk.asOf}
      </p>

      <h3 className="section-label font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)] mb-1">
        {t('drawer.subScores')}
      </h3>
      <div className="h-56 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} outerRadius="68%">
            <PolarGrid stroke="#ffffff18" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: '#ffffff88', fontSize: 11 }} />
            <Radar dataKey="value" stroke="var(--color-accent)" fill="var(--color-accent)" fillOpacity={0.35} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <h3 className="section-label font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)] mb-1.5 mt-5">
        {t('drawer.events')}
      </h3>
      <p className="text-sm text-white/35">{t('drawer.noEvents')}</p>
    </div>
  )
}
