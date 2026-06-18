import { useTranslation } from 'react-i18next'
import { sortBySeverity } from '@/lib/disasters/group'
import type { DisasterEvent } from '@/lib/disasters/types'

const SEV_COLOR: Record<string, string> = { severe: '#a8322b', warning: '#b5732f', info: '#6f6657' }

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
            <li key={e.id} className="flex items-center gap-2 text-[12px]">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: SEV_COLOR[e.severity] }} />
              <span className="flex-1 text-[var(--color-ink)] truncate">{e.title}</span>
              <span className="text-[var(--color-ink-2)] font-display">{e.countyCodes.length}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
