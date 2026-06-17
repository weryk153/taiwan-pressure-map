import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapView } from '@/components/MapView'
import { ControlPanel } from '@/components/ControlPanel'
import { CountyDrawer } from '@/components/CountyDrawer'
import { Legend } from '@/components/Legend'
import { useRiskData } from '@/hooks/useRiskData'
import type { MetricKey } from '@/lib/types'

type ColorBy = 'composite' | MetricKey

export default function App() {
  const { t } = useTranslation()
  const { data: risks, isLoading, isError } = useRiskData()
  const [colorBy, setColorBy] = useState<ColorBy>('composite')
  const [selectedCode, setSelectedCode] = useState<string | null>(null)

  const selected = useMemo(
    () => risks?.find((r) => r.code === selectedCode) ?? null,
    [risks, selectedCode],
  )

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
            <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--color-ink-2)] mt-1">2026 · 示範資料</div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex relative overflow-hidden">
        {isLoading && <div className="m-auto text-[var(--color-ink-2)]">{t('state.loading')}</div>}
        {isError && <div className="m-auto text-[var(--color-accent)]">{t('state.error')}</div>}
        {risks && (
          <>
            <ControlPanel
              risks={risks}
              colorBy={colorBy}
              onColorBy={setColorBy}
              selectedCode={selectedCode}
              onSelect={setSelectedCode}
            />
            <div className="flex-1 relative">
              <MapView
                risks={risks}
                colorBy={colorBy}
                selectedCode={selectedCode}
                onSelect={setSelectedCode}
              />
              <Legend />
              <CountyDrawer risk={selected} onClose={() => setSelectedCode(null)} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
