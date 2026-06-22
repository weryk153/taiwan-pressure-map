import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@/lib/i18n'
import { Methodology } from './Methodology'

describe('Methodology', () => {
  it('展開後列出各指標門檻與權重（計算依據）', () => {
    render(<Methodology />)
    fireEvent.click(screen.getByText('計算方式'))
    // 指標名 + 權重
    expect(screen.getAllByText(/每戶可支配所得/).length).toBeGreaterThan(0)
    expect(screen.getByText(/權重 25%/)).toBeInTheDocument()
    // 門檻（每戶可支配所得 155→75 萬元，反向）
    expect(screen.getByText(/155\.0 萬元 → 75\.0 萬元/)).toBeInTheDocument()
    // 房價所得比門檻
    expect(screen.getByText(/5\.0 倍 → 17\.0 倍/)).toBeInTheDocument()
  })
})
