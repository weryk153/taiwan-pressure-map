import { useTranslation } from 'react-i18next'
import { scoreColor, NO_DATA_COLOR } from '@/lib/colors'

export function Legend() {
  const { t } = useTranslation()
  const ramp = [0, 20, 40, 60, 80, 100]
  return (
    <div className="shrink-0 border-t border-[var(--color-ink)]/12 px-3.5 pt-2.5 pb-3">
      <div className="kicker mb-2">{t('legend.title')}</div>
      <div className="flex h-2 w-full rounded-sm overflow-hidden">
        {ramp.map((s) => (
          <div key={s} className="flex-1" style={{ background: scoreColor(s) }} />
        ))}
      </div>
      <div className="flex justify-between font-display text-[10px] text-[var(--color-ink-2)] mt-1 tabular-nums">
        <span>0 低</span>
        <span>100 危急</span>
      </div>
      <div className="flex items-center gap-2 mt-2 text-[11px] text-[var(--color-ink-2)]">
        <span className="w-3.5 h-2.5 rounded-sm shrink-0" style={{ background: NO_DATA_COLOR }} />
        <span>無資料（該指標未發布）</span>
      </div>

      <div className="kicker mt-3 mb-2">即時事件</div>
      <div className="flex flex-col gap-1.5 text-[11px] text-[var(--color-ink-2)]">
        <div className="flex items-center gap-2">
          <svg width="22" height="14" viewBox="0 0 22 14" className="shrink-0">
            <rect x="2" y="2.5" width="18" height="9" rx="1.5" fill="none" stroke="#13556b" strokeWidth="1.4" />
          </svg>
          <span>事件縣市（青色細框）</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="22" height="14" viewBox="0 0 22 14" className="shrink-0">
            <line x1="1" y1="7" x2="21" y2="7" stroke="#a8322b" strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          <span>點選事件高亮的縣市</span>
        </div>
      </div>
    </div>
  )
}
