import { useEffect, useMemo, useRef, useState } from 'react'
import MapGL, { Source, Layer, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import bbox from '@turf/bbox'
import { scoreColor, NO_DATA_COLOR } from '@/lib/colors'
import type { CountyRisk, MetricKey } from '@/lib/types'

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

interface Props {
  risks: CountyRisk[]
  colorBy: ColorBy
  selectedCode: string | null
  onSelect: (code: string) => void
  highlightCodes?: string[] // 點選某事件時，高亮它影響的縣市
}

export function MapView({ risks, colorBy, selectedCode, onSelect, highlightCodes }: Props) {
  const mapRef = useRef<MapRef>(null)
  const [geo, setGeo] = useState<any>(null)

  useEffect(() => {
    fetch('/taiwan-counties.json').then((r) => r.json()).then(setGeo)
  }, [])

  const byCode = useMemo(() => new Map(risks.map((r) => [r.code, r])), [risks])
  const hlSet = useMemo(() => new Set(highlightCodes ?? []), [highlightCodes])

  // 每縣市面注入熱度色 _color（依當前維度）與事件高亮旗標 _hl
  const fillGeo = useMemo(() => {
    if (!geo) return null
    return {
      ...geo,
      features: geo.features.map((f: any) => {
        const r = byCode.get(f.properties.COUNTYCODE)
        const noData = !r || r.score === null
        return {
          ...f,
          properties: {
            ...f.properties,
            _color: noData ? NO_DATA_COLOR : scoreColor(valueFor(r!, colorBy)),
            _hl: hlSet.has(f.properties.COUNTYCODE) ? 1 : 0,
          },
        }
      }),
    }
  }, [geo, byCode, colorBy, hlSet])

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
        maxZoom={9.5}
        dragRotate={false}
        touchPitch={false}
        pitchWithRotate={false}
        interactiveLayerIds={['county-fill']}
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
            {/* 縣市間紙色細縫：像印刷拼貼，乾淨 */}
            <Layer
              id="county-line"
              type="line"
              paint={{
                'line-color': ['case', ['==', ['get', 'COUNTYCODE'], sel], '#3a2a1e', PAPER],
                'line-width': ['case', ['==', ['get', 'COUNTYCODE'], sel], 1.6, 0.8],
                'line-opacity': ['case', ['==', ['get', 'COUNTYCODE'], sel], 1, 0.7],
              }}
            />
            {/* 點選事件 → 其縣市青色虛線高亮 */}
            <Layer
              id="county-highlight"
              type="line"
              filter={['==', ['get', '_hl'], 1]}
              paint={{ 'line-color': '#13556b', 'line-width': 2.5, 'line-dasharray': [2, 1.5], 'line-opacity': 1 }}
            />
          </Source>
        )}
      </MapGL>
    </div>
  )
}
