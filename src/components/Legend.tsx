import { useTranslation } from 'react-i18next'
import { scoreColor } from '@/lib/colors'

export function Legend() {
  const { t } = useTranslation()
  const ramp = [0, 20, 40, 60, 80, 100]
  return (
    <div className="absolute bottom-5 left-5 bg-[var(--color-paper)]/85 backdrop-blur-sm border border-[var(--color-ink)]/15 rounded-sm px-3.5 py-2.5">
      <div className="kicker mb-2">{t('legend.title')}</div>
      <div className="flex h-2 w-44 rounded-sm overflow-hidden">
        {ramp.map((s) => (
          <div key={s} className="flex-1" style={{ background: scoreColor(s) }} />
        ))}
      </div>
      <div className="flex justify-between font-display text-[10px] text-[var(--color-ink-2)] mt-1 tabular-nums">
        <span>0 低</span>
        <span>100 危急</span>
      </div>
    </div>
  )
}
