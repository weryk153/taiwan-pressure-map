import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@/lib/i18n'
import { DataSources } from './DataSources'
import type { SourceMeta } from '@/lib/types'

const sources: SourceMeta[] = [
  {
    metric: 'economic',
    label: '所得收入',
    agency: '財政部',
    asOf: '2026-01-01',
    status: 'live',
  },
  {
    metric: 'housing',
    label: '房價負擔',
    agency: '內政部',
    asOf: '2025-12-01',
    status: 'missing',
  },
]

describe('DataSources', () => {
  it('renders each source label and agency', () => {
    render(<DataSources sources={sources} builtAt="2026-06-16T00:00:00Z" />)
    expect(screen.getByText('所得收入')).toBeInTheDocument()
    expect(screen.getByText('房價負擔')).toBeInTheDocument()
    expect(screen.getByText(/財政部/)).toBeInTheDocument()
    expect(screen.getByText(/內政部/)).toBeInTheDocument()
  })

  it('shows 無資料 for a missing source and the asOf date for a live one', () => {
    render(<DataSources sources={sources} builtAt="2026-06-16T00:00:00Z" />)
    expect(screen.getByText(/財政部 · 2026-01-01/)).toBeInTheDocument()
    expect(screen.getByText(/內政部 · 無資料/)).toBeInTheDocument()
  })
})
