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
    render(<AlertsList events={[]} showEvents={false} onToggle={() => {}} />)
    expect(screen.getByText('目前無警示')).toBeInTheDocument()
  })

  it('prefixes an incident row with [新聞]', () => {
    render(<AlertsList events={[incident]} showEvents={false} onToggle={() => {}} />)
    expect(screen.getByText('[新聞]')).toBeInTheDocument()
    expect(screen.getByText('新聞標題')).toBeInTheDocument()
  })

  it('calls onToggle when the toggle button is clicked', () => {
    const onToggle = vi.fn()
    render(<AlertsList events={[]} showEvents={false} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('button', { name: '顯示即時災害' }))
    expect(onToggle).toHaveBeenCalled()
  })
})
