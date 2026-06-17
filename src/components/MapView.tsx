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

// 極簡底圖：海＝近黑背景，縣市面由我們的 GeoJSON 當「陸地」鋪暗色。
const STYLE = {
  version: 8 as const,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'bg', type: 'background' as const, paint: { 'background-color': '#08090c' } }],
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

  // 縣市資料點（質心）：半徑 ∝ 分數、顏色依分數、數字 = 分數。資料色只出現在這些圓上。
  const pointGeo = useMemo(() => {
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
          properties: { code: r.code, v, label: String(v), _color: scoreColor(v) },
          geometry: { type: 'Point', coordinates: c },
        }]
      }),
    }
  }, [geo, risks, colorBy])

  useEffect(() => {
    if (!geo || !mapRef.current) return
    const [minX, minY, maxX, maxY] = bbox(geo)
    mapRef.current.fitBounds([[minX, minY], [maxX, maxY]], { padding: 64, duration: 0 })
  }, [geo])

  const sel = selectedCode ?? ''

  return (
    <MapGL
      ref={mapRef}
      mapStyle={STYLE as any}
      initialViewState={{ longitude: 120.6, latitude: 23.8, zoom: 6.4 }}
      interactiveLayerIds={['county-fill', 'county-circle']}
      onClick={(e) => {
        const f = e.features?.[0]
        const code = f?.properties?.code ?? f?.properties?.COUNTYCODE
        if (code) onSelect(code)
      }}
      style={{ width: '100%', height: '100%' }}
    >
      {geo && (
        <Source id="counties" type="geojson" data={geo}>
          <Layer
            id="county-fill"
            type="fill"
            paint={{
              'fill-color': ['case', ['==', ['get', 'COUNTYCODE'], sel], '#232833', '#15171d'],
              'fill-opacity': 1,
            }}
          />
          <Layer
            id="county-line"
            type="line"
            paint={{
              'line-color': ['case', ['==', ['get', 'COUNTYCODE'], sel], '#4ec9a3', '#ffffff'],
              'line-opacity': ['case', ['==', ['get', 'COUNTYCODE'], sel], 0.9, 0.1],
              'line-width': ['case', ['==', ['get', 'COUNTYCODE'], sel], 1.6, 0.5],
            }}
          />
        </Source>
      )}
      {pointGeo && (
        <Source id="points" type="geojson" data={pointGeo as any}>
          <Layer
            id="county-circle"
            type="circle"
            paint={{
              'circle-radius': ['interpolate', ['linear'], ['get', 'v'], 0, 9, 50, 20, 100, 34],
              'circle-color': ['get', '_color'],
              'circle-opacity': 0.85,
              'circle-blur': 0.12,
              'circle-stroke-color': ['case', ['==', ['get', 'code'], sel], '#4ec9a3', '#000000'],
              'circle-stroke-width': ['case', ['==', ['get', 'code'], sel], 2, 0.5],
              'circle-stroke-opacity': ['case', ['==', ['get', 'code'], sel], 1, 0.25],
            }}
          />
          <Layer
            id="county-label"
            type="symbol"
            layout={{
              'text-field': ['get', 'label'],
              'text-font': ['Open Sans Semibold'],
              'text-size': 13,
              'text-allow-overlap': true,
              'text-ignore-placement': true,
            }}
            paint={{
              'text-color': '#ffffff',
              'text-halo-color': '#000000',
              'text-halo-width': 1.1,
              'text-halo-blur': 0.3,
            }}
          />
        </Source>
      )}
    </MapGL>
  )
}
