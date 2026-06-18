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
  activeId?: string | null
  onSelectEvent?: (e: DisasterEvent) => void
}

export function AlertsList({ events, activeId, onSelectEvent }: Props) {
  const { t } = useTranslation()
  const top = sortBySeverity(events).slice(0, 5)
  return (
    <div className="border-t border-[var(--color-ink)]/15 px-6 py-4 bg-[var(--color-paper)]">
      <div className="kicker mb-2.5">{t('events.title')}</div>
      {top.length === 0 ? (
        <p className="text-[12px] text-[var(--color-ink-2)]">{t('events.none')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {top.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => onSelectEvent?.(e)}
                className={`group w-full flex items-start gap-2 text-[12px] text-left rounded-sm px-1 -mx-1 py-0.5 transition ${
                  activeId === e.id ? 'bg-[#1f6f8b]/12' : 'hover:bg-[var(--color-ink)]/[0.04]'
                }`}
                title="在地圖上高亮此事件影響的縣市"
              >
                <span className="mt-[5px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: SEV_COLOR[e.severity] }} />
                <div className="min-w-0">
                  <div className={`truncate ${activeId === e.id ? 'text-[#1a5566] font-medium' : 'text-[var(--color-ink)]'}`}>
                    {e.type === 'incident' && <span className="text-[var(--color-ink-2)]">[重大新聞] </span>}
                    {e.title}
                  </div>
                  <div className="text-[11px] text-[var(--color-ink-2)] truncate">{regionText(e.countyCodes)}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
