import { describe, it, expect, beforeAll } from 'vitest'
import { render } from '@testing-library/react'
import { Sparkline } from './Sparkline'

// jsdom 不實作 clientWidth/ResizeObserver；給定固定寬度讓 svg 得以渲染。
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 280 })
})

describe('Sparkline', () => {
  it('渲染折線路徑、資料點與刻度標籤', () => {
    const { container } = render(
      <Sparkline data={[
        { asOf: '01-01', score: 40 },
        { asOf: '02-01', score: 70 },
        { asOf: '03-01', score: 55 },
      ]} />,
    )
    const path = container.querySelector('path')
    expect(path).toBeTruthy()
    // 三點 → 兩段三次曲線
    expect(path!.getAttribute('d')).toMatch(/^M.*C.*C/)
    expect(container.querySelectorAll('circle')).toHaveLength(3)
    expect(container.querySelectorAll('text')).toHaveLength(3)
  })

  it('兩點時以直線連接（L 指令）', () => {
    const { container } = render(
      <Sparkline data={[{ asOf: '01-01', score: 40 }, { asOf: '02-01', score: 70 }]} />,
    )
    expect(container.querySelector('path')!.getAttribute('d')).toMatch(/^M[\d.,-]+L[\d.,-]+$/)
  })
})
