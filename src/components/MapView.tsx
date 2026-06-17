import { useEffect, useMemo, useRef, useState } from 'react'
import MapGL, { Source, Layer, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import bbox from '@turf/bbox'
import { scoreColor } from '@/lib/colors'
import { computeCentroids } from '@/lib/centroids'
import type { CountyRisk, MetricKey } from '@/lib/types'

type ColorBy = 'composite' | MetricKey

function valueFor(r: CountyRisk, colorBy: ColorBy): number {
  return colorBy === 'composite' ? r.score : r.subScores[colorBy]
}

// 極簡底圖：海＝近黑背景，縣市面由我們的 GeoJSON 鋪上熱度色（資料即圖）。
const STYLE = {
  version: 8 as const,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'bg', type: 'background' as const, paint: { 'background-color': '#0a0c10' } }],
}

interface Props {
  risks: CountyRisk[]
  colorBy: ColorBy
  selectedCode: string | null
  onSelect: (code: string) => void
}

export function MapView({ risks, colorBy, selectedCode, onSelect }: Props) {
  const mapRef = useRef<MapRef>(null)
  const [geo, setGeo] = useState<any>(null)

  useEffect(() => {
    fetch('/taiwan-counties.json').then((r) => r.json()).then(setGeo)
  }, [])

  const byCode = useMemo(() => new Map(risks.map((r) => [r.code, r])), [risks])

  // 每個縣市面注入 _color（熱度色）與 _label（分數）。fill / line / symbol 共用此 source。
  const fillGeo = useMemo(() => {
    if (!geo) return null
    return {
      ...geo,
      features: geo.features.map((f: any) => {
        const r = byCode.get(f.properties.COUNTYCODE)
        const v = r ? valueFor(r, colorBy) : 0
        return {
          ...f,
          properties: { ...f.properties, _color: scoreColor(v), _label: r ? String(v) : '', _v: v },
        }
      }),
    }
  }, [geo, byCode, colorBy])

  // 標籤點：每縣市恰一個（質心），避免 MultiPolygon 離島逐島重複標號
  const labelGeo = useMemo(() => {
    if (!geo) return null
    const centroids = computeCentroids(geo)
    return {
      type: 'FeatureCollection',
      features: risks.flatMap((r) => {
        const c = centroids[r.code]
        if (!c) return []
        const v = valueFor(r, colorBy)
        return [{
          type: 'Feature',
          properties: { label: String(v), _v: v },
          geometry: { type: 'Point', coordinates: c },
        }]
      }),
    }
  }, [geo, risks, colorBy])

  useEffect(() => {
    if (!geo || !mapRef.current) return
    const [minX, minY, maxX, maxY] = bbox(geo)
    mapRef.current.fitBounds([[minX, minY], [maxX, maxY]], { padding: 56, maxZoom: 8.5, duration: 0 })
  }, [geo])

  const sel = selectedCode ?? ''

  return (
    <div className="absolute inset-0">
      <MapGL
        ref={mapRef}
        mapStyle={STYLE as any}
        initialViewState={{ longitude: 120.7, latitude: 23.8, zoom: 6.6 }}
        interactiveLayerIds={['county-fill']}
        onClick={(e) => {
          const code = e.features?.[0]?.properties?.COUNTYCODE
          if (code) onSelect(code)
        }}
        style={{ width: '100%', height: '100%' }}
      >
        {fillGeo && (
          <Source id="counties" type="geojson" data={fillGeo}>
            {/* 海岸柔光：寬、模糊、低透明，把整座島從海面上浮起來 */}
            <Layer
              id="county-glow"
              type="line"
              paint={{
                'line-color': '#7fb3c9',
                'line-width': 7,
                'line-blur': 8,
                'line-opacity': 0.07,
              }}
            />
            <Layer
              id="county-fill"
              type="fill"
              paint={{
                'fill-color': ['get', '_color'],
                'fill-opacity': ['case', ['==', ['get', 'COUNTYCODE'], sel], 1, 0.88],
              }}
            />
            <Layer
              id="county-line"
              type="line"
              paint={{
                'line-color': ['case', ['==', ['get', 'COUNTYCODE'], sel], '#e7f6ef', '#0a0c10'],
                'line-opacity': ['case', ['==', ['get', 'COUNTYCODE'], sel], 1, 0.45],
                'line-width': ['case', ['==', ['get', 'COUNTYCODE'], sel], 1.8, 0.6],
              }}
            />
          </Source>
        )}
        {labelGeo && (
          <Source id="county-labels" type="geojson" data={labelGeo as any}>
            <Layer
              id="county-label"
              type="symbol"
              layout={{
                'text-field': ['get', 'label'],
                'text-font': ['Open Sans Semibold'],
                'text-size': 12,
                'text-allow-overlap': false,
                'symbol-sort-key': ['-', 100, ['get', '_v']], // 高分優先佔位
              }}
              paint={{
                'text-color': '#f4f6f8',
                'text-halo-color': '#000000',
                'text-halo-width': 1.2,
                'text-halo-blur': 0.4,
              }}
            />
          </Source>
        )}
      </MapGL>
      {/* 氣氛：邊緣壓暗的暈影，讓畫面聚焦、不再是死黑空洞 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 70% 70% at 56% 46%, transparent 45%, rgba(0,0,0,0.5) 100%)' }}
      />
    </div>
  )
}
