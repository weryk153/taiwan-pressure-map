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
  rawValues: {},
  confidence: 0.9,
  asOf: '2026-01-01',
  hasData: true,
}

const noData: CountyRisk = {
  code: '64000',
  name: '高雄市',
  score: null,
  subScores: {},
  rawValues: {},
  confidence: 0,
  asOf: null,
  hasData: false,
}

function renderPanel(props: Partial<React.ComponentProps<typeof ControlPanel>> = {}) {
  const onSelect = vi.fn()
  render(
    <ControlPanel
      risks={[scored, noData]}
      colorBy="composite"
      selectedCode={null}
      onSelect={onSelect}
      {...props}
    />,
  )
  return { onSelect }
}

describe('ControlPanel', () => {
  it('renders a ranking row per county', () => {
    renderPanel()
    expect(screen.getByText('臺北市')).toBeInTheDocument()
    expect(screen.getByText('高雄市')).toBeInTheDocument()
  })

  it('shows — for a county with null score and sorts it after scored ones', () => {
    renderPanel()
    const ranking = screen.getByRole('list', { name: '縣市排行' })
    const items = within(ranking).getAllByRole('listitem')
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
})
