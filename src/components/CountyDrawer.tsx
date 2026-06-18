import { useTranslation } from 'react-i18next'
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { scoreColor, LEVEL_LABEL } from '@/lib/colors'
import { toRiskLevel } from '@/lib/score'
import { METRIC_KEYS, type CountyRisk, type PressurePeriod } from '@/lib/types'
import type { DisasterEvent } from '@/lib/disasters/types'

const SEV_COLOR: Record<string, string> = { severe: '#a8322b', warning: '#b5732f', info: '#6f6657' }

interface Props {
  risk: CountyRisk | null
  onClose: () => void
  events?: DisasterEvent[]
  history?: PressurePeriod[]
}

export function CountyDrawer({ risk, onClose, events, history }: Props) {
  const { t } = useTranslation()
  if (!risk) return null

  const has = risk.score !== null

  const series = (history ?? [])
    .map((p) => ({ asOf: p.asOf.slice(5), score: p.scores[risk.code] }))
    .filter((d): d is { asOf: string; score: number } => d.score != null)

  return (
    <div
      key={risk.code}
      className="absolute top-0 right-0 h-full w-full md:w-[21rem] z-10 bg-[var(--color-paper)] border-l border-[var(--color-ink)]/15 px-6 py-6 overflow-y-auto rise"
    >
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="kicker mb-1.5">縣市檔案</div>
          <h2 className="font-serif text-2xl font-bold tracking-tight">{risk.name}</h2>
        </div>
        <button
          onClick={onClose}
          className="text-[var(--color-ink-2)] hover:text-[var(--color-ink)] text-base leading-none mt-1 transition"
          aria-label="關閉"
        >
          ✕
        </button>
      </div>

      {has ? (
        <div className="flex items-end gap-3 border-b border-[var(--color-ink)]/15 pb-5 mb-2">
          <span className="font-display text-[68px] leading-[0.78] font-semibold tabular-nums" style={{ color: scoreColor(risk.score!) }}>
            {risk.score}
          </span>
          <div className="mb-1.5">
            <div className="text-sm font-medium" style={{ color: scoreColor(risk.score!) }}>{LEVEL_LABEL[toRiskLevel(risk.score!)]}</div>
            <div className="text-xs text-[var(--color-ink-2)]">{t('drawer.score')}</div>
          </div>
        </div>
      ) : (
        <div className="border-b border-[var(--color-ink)]/15 pb-5 mb-2">
          <span className="font-serif text-3xl text-[var(--color-ink-2)]">{t('drawer.noData')}</span>
        </div>
      )}
      {has && (
        <p className="text-xs text-[var(--color-ink-2)] mb-7">
          {t('drawer.confidence')} {Math.round(risk.confidence * 100)}% · {t('drawer.asOf')} {risk.asOf}
        </p>
      )}

      <div className="kicker mb-4">{t('drawer.subScores')}</div>
      <div className="flex flex-col gap-3 mb-8">
        {METRIC_KEYS.map((k) => {
          const v = risk.subScores[k]
          if (v === undefined) {
            return (
              <div key={k} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-[13px] text-[var(--color-ink-2)]">{t(`metrics.${k}`)}</span>
                <span className="flex-1" />
                <span className="font-display text-[13px] text-right text-[var(--color-ink-2)]">{t('drawer.noData')}</span>
              </div>
            )
          }
          return (
            <div key={k} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-[13px] text-[var(--color-ink-2)]">{t(`metrics.${k}`)}</span>
              <span className="flex-1 h-[5px] rounded-full bg-[var(--color-ink)]/10 overflow-hidden">
                <span
                  className="block h-full rounded-full transition-all"
                  style={{ width: `${v}%`, background: scoreColor(v) }}
                />
              </span>
              <span className="font-display text-sm tabular-nums w-6 text-right" style={{ color: scoreColor(v) }}>
                {v}
              </span>
            </div>
          )
        })}
      </div>

      <div className="kicker mb-2">趨勢</div>
      <div className="mb-8">
        {series.length >= 2 ? (
          <div className="-ml-2">
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
                <XAxis
                  dataKey="asOf"
                  tick={{ fontSize: 10, fill: 'var(--color-ink-2)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-ink)', strokeOpacity: 0.15 }}
                />
                <YAxis domain={[0, 100]} hide />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  dot={{ r: 2, fill: 'var(--color-accent)' }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div>
            {series.length === 1 && (
              <span className="font-display text-2xl tabular-nums" style={{ color: scoreColor(series[0].score) }}>
                {series[0].score}
              </span>
            )}
            <p className="text-xs text-[var(--color-ink-2)] mt-1">資料 {series.length} 期（累積中）</p>
          </div>
        )}
        <p className="text-[11px] text-[var(--color-ink-2)] font-display mt-2">共 {series.length} 期</p>
      </div>

      <div className="kicker mb-2">{t('drawer.events')}</div>
      {(!events || events.length === 0) ? (
        <p className="text-sm text-[var(--color-ink-2)]">{t('drawer.noEvents')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-2 text-sm">
              <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: SEV_COLOR[e.severity] }} />
              <div>
                <div>
                  {e.url ? (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--color-ink)] underline decoration-[var(--color-ink-2)]/40 hover:decoration-[var(--color-accent)] hover:text-[var(--color-accent)] transition"
                    >
                      {e.title}
                    </a>
                  ) : (
                    <span className="text-[var(--color-ink)]">{e.title}</span>
                  )}
                </div>
                <div className="text-[11px] text-[var(--color-ink-2)] font-display">
                  {(e.source === 'NEWS' && (e.raw as any)?.source) ? (e.raw as any).source : e.source} · {e.time?.slice(5, 16).replace('T', ' ')}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
