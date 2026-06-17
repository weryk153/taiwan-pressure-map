import { useTranslation } from 'react-i18next'
import { scoreColor } from '@/lib/colors'

export function Legend() {
  const { t } = useTranslation()
  // 連續色帶 + 兩端標記；圓越大＝壓力越高
  const ramp = [0, 20, 40, 60, 80, 100]
  return (
    <div className="absolute bottom-4 left-4 bg-[var(--color-panel)]/85 backdrop-blur-sm border border-[var(--color-edge)] rounded-md px-3 py-2.5">
      <div className="section-label font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)] mb-2">
        {t('legend.title')}
      </div>
      <div className="flex h-1.5 w-40 rounded-full overflow-hidden">
        {ramp.map((s) => (
          <div key={s} className="flex-1" style={{ background: scoreColor(s) }} />
        ))}
      </div>
      <div className="flex justify-between font-mono text-[9px] text-white/40 mt-1">
        <span>0 低</span>
        <span>100 危急</span>
      </div>
    </div>
  )
}
