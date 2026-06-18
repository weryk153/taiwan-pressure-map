import { useTranslation } from 'react-i18next'
import { sortBySeverity } from '@/lib/disasters/group'
import { BY_CODE } from '@/lib/counties'
import type { DisasterEvent } from '@/lib/disasters/types'

const SEV_COLOR: Record<string, string> = { severe: '#a8322b', warning: '#b5732f', info: '#6f6657' }

/** 事件影響的縣市名（標注區域）；多縣市時顯示前兩個 + 其餘數量 */
function regionText(codes: string[]): string {
  const names = codes.map((c) => BY_CODE.get(c)?.name).filter(Boolean) as string[]
  if (names.length === 0) return '—'
  if (names.length <= 2) return names.join('、')
  return `${names[0]}、${names[1]} 等 ${names.length} 縣市`
}

interface Props {
  events: DisasterEvent[]
  showEvents: boolean
  onToggle: () => void
}

export function AlertsList({ events, showEvents, onToggle }: Props) {
  const { t } = useTranslation()
  const top = sortBySeverity(events).slice(0, 5)
  return (
    <div className="border-t border-[var(--color-ink)]/15 px-6 py-4 bg-[var(--color-paper)]">
      <div className="flex items-center justify-between mb-2.5">
        <div className="kicker">{t('events.title')}</div>
        <button
          onClick={onToggle}
          className={`text-[11px] transition ${showEvents ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-2)] hover:text-[var(--color-ink)]'}`}
        >
          {t('events.toggle')}
        </button>
      </div>
      {top.length === 0 ? (
        <p className="text-[12px] text-[var(--color-ink-2)]">{t('events.none')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {top.map((e) => (
            <li key={e.id} className="flex items-start gap-2 text-[12px]">
              <span className="mt-[5px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: SEV_COLOR[e.severity] }} />
              <div className="min-w-0">
                <div className="text-[var(--color-ink)] truncate">
                  {e.type === 'incident' && <span className="text-[var(--color-ink-2)]">[新聞] </span>}
                  {e.title}
                </div>
                <div className="text-[11px] text-[var(--color-ink-2)] truncate">{regionText(e.countyCodes)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
