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

      <div className="kicker mt-3 mb-2">即時事件</div>
      <div className="flex flex-col gap-1.5 text-[11px] text-[var(--color-ink-2)]">
        <div className="flex items-center gap-2">
          <svg width="22" height="14" viewBox="0 0 22 14" className="shrink-0">
            <circle cx="11" cy="7" r="6" fill="#1f6f8b" fillOpacity="0.25" stroke="#1f6f8b" strokeWidth="1.5" />
          </svg>
          <span>地震（圈大小＝規模）</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="22" height="14" viewBox="0 0 22 14" className="shrink-0">
            <line x1="1" y1="7" x2="21" y2="7" stroke="#1f6f8b" strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          <span>嚴重告警縣市</span>
        </div>
      </div>
    </div>
  )
}
