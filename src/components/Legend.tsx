import { useTranslation } from 'react-i18next'
import { scoreColor } from '@/lib/colors'

export function Legend() {
  const { t } = useTranslation()
  const stops = [0, 25, 50, 75, 100]
  return (
    <div className="absolute bottom-4 left-80 ml-4 bg-[var(--color-panel)]/90 border border-white/10 rounded-lg p-3">
      <div className="text-xs text-white/60 mb-1.5">{t('legend.title')}</div>
      <div className="flex items-center gap-0.5">
        {stops.map((s) => (
          <div key={s} className="flex flex-col items-center">
            <div className="w-8 h-3" style={{ background: scoreColor(s) }} />
            <span className="text-[10px] text-white/40 mt-0.5">{s}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
