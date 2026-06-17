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
      <header className="px-5 py-2.5 border-b border-[var(--color-edge)] bg-[var(--color-panel)] flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] shrink-0" />
        <h1 className="text-base font-bold tracking-wide">{t('app.title')}</h1>
        <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-[var(--color-muted)] hidden sm:inline">
          TW · PRESSURE INDEX
        </span>
        <span className="ml-auto font-mono text-[10px] tracking-wider uppercase px-2 py-0.5 rounded border border-[var(--color-edge)] text-[var(--color-muted)]">
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
