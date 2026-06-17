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

// 紙上地圖：海＝紙底（融入頁面，如印刷圖），縣市面鋪熱度色。
const STYLE = {
  version: 8 as const,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'bg', type: 'background' as const, paint: { 'background-color': '#f4efe4' } }],
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

  // 每縣市面注入熱度色
  const fillGeo = useMemo(() => {
    if (!geo) return null
    return {
      ...geo,
      features: geo.features.map((f: any) => {
        const r = byCode.get(f.properties.COUNTYCODE)
        const v = r ? valueFor(r, colorBy) : 0
        return { ...f, properties: { ...f.properties, _color: scoreColor(v) } }
      }),
    }
  }, [geo, byCode, colorBy])

  // 標籤點：每縣市恰一個（質心），避免離島逐島重複標號
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
              paint={{
                'fill-color': ['get', '_color'],
                'fill-opacity': ['case', ['==', ['get', 'COUNTYCODE'], sel], 1, 0.9],
              }}
            />
            <Layer
              id="county-line"
              type="line"
              paint={{
                'line-color': ['case', ['==', ['get', 'COUNTYCODE'], sel], '#b5532f', '#232019'],
                'line-opacity': ['case', ['==', ['get', 'COUNTYCODE'], sel], 1, 0.3],
                'line-width': ['case', ['==', ['get', 'COUNTYCODE'], sel], 2, 0.6],
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
                'symbol-sort-key': ['-', 100, ['get', '_v']],
              }}
              paint={{
                'text-color': '#231f18',
                'text-halo-color': '#f4efe4',
                'text-halo-width': 1.5,
                'text-halo-blur': 0.2,
              }}
            />
          </Source>
        )}
      </MapGL>
    </div>
  )
}
