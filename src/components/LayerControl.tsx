import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Legend } from './Legend'
import { METRIC_KEYS, type MetricKey } from '@/lib/types'
import type { DisasterEvent, DisasterType } from '@/lib/disasters/types'

type ColorBy = 'composite' | MetricKey

// 事件圖層的顯示順序與代表色（依嚴重度語意，與地圖圓點一致）
const LAYER_ORDER: { type: DisasterType; color: string }[] = [
  { type: 'incident', color: '#b5732f' },
  { type: 'alert', color: '#a8322b' },
  { type: 'weather', color: '#c47e3c' },
  { type: 'earthquake', color: '#6f6657' },
]

interface Props {
  colorBy: ColorBy
  onColorBy: (c: ColorBy) => void
  events: DisasterEvent[]
  layers: Set<DisasterType>
  onToggleLayer: (t: DisasterType) => void
}

/** 地圖左上的浮動圖層面板：上＝壓力維度（單選），下＝事件圖層（多選）。 */
export function LayerControl({ colorBy, onColorBy, events, layers, onToggleLayer }: Props) {
  const { t } = useTranslation()
  // 桌機預設展開；手機預設收合（避免面板蓋住整張地圖）
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 768)
  const dims: ColorBy[] = ['composite', ...METRIC_KEYS]
  const counts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="absolute top-5 left-5 w-[200px] max-h-[calc(100vh-7rem)] flex flex-col bg-[var(--color-paper)]/90 backdrop-blur-sm border border-[var(--color-ink)]/15 rounded-sm shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="shrink-0 w-full flex items-center px-3.5 pt-2.5 pb-2 select-none"
        aria-expanded={open}
      >
        <span className="kicker">地圖顯示</span>
        <span className={`ml-auto text-[var(--color-ink-2)] text-[10px] transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
      </button>

      {open && (
        <div className="flex-1 min-h-0 overflow-y-auto px-3.5 pb-3">
          <div className="kicker mb-2 text-[var(--color-ink-2)]/80">{t('panel.colorBy')}</div>
          <ul className="flex flex-col">
            {dims.map((d) => {
              const on = colorBy === d
              return (
                <li key={d}>
                  <button
                    onClick={() => onColorBy(d)}
                    className="group w-full flex items-center gap-2 py-[3px] text-left"
                    aria-pressed={on}
                  >
                    <span className={`shrink-0 w-3 h-3 rounded-full border flex items-center justify-center transition ${on ? 'border-[var(--color-accent)]' : 'border-[var(--color-ink)]/30'}`}>
                      {on && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />}
                    </span>
                    <span className={`text-[13px] transition-colors ${on ? 'text-[var(--color-accent)] font-medium' : 'text-[var(--color-ink-2)] group-hover:text-[var(--color-ink)]'}`}>
                      {t(`metrics.${d}`)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="border-t border-[var(--color-ink)]/12 mt-2.5 pt-2.5">
            <div className="kicker mb-2 text-[var(--color-ink-2)]/80">{t('layers.title')}</div>
            <ul className="flex flex-col">
              {LAYER_ORDER.map(({ type, color }) => {
                const on = layers.has(type)
                const n = counts[type] ?? 0
                return (
                  <li key={type}>
                    <button
                      onClick={() => onToggleLayer(type)}
                      className="group w-full flex items-center gap-2 py-[3px] text-left"
                      aria-pressed={on}
                    >
                      <span className={`shrink-0 w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition ${on ? 'border-[var(--color-ink)]/60 bg-[var(--color-ink)]/[0.06]' : 'border-[var(--color-ink)]/25'}`}>
                        {on && (
                          <svg viewBox="0 0 12 12" className="w-[11px] h-[11px]" style={{ color }} aria-hidden>
                            <path d="M2.5 6.2l2.3 2.3 4.7-4.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color, opacity: on ? 1 : 0.35 }} />
                      <span className={`flex-1 text-[13px] transition-colors ${on ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-2)]'}`}>
                        {t(`layers.${type}`)}
                      </span>
                      <span className="font-display text-[12px] tabular-nums text-[var(--color-ink-2)]/70">{n}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
      {open && <Legend />}
    </div>
  )
}
