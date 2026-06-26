import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
  // 清單只顯示台灣「今天」的事件，固定系統時間讓 fixture 視為今天。
  beforeEach(() => vi.setSystemTime(Date.parse('2026-01-02T12:00:00+08:00')))
  afterEach(() => vi.useRealTimers())

  it('shows the empty state when there are no events', () => {
    render(<AlertsList events={[]} />)
    expect(screen.getByText('目前無警示')).toBeInTheDocument()
  })

  it('prefixes an incident row with [重大新聞] 並標注區域', () => {
    render(<AlertsList events={[incident]} />)
    expect(screen.getByText('[重大新聞]')).toBeInTheDocument()
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
