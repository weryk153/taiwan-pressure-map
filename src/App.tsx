import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapView } from '@/components/MapView'
import { ControlPanel } from '@/components/ControlPanel'
import { LayerControl } from '@/components/LayerControl'
import { CountyDrawer } from '@/components/CountyDrawer'
import { DataSources } from '@/components/DataSources'
import { AlertsList } from '@/components/AlertsList'
import { Methodology } from '@/components/Methodology'
import { useRiskData } from '@/hooks/useRiskData'
import { useDisasterEvents } from '@/hooks/useDisasterEvents'
import { useIncidents } from '@/hooks/useIncidents'
import { eventsByCounty } from '@/lib/disasters/group'
import type { MetricKey } from '@/lib/types'
import type { DisasterType, Severity } from '@/lib/disasters/types'

type ColorBy = 'composite' | MetricKey

const ALL_LAYERS: DisasterType[] = ['incident', 'alert', 'weather', 'earthquake']
const SEV_RANK: Record<Severity, number> = { severe: 0, warning: 1, info: 2 }

export default function App() {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useRiskData()
  const { data: events = [] } = useDisasterEvents()
  const { data: incidents = [] } = useIncidents()
  const allEvents = useMemo(() => [...events, ...incidents], [events, incidents])
  const [colorBy, setColorBy] = useState<ColorBy>('composite')
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [highlight, setHighlight] = useState<{ id: string; codes: string[] } | null>(null)
  const [layers, setLayers] = useState<Set<DisasterType>>(() => new Set(ALL_LAYERS))

  const risks = data?.risks
  const allLive = data ? data.sources.every((s) => s.status === 'live') : false
  const selected = useMemo(
    () => risks?.find((r) => r.code === selectedCode) ?? null,
    [risks, selectedCode],
  )
  const byCounty = useMemo(() => eventsByCounty(allEvents), [allEvents])

  // 依勾選的事件圖層過濾，供清單顯示與地圖標點共用
  const visibleEvents = useMemo(
    () => allEvents.filter((e) => layers.has(e.type)),
    [allEvents, layers],
  )
  const toggleLayer = (t: DisasterType) =>
    setLayers((prev) => {
      const next = new Set(prev)
      next.has(t) ? next.delete(t) : next.add(t)
      return next
    })

  // 受影響縣市的事件圓點：顏色取最嚴重、大小依事件數
  const marks = useMemo(() => {
    const m = new Map<string, { severity: Severity; count: number }>()
    for (const e of visibleEvents) {
      for (const code of e.countyCodes) {
        const cur = m.get(code)
        const severity =
          !cur || SEV_RANK[e.severity] < SEV_RANK[cur.severity] ? e.severity : cur.severity
        m.set(code, { severity, count: (cur?.count ?? 0) + 1 })
      }
    }
    return [...m.entries()].map(([code, v]) => ({ code, ...v }))
  }, [visibleEvents])

  // 有精準座標的事件（地震 / 標題寫到區鄉鎮的新聞）→ 擴散波從該點發出
  const eventPoints = useMemo(
    () =>
      visibleEvents
        .filter((e) => e.lat != null && e.lon != null)
        .map((e) => ({ lng: e.lon!, lat: e.lat!, code: e.countyCodes[0] ?? '' })),
    [visibleEvents],
  )

  return (
    <div className="h-full flex flex-col bg-[var(--color-paper)]">
      <header className="px-5 sm:px-7 pt-5 pb-3 border-b border-[var(--color-ink)]/15 rise">
        <div className="flex items-end justify-between gap-3 sm:gap-4">
          <div className="flex items-end gap-3 min-w-0">
            {risks && (
              <button
                onClick={() => setPanelOpen(true)}
                className="md:hidden shrink-0 mb-0.5 text-xs border border-[var(--color-ink)]/25 rounded-sm px-2.5 py-1.5 text-[var(--color-ink-2)] hover:text-[var(--color-ink)] transition"
                aria-label="開啟面板"
              >
                ☰ 面板
              </button>
            )}
            <div className="min-w-0">
              <div className="kicker mb-1.5">區域壓力分析</div>
              <h1 className="font-serif text-[22px] sm:text-[27px] leading-none font-bold tracking-tight truncate">{t('app.title')}</h1>
            </div>
          </div>
          <div className="text-right shrink-0 hidden sm:block">
            <div className="font-display text-sm italic text-[var(--color-ink-2)]">Taiwan County Pressure Index</div>
            <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--color-ink-2)] mt-1">
              2026 · {allLive ? t('badge.real') : t('badge.partial')}
            </div>
          </div>
        </div>
        <p className="mt-2.5 text-[12px] sm:text-[13px] leading-relaxed text-[var(--color-ink-2)] max-w-3xl">
          {t('app.lede')}
          <span className="text-[var(--color-ink)]">{t('app.ledeKey')}</span>
        </p>
      </header>

      <div className="flex-1 flex relative overflow-hidden">
        {isLoading && (
          <div className="m-auto text-center rise">
            <div className="kicker justify-center mb-2">Loading</div>
            <p className="text-[var(--color-ink-2)]">{t('state.loading')}</p>
          </div>
        )}
        {isError && (
          <div className="m-auto text-center rise">
            <div className="kicker justify-center mb-2">Error</div>
            <p className="text-[var(--color-accent)]">{t('state.error')}</p>
          </div>
        )}
        {risks && data && (
          <>
            {panelOpen && (
              <div
                className="md:hidden fixed inset-0 bg-[var(--color-ink)]/30 z-20"
                onClick={() => setPanelOpen(false)}
                aria-hidden
              />
            )}
            <div
              className={`fixed inset-y-0 left-0 w-[85%] max-w-xs z-30 transition-transform md:static md:w-[19rem] md:max-w-none md:z-auto md:translate-x-0 shrink-0 h-full flex flex-col border-r border-[var(--color-ink)]/15 bg-[var(--color-paper)] ${
                panelOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full md:shadow-none'
              }`}
            >
              <button
                onClick={() => setPanelOpen(false)}
                className="md:hidden self-end mt-3 mr-4 text-[var(--color-ink-2)] hover:text-[var(--color-ink)] text-base leading-none transition"
                aria-label="關閉面板"
              >
                ✕
              </button>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <ControlPanel
                  risks={risks}
                  colorBy={colorBy}
                  selectedCode={selectedCode}
                  onSelect={(code) => {
                    setSelectedCode(code)
                    setPanelOpen(false)
                  }}
                />
                <AlertsList
                  events={visibleEvents}
                  activeId={highlight?.id ?? null}
                  onSelectEvent={(ev) =>
                    setHighlight((h) => (h?.id === ev.id ? null : { id: ev.id, codes: ev.countyCodes }))
                  }
                />
                <DataSources sources={data.sources} builtAt={data.builtAt} />
                <Methodology />
              </div>
            </div>
            <div className="flex-1 relative">
              <MapView
                risks={risks}
                colorBy={colorBy}
                selectedCode={selectedCode}
                onSelect={setSelectedCode}
                highlightCodes={highlight?.codes ?? []}
                marks={marks}
                eventPoints={eventPoints}
              />
              <LayerControl
                colorBy={colorBy}
                onColorBy={setColorBy}
                events={allEvents}
                layers={layers}
                onToggleLayer={toggleLayer}
              />
              <CountyDrawer
                risk={selected}
                onClose={() => setSelectedCode(null)}
                events={selected ? byCounty[selected.code] ?? [] : []}
                history={data.history}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
