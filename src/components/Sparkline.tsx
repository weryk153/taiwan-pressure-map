import { useEffect, useRef, useState } from 'react'

export interface SparkPoint {
  asOf: string
  score: number
}

interface Props {
  data: SparkPoint[]
  height?: number
}

// recharts 預設邊距與 X 軸高度，沿用以維持外觀一致。
const MARGIN = { top: 6, right: 8, bottom: 0, left: 8 }
const X_AXIS_HEIGHT = 30
const Y_MIN = 0
const Y_MAX = 100

/**
 * 取代 recharts <LineChart type="monotone">，避免為了一張小折線圖載入 ~90KB(gzip)。
 * 幾何、單調三次曲線（curveMonotoneX）、座標軸與圓點皆比照 recharts 預設，外觀一致。
 */
export function Sparkline({ data, height = 120 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      if (w > 0) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right)
  const plotTop = MARGIN.top
  const plotBottom = height - MARGIN.bottom - X_AXIS_HEIGHT
  const plotH = plotBottom - plotTop

  // point scale：第一點在最左、最後一點在最右，其餘等距。
  const xs = data.map((_, i) =>
    data.length <= 1 ? MARGIN.left + plotW / 2 : MARGIN.left + (i / (data.length - 1)) * plotW,
  )
  const yOf = (score: number) =>
    plotBottom - ((score - Y_MIN) / (Y_MAX - Y_MIN)) * plotH
  const ys = data.map((d) => yOf(d.score))
  const pts: [number, number][] = xs.map((x, i) => [x, ys[i]])

  return (
    <div ref={ref} style={{ width: '100%', height }}>
      {width > 0 && (
        <svg width={width} height={height} style={{ overflow: 'visible' }}>
          {/* X 軸線 */}
          <line
            x1={MARGIN.left}
            y1={plotBottom}
            x2={width - MARGIN.right}
            y2={plotBottom}
            stroke="var(--color-ink)"
            strokeOpacity={0.15}
          />
          {/* 折線（單調三次曲線） */}
          <path d={monotonePath(pts)} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
          {/* 資料點 */}
          {pts.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={2} fill="var(--color-accent)" />
          ))}
          {/* X 軸刻度標籤 */}
          {data.map((d, i) => (
            <text
              key={i}
              x={xs[i]}
              y={plotBottom + 13}
              textAnchor="middle"
              fontSize={10}
              fill="var(--color-ink-2)"
            >
              {d.asOf}
            </text>
          ))}
        </svg>
      )}
    </div>
  )
}

const sign = (x: number) => (x < 0 ? -1 : 1)

/** 中間點切線：x 嚴格遞增，故 h0,h1>0，可省去 d3 對退化區間的處理。 */
function slope3(p0: [number, number], p1: [number, number], p2: [number, number]): number {
  const h0 = p1[0] - p0[0]
  const h1 = p2[0] - p1[0]
  const s0 = (p1[1] - p0[1]) / h0
  const s1 = (p2[1] - p1[1]) / h1
  const p = (s0 * h1 + s1 * h0) / (h0 + h1)
  return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0
}

/** 端點切線。 */
function slope2(p0: [number, number], p1: [number, number], t: number): number {
  const h = p1[0] - p0[0]
  return h ? (3 * (p1[1] - p0[1]) / h - t) / 2 : t
}

/** 比照 d3-shape curveMonotoneX 產生路徑。 */
function monotonePath(pts: [number, number][]): string {
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`
  if (n === 2) return `M${pts[0][0]},${pts[0][1]}L${pts[1][0]},${pts[1][1]}`

  const tangents = new Array<number>(n)
  for (let i = 1; i < n - 1; i++) tangents[i] = slope3(pts[i - 1], pts[i], pts[i + 1])
  tangents[0] = slope2(pts[0], pts[1], tangents[1])
  tangents[n - 1] = slope2(pts[n - 2], pts[n - 1], tangents[n - 2])

  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    const dx = (x1 - x0) / 3
    d += `C${x0 + dx},${y0 + dx * tangents[i]} ${x1 - dx},${y1 - dx * tangents[i + 1]} ${x1},${y1}`
  }
  return d
}
