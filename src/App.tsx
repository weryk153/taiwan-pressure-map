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
    <div className="h-full flex flex-col">
      <header className="px-5 h-12 flex items-center gap-3 border-b border-[var(--color-edge)] bg-[var(--color-panel)]">
        <svg width="16" height="16" viewBox="0 0 16 16" className="text-[var(--color-accent)] shrink-0">
          <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
          <circle cx="8" cy="8" r="2" fill="currentColor" />
        </svg>
        <h1 className="text-[15px] font-semibold tracking-wide text-[var(--color-ink)]">{t('app.title')}</h1>
        <span className="h-3.5 w-px bg-[var(--color-edge)] hidden sm:block" />
        <span className="font-mono text-[10px] tracking-[0.28em] uppercase text-[var(--color-muted)] hidden sm:inline">
          Taiwan Pressure Index
        </span>
        <span className="ml-auto font-mono text-[10px] tracking-wider uppercase px-2 py-1 rounded-sm border border-[var(--color-edge)] text-[var(--color-muted)]">
          示範資料
        </span>
      </header>

      <div className="flex-1 flex relative overflow-hidden">
        {isLoading && <div className="m-auto text-white/50">{t('state.loading')}</div>}
        {isError && <div className="m-auto text-red-400">{t('state.error')}</div>}
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
