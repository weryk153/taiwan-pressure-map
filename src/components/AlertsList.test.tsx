import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@/lib/i18n'
import { AlertsList } from './AlertsList'
import type { DisasterEvent } from '@/lib/disasters/types'

const incident: DisasterEvent = {
  id: 'e1',
  type: 'incident',
  title: '新聞標題',
  severity: 'warning',
  countyCodes: ['63000'],
  time: '2026-01-02T10:00:00',
  source: 'NEWS',
}

describe('AlertsList', () => {
  it('shows the empty state when there are no events', () => {
    render(<AlertsList events={[]} />)
    expect(screen.getByText('目前無警示')).toBeInTheDocument()
  })

  it('prefixes an incident row with [新聞] 並標注區域', () => {
    render(<AlertsList events={[incident]} />)
    expect(screen.getByText('[新聞]')).toBeInTheDocument()
    expect(screen.getByText('新聞標題')).toBeInTheDocument()
    expect(screen.getByText('臺北市')).toBeInTheDocument() // 標注區域
  })

  it('clicking an event calls onSelectEvent', () => {
    const onSelectEvent = vi.fn()
    render(<AlertsList events={[incident]} onSelectEvent={onSelectEvent} />)
    fireEvent.click(screen.getByText('新聞標題'))
    expect(onSelectEvent).toHaveBeenCalledWith(incident)
  })
})
