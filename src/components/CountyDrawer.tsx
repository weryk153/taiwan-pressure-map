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
  const radarData = METRIC_KEYS.map((k) => ({
    metric: t(`metrics.${k}`),
    value: risk.subScores[k],
  }))

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-[var(--color-panel)] border-l border-white/10 p-5 overflow-y-auto shadow-2xl">
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-xl font-semibold">{risk.name}</h2>
        <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none">✕</button>
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-4xl font-bold tabular-nums" style={{ color: scoreColor(risk.score) }}>
          {risk.score}
        </span>
        <span className="text-sm text-white/60">{t('drawer.score')} · {LEVEL_LABEL[level]}</span>
      </div>
      <p className="text-xs text-white/40 mb-5">
        {t('drawer.confidence')}: {Math.round(risk.confidence * 100)}% · {t('drawer.asOf')}: {risk.asOf}
      </p>

      <h3 className="text-xs uppercase tracking-wide text-white/50 mb-1">{t('drawer.subScores')}</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} outerRadius="70%">
            <PolarGrid stroke="#ffffff20" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: '#ffffff99', fontSize: 11 }} />
            <Radar dataKey="value" stroke="var(--color-accent)" fill="var(--color-accent)" fillOpacity={0.4} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <h3 className="text-xs uppercase tracking-wide text-white/50 mb-1 mt-4">{t('drawer.events')}</h3>
      <p className="text-sm text-white/40">{t('drawer.noEvents')}</p>
    </div>
  )
}
