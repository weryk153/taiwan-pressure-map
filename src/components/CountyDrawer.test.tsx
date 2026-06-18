import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@/lib/i18n'
import { CountyDrawer } from './CountyDrawer'
import type { CountyRisk } from '@/lib/types'
import type { DisasterEvent } from '@/lib/disasters/types'

const scored: CountyRisk = {
  code: '63000',
  name: '臺北市',
  score: 72,
  subScores: { economic: 80, housing: 90 },
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

const linkEvent: DisasterEvent = {
  id: 'e1',
  type: 'incident',
  title: '某地新聞事件',
  severity: 'warning',
  countyCodes: ['63000'],
  time: '2026-01-02T10:00:00',
  source: 'NEWS',
  url: 'https://example.com/news/1',
  raw: { source: '中央社' },
}

const plainEvent: DisasterEvent = {
  id: 'e2',
  type: 'alert',
  title: '無連結警示',
  severity: 'severe',
  countyCodes: ['63000'],
  time: '2026-01-02T11:00:00',
  source: 'CWA',
}

describe('CountyDrawer', () => {
  it('renders nothing when risk is null', () => {
    const { container } = render(<CountyDrawer risk={null} onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the score number and metric bars for a scored county', () => {
    render(<CountyDrawer risk={scored} onClose={() => {}} />)
    expect(screen.getByText('臺北市')).toBeInTheDocument()
    expect(screen.getByText('72')).toBeInTheDocument()
    // present metric values
    expect(screen.getByText('80')).toBeInTheDocument()
    expect(screen.getByText('90')).toBeInTheDocument()
    // missing metrics render 無資料
    expect(screen.getAllByText('無資料').length).toBeGreaterThan(0)
  })

  it('shows 無資料 for a county with null score', () => {
    render(<CountyDrawer risk={noData} onClose={() => {}} />)
    expect(screen.getAllByText('無資料').length).toBeGreaterThan(0)
    expect(screen.queryByText('72')).not.toBeInTheDocument()
  })

  it('renders an <a href> for an event with a url and plain text otherwise', () => {
    render(<CountyDrawer risk={scored} onClose={() => {}} events={[linkEvent, plainEvent]} />)
    const link = screen.getByRole('link', { name: '某地新聞事件' })
    expect(link).toHaveAttribute('href', 'https://example.com/news/1')
    // plain (no url) event is not a link
    expect(screen.getByText('無連結警示')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '無連結警示' })).not.toBeInTheDocument()
  })

  it('shows the no-events empty state when events are empty', () => {
    render(<CountyDrawer risk={scored} onClose={() => {}} events={[]} />)
    expect(screen.getByText('目前無事件資料')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<CountyDrawer risk={scored} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: '關閉' }))
    expect(onClose).toHaveBeenCalled()
  })
})
