import { useTranslation } from 'react-i18next'
import type { SourceMeta } from '@/lib/types'

interface Props {
  sources: SourceMeta[]
  builtAt: string
}

export function DataSources({ sources, builtAt }: Props) {
  const { t } = useTranslation()
  return (
    <div className="border-t border-[var(--color-ink)]/15 px-6 py-4 bg-[var(--color-paper)]">
      <div className="kicker mb-2.5">{t('sources.title')}</div>
      <ul className="flex flex-col gap-1.5">
        {sources.map((s) => (
          <li key={s.metric} className="flex items-baseline justify-between text-[12px]">
            <span className="text-[var(--color-ink)]">{s.label}</span>
            <span className="text-[var(--color-ink-2)] font-display tabular-nums">
              {s.agency} · {s.status === 'live' ? `${s.asOf}` : t('sources.missing')}
            </span>
          </li>
        ))}
      </ul>
      <div className="text-[10px] text-[var(--color-ink-2)]/70 mt-2.5">
        {t('sources.builtAt')} {builtAt.slice(0, 10)}
      </div>
    </div>
  )
}
