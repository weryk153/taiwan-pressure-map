import { useEffect, useMemo, useRef, useState } from 'react'
import MapGL, { Source, Layer, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import bbox from '@turf/bbox'
import { scoreColor, NO_DATA_COLOR } from '@/lib/colors'
import type { CountyRisk, MetricKey } from '@/lib/types'
import type { Severity } from '@/lib/disasters/types'

type ColorBy = 'composite' | MetricKey

function valueFor(r: CountyRisk, colorBy: ColorBy): number {
  if (colorBy === 'composite') return r.score ?? 0
  return r.subScores[colorBy] ?? 0
}

// 米白紙底；縣市以熱度色塊呈現（行政區），縣市間留紙色細縫，編輯/印刷質感。
const STYLE = {
  version: 8 as const,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'bg', type: 'background' as const, paint: { 'background-color': '#f4efe4' } }],
}
const PAPER = '#f4efe4'

interface Mark {
  code: string
  severity: Severity
  count: number
}

interface Props {
  risks: CountyRisk[]
  colorBy: ColorBy
  selectedCode: string | null
  onSelect: (code: string) => void
  highlightCodes?: string[] // 點選某事件時，高亮它影響的縣市
  marks?: Mark[] // 勾選的事件圖層：受影響縣市的事件圓點
}

export function MapView({ risks, colorBy, selectedCode, onSelect, highlightCodes, marks }: Props) {
  const mapRef = useRef<MapRef>(null)
  const [geo, setGeo] = useState<any>(null)
  const [towns, setTowns] = useState<any>(null)
  const [zoomedIn, setZoomedIn] = useState(false) // 是否已拉近到需要鄉鎮界線

  useEffect(() => {
    fetch('/taiwan-counties.json').then((r) => r.json()).then(setGeo)
  }, [])

  // 拉近後才載入鄉鎮市區界線（676KB，延遲載入避免拖慢首屏）
  useEffect(() => {
    if (!zoomedIn || towns) return
    fetch('/taiwan-towns.json').then((r) => r.json()).then(setTowns).catch(() => {})
  }, [zoomedIn, towns])

  const byCode = useMemo(() => new Map(risks.map((r) => [r.code, r])), [risks])
  const hlSet = useMemo(() => new Set(highlightCodes ?? []), [highlightCodes])
  const markSet = useMemo(() => new Set((marks ?? []).map((m) => m.code)), [marks])

  // 每縣市面注入熱度色 _color（依當前維度）、事件高亮旗標 _hl、事件縣市旗標 _evt
  const fillGeo = useMemo(() => {
    if (!geo) return null
    return {
      ...geo,
      features: geo.features.map((f: any) => {
        const code = f.properties.COUNTYCODE
        const r = byCode.get(code)
        const noData = !r || r.score === null
        return {
          ...f,
          properties: {
            ...f.properties,
            _color: noData ? NO_DATA_COLOR : scoreColor(valueFor(r!, colorBy)),
            _hl: hlSet.has(code) ? 1 : 0,
            _evt: markSet.has(code) ? 1 : 0,
          },
        }
      }),
    }
  }, [geo, byCode, colorBy, hlSet, markSet])

  useEffect(() => {
    if (!geo || !mapRef.current) return
    const [minX, minY, maxX, maxY] = bbox(geo)
    mapRef.current.fitBounds([[minX, minY], [maxX, maxY]], { padding: 64, maxZoom: 8.5, duration: 0 })
  }, [geo])

  const sel = selectedCode ?? ''

  return (
    <div className="absolute inset-0">
      <MapGL
        ref={mapRef}
        mapStyle={STYLE as any}
        initialViewState={{ longitude: 120.7, latitude: 23.8, zoom: 6.6 }}
        minZoom={6}
        maxZoom={10.5}
        dragRotate={false}
        touchPitch={false}
        pitchWithRotate={false}
        interactiveLayerIds={['county-fill']}
        onZoomEnd={(e) => {
          if (e.viewState.zoom >= 7.8) setZoomedIn(true)
        }}
        onClick={(e) => {
          const code = e.features?.[0]?.properties?.COUNTYCODE
          if (code) onSelect(code)
        }}
        style={{ width: '100%', height: '100%' }}
      >
        {fillGeo && (
          <Source id="counties" type="geojson" data={fillGeo}>
            <Layer
              id="county-fill"
              type="fill"
              paint={{ 'fill-color': ['get', '_color'], 'fill-opacity': 0.95 }}
            />
            {/* 行政區界：總覽時是紙色細縫；拉近後漸變為清楚的墨線，看得出各行政區 */}
            <Layer
              id="county-line"
              type="line"
              paint={{
                'line-color': ['interpolate', ['linear'], ['zoom'], 7, PAPER, 9, '#a8967a'],
                'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.6, 10, 0.9],
                'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.5, 9, 0.62],
              }}
            />
            {/* 事件縣市：青色細實線輪廓（勾選的事件圖層中有事件的縣市） */}
            <Layer
              id="county-event"
              type="line"
              filter={['==', ['get', '_evt'], 1]}
              paint={{ 'line-color': '#13556b', 'line-width': 1.3, 'line-opacity': 0.85 }}
            />
            {/* 點選事件 → 其縣市紅色虛線高亮（與事件縣市青框冷暖對比）。先鋪紙色襯底，深色縣市上也清楚 */}
            <Layer
              id="county-highlight-casing"
              type="line"
              filter={['==', ['get', '_hl'], 1]}
              paint={{ 'line-color': PAPER, 'line-width': 4.5, 'line-opacity': 0.7 }}
            />
            <Layer
              id="county-highlight"
              type="line"
              filter={['==', ['get', '_hl'], 1]}
              paint={{ 'line-color': '#a8322b', 'line-width': 2.5, 'line-dasharray': [2, 1.5], 'line-opacity': 1 }}
            />
            {/* 選中縣市：紙色襯底 + 墨線（cased outline）。注意必須是 Source 的「直接」子層，
                包進 Fragment 會讓 react-map-gl 無法注入 source → 圖層加不上去。 */}
            {sel && (
              <Layer
                id="county-sel-casing"
                source="counties"
                type="line"
                filter={['==', ['get', 'COUNTYCODE'], sel]}
                paint={{ 'line-color': PAPER, 'line-width': 3, 'line-opacity': 0.8 }}
              />
            )}
            {sel && (
              <Layer
                id="county-sel"
                source="counties"
                type="line"
                filter={['==', ['get', 'COUNTYCODE'], sel]}
                paint={{ 'line-color': '#5a4632', 'line-width': 1.4, 'line-opacity': 0.95 }}
              />
            )}
          </Source>
        )}
        {/* 鄉鎮市區界線：拉近後才淡入（縣市界仍較粗、層級分明） */}
        {towns && (
          <Source id="towns" type="geojson" data={towns}>
            <Layer
              id="town-line"
              type="line"
              beforeId="county-line"
              paint={{
                'line-color': '#bcae96',
                'line-width': ['interpolate', ['linear'], ['zoom'], 8.5, 0.4, 10.5, 0.6],
                'line-opacity': ['interpolate', ['linear'], ['zoom'], 8.3, 0, 9.5, 0.4, 10.5, 0.55],
              }}
            />
          </Source>
        )}
      </MapGL>
    </div>
  )
}
