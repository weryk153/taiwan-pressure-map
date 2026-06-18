import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapView } from '@/components/MapView'
import { ControlPanel } from '@/components/ControlPanel'
import { CountyDrawer } from '@/components/CountyDrawer'
import { Legend } from '@/components/Legend'
import { DataSources } from '@/components/DataSources'
import { AlertsList } from '@/components/AlertsList'
import { useRiskData } from '@/hooks/useRiskData'
import { useDisasterEvents } from '@/hooks/useDisasterEvents'
import { useIncidents } from '@/hooks/useIncidents'
import { eventsByCounty } from '@/lib/disasters/group'
import type { MetricKey } from '@/lib/types'

type ColorBy = 'composite' | MetricKey

export default function App() {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useRiskData()
  const { data: events = [] } = useDisasterEvents()
  const { data: incidents = [] } = useIncidents()
  const allEvents = useMemo(() => [...events, ...incidents], [events, incidents])
  const [colorBy, setColorBy] = useState<ColorBy>('composite')
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [showEvents, setShowEvents] = useState(true)

  const risks = data?.risks
  const allLive = data ? data.sources.every((s) => s.status === 'live') : false
  const selected = useMemo(
    () => risks?.find((r) => r.code === selectedCode) ?? null,
    [risks, selectedCode],
  )
  const byCounty = useMemo(() => eventsByCounty(allEvents), [allEvents])

  return (
    <div className="h-full flex flex-col bg-[var(--color-paper)]">
      <header className="px-7 pt-5 pb-3 border-b border-[var(--color-ink)]/15 rise">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="kicker mb-1.5">區域壓力分析</div>
            <h1 className="font-serif text-[27px] leading-none font-bold tracking-tight">{t('app.title')}</h1>
          </div>
          <div className="text-right shrink-0">
            <div className="font-display text-sm italic text-[var(--color-ink-2)]">Taiwan County Pressure Index</div>
            <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--color-ink-2)] mt-1">
              2026 · {allLive ? t('badge.real') : t('badge.partial')}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex relative overflow-hidden">
        {isLoading && <div className="m-auto text-[var(--color-ink-2)]">{t('state.loading')}</div>}
        {isError && <div className="m-auto text-[var(--color-accent)]">{t('state.error')}</div>}
        {risks && data && (
          <>
            <div className="w-[19rem] shrink-0 h-full flex flex-col border-r border-[var(--color-ink)]/15">
              <div className="flex-1 overflow-y-auto">
                <ControlPanel
                  risks={risks}
                  colorBy={colorBy}
                  onColorBy={setColorBy}
                  selectedCode={selectedCode}
                  onSelect={setSelectedCode}
                />
              </div>
              <AlertsList events={allEvents} showEvents={showEvents} onToggle={() => setShowEvents((v) => !v)} />
              <DataSources sources={data.sources} builtAt={data.builtAt} />
            </div>
            <div className="flex-1 relative">
              <MapView
                risks={risks}
                colorBy={colorBy}
                selectedCode={selectedCode}
                onSelect={setSelectedCode}
                events={allEvents}
                showEvents={showEvents}
              />
              <Legend />
              <CountyDrawer
                risk={selected}
                onClose={() => setSelectedCode(null)}
                events={selected ? byCounty[selected.code] ?? [] : []}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
