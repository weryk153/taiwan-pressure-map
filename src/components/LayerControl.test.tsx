import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@/lib/i18n'
import { LayerControl } from './LayerControl'
import type { DisasterEvent, DisasterType } from '@/lib/disasters/types'

const ALL_LAYERS: DisasterType[] = ['incident', 'alert', 'weather', 'earthquake']

const newsEvent: DisasterEvent = {
  id: 'n1',
  type: 'incident',
  title: '新聞',
  severity: 'warning',
  countyCodes: ['63000'],
  time: '2026-01-01T00:00:00',
  source: 'NEWS',
}

function renderControl(props: Partial<React.ComponentProps<typeof LayerControl>> = {}) {
  const onColorBy = vi.fn()
  const onToggleLayer = vi.fn()
  render(
    <LayerControl
      colorBy="composite"
      onColorBy={onColorBy}
      events={[newsEvent]}
      layers={new Set(ALL_LAYERS)}
      onToggleLayer={onToggleLayer}
      {...props}
    />,
  )
  return { onColorBy, onToggleLayer }
}

describe('LayerControl', () => {
  it('renders all 6 pressure dimensions and calls onColorBy on click', () => {
    const { onColorBy } = renderControl()
    for (const label of ['綜合', '經濟壓力', '居住壓力', '人口壓力', '治安', '醫療資源']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
    fireEvent.click(screen.getByRole('button', { name: '居住壓力' }))
    expect(onColorBy).toHaveBeenCalledWith('housing')
  })

  it('renders the 4 event layers with counts and toggles on click', () => {
    const { onToggleLayer } = renderControl()
    expect(screen.getByRole('button', { name: /新聞/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /災防告警/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /天氣特報/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /地震/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /新聞/ }))
    expect(onToggleLayer).toHaveBeenCalledWith('incident')
  })

  it('collapses when the header is clicked', () => {
    renderControl()
    expect(screen.getByRole('button', { name: '綜合' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /圖層/ }))
    expect(screen.queryByRole('button', { name: '綜合' })).not.toBeInTheDocument()
  })
})
