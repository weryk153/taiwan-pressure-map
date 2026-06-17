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
      <header className="px-5 py-3 border-b border-white/10 bg-[var(--color-panel)]">
        <h1 className="text-lg font-semibold">{t('app.title')}</h1>
        <p className="text-xs text-white/50">{t('app.subtitle')}</p>
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
