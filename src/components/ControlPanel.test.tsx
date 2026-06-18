import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import '@/lib/i18n'
import { ControlPanel } from './ControlPanel'
import type { CountyRisk } from '@/lib/types'

const scored: CountyRisk = {
  code: '63000',
  name: '臺北市',
  score: 72,
  subScores: { economic: 80, housing: 90, demographic: 50, safety: 30, healthcare: 60 },
  confidence: 0.9,
  asOf: '2026-01-01',
  hasData: true,
}

const noData: CountyRisk = {
  code: '64000',
  name: '高雄市',
  score: null,
  subScores: {},
  confidence: 0,
  asOf: null,
  hasData: false,
}

function renderPanel(props: Partial<React.ComponentProps<typeof ControlPanel>> = {}) {
  const onColorBy = vi.fn()
  const onSelect = vi.fn()
  render(
    <ControlPanel
      risks={[scored, noData]}
      colorBy="composite"
      onColorBy={onColorBy}
      selectedCode={null}
      onSelect={onSelect}
      {...props}
    />,
  )
  return { onColorBy, onSelect }
}

describe('ControlPanel', () => {
  it('renders all 6 metric options and a ranking row per county', () => {
    renderPanel()
    for (const label of ['綜合', '經濟壓力', '居住壓力', '人口壓力', '治安', '醫療資源']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(screen.getByText('臺北市')).toBeInTheDocument()
    expect(screen.getByText('高雄市')).toBeInTheDocument()
  })

  it('shows — for a county with null score and sorts it after scored ones', () => {
    renderPanel()
    const items = screen.getAllByRole('listitem')
    // scored 臺北市 first, null-score 高雄市 last
    expect(within(items[0]).getByText('臺北市')).toBeInTheDocument()
    expect(within(items[1]).getByText('高雄市')).toBeInTheDocument()
    expect(within(items[1]).getByText('—')).toBeInTheDocument()
    // the score value renders for the scored county
    expect(within(items[0]).getByText('72')).toBeInTheDocument()
  })

  it('calls onSelect with the county code when a ranking row is clicked', () => {
    const { onSelect } = renderPanel()
    fireEvent.click(screen.getByText('臺北市'))
    expect(onSelect).toHaveBeenCalledWith('63000')
  })

  it('calls onColorBy when a metric chip is clicked', () => {
    const { onColorBy } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: '居住壓力' }))
    expect(onColorBy).toHaveBeenCalledWith('housing')
  })
})
