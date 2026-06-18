import { useEffect, useMemo, useRef, useState } from 'react'
import MapGL, { Source, Layer, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import bbox from '@turf/bbox'
import { scoreColor } from '@/lib/colors'
import { computeCentroids } from '@/lib/centroids'
import type { CountyRisk, MetricKey } from '@/lib/types'
import type { DisasterEvent } from '@/lib/disasters/types'

type ColorBy = 'composite' | MetricKey

function valueFor(r: CountyRisk, colorBy: ColorBy): number {
  if (colorBy === 'composite') return r.score ?? 0
  return r.subScores[colorBy] ?? 0
}

// 真實向量底圖（OpenFreeMap positron，免費免 key）：真海岸線/水域/中文地名 → 質感。
// 縣市界、壓力圓泡、事件高亮疊在其上。
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'
const MAP_FONT = 'Noto Sans Regular' // positron glyphs 內含

interface Props {
  risks: CountyRisk[]
  colorBy: ColorBy
  selectedCode: string | null
  onSelect: (code: string) => void
  events?: DisasterEvent[]
  showEvents?: boolean
  highlightCodes?: string[] // 點選某事件時，高亮它影響的縣市
}

export function MapView({ risks, colorBy, selectedCode, onSelect, events, showEvents, highlightCodes }: Props) {
  const mapRef = useRef<MapRef>(null)
  const [geo, setGeo] = useState<any>(null)

  useEffect(() => {
    fetch('/taiwan-counties.json').then((r) => r.json()).then(setGeo)
  }, [])

  const quakeGeo = useMemo(() => {
    const eqs = (events ?? []).filter((e) => e.type === 'earthquake' && e.lat != null && e.lon != null)
    return {
      type: 'FeatureCollection',
      features: eqs.map((e) => ({
        type: 'Feature',
        properties: { mag: e.magnitude ?? 0, label: `M${e.magnitude ?? '?'}`, sev: e.severity },
        geometry: { type: 'Point', coordinates: [e.lon, e.lat] },
      })),
    }
  }, [events])

  const hlSet = useMemo(() => new Set(highlightCodes ?? []), [highlightCodes])

  // 每縣市面注入高亮旗標（點選事件時其影響縣市）
  const fillGeo = useMemo(() => {
    if (!geo) return null
    return {
      ...geo,
      features: geo.features.map((f: any) => ({
        ...f,
        properties: {
          ...f.properties,
          _hl: hlSet.has(f.properties.COUNTYCODE) ? 1 : 0,
        },
      })),
    }
  }, [geo, hlSet])

  useEffect(() => {
    if (!geo || !mapRef.current) return
    const [minX, minY, maxX, maxY] = bbox(geo)
    mapRef.current.fitBounds([[minX, minY], [maxX, maxY]], { padding: 64, maxZoom: 8.5, duration: 0 })
  }, [geo])

  // 縣市壓力圓泡：每縣市質心一個圓，大小+顏色+圓內數字＝壓力分（worldmonitor 風）
  const bubbleGeo = useMemo(() => {
    if (!geo) return null
    const centroids = computeCentroids(geo)
    return {
      type: 'FeatureCollection',
      features: risks.flatMap((r) => {
        const c = centroids[r.code]
        if (!c || r.score === null) return []
        const v = valueFor(r, colorBy)
        return [{
          type: 'Feature',
          properties: { code: r.code, v, label: String(v), color: scoreColor(v) },
          geometry: { type: 'Point', coordinates: c },
        }]
      }),
    }
  }, [geo, risks, colorBy])

  const sel = selectedCode ?? ''

  return (
    <div className="absolute inset-0">
      <MapGL
        ref={mapRef}
        mapStyle={MAP_STYLE}
        initialViewState={{ longitude: 120.7, latitude: 23.8, zoom: 6.6 }}
        minZoom={6}
        maxZoom={9.5}
        dragRotate={false}
        touchPitch={false}
        pitchWithRotate={false}
        interactiveLayerIds={['county-fill', 'county-bubble']}
        onClick={(e) => {
          const p = e.features?.[0]?.properties
          const code = p?.code ?? p?.COUNTYCODE
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
                // 底圖已顯示陸地，縣市面平時透明；點選事件時其縣市青色高亮
                'fill-color': '#1f6f8b',
                'fill-opacity': ['case', ['==', ['get', '_hl'], 1], 0.22, 0],
              }}
            />
            <Layer
              id="county-line"
              type="line"
              paint={{
                'line-color': ['case', ['==', ['get', 'COUNTYCODE'], sel], '#b5532f', '#232019'],
                'line-opacity': ['case', ['==', ['get', 'COUNTYCODE'], sel], 1, 0.22],
                'line-width': ['case', ['==', ['get', 'COUNTYCODE'], sel], 2, 0.5],
              }}
            />
            <Layer
              id="county-highlight"
              type="line"
              filter={['==', ['get', '_hl'], 1]}
              paint={{ 'line-color': '#1f6f8b', 'line-width': 2.5, 'line-dasharray': [2, 1.5], 'line-opacity': 1 }}
            />
          </Source>
        )}
        {bubbleGeo && (
          <Source id="bubbles" type="geojson" data={bubbleGeo as any}>
            <Layer
              id="county-bubble"
              type="circle"
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['get', 'v'], 0, 9, 50, 18, 100, 30],
                'circle-color': ['get', 'color'],
                'circle-opacity': 0.82,
                'circle-stroke-color': ['case', ['==', ['get', 'code'], sel], '#231f18', '#ffffff'],
                'circle-stroke-width': ['case', ['==', ['get', 'code'], sel], 2, 1],
                'circle-stroke-opacity': ['case', ['==', ['get', 'code'], sel], 1, 0.6],
              }}
            />
            <Layer
              id="county-bubble-label"
              type="symbol"
              layout={{
                'text-field': ['get', 'label'],
                'text-font': [MAP_FONT],
                'text-size': 12,
                'text-allow-overlap': true,
                'text-ignore-placement': true,
              }}
              paint={{
                'text-color': '#ffffff',
                'text-halo-color': '#3a2a1e',
                'text-halo-width': 1.1,
                'text-halo-blur': 0.2,
              }}
            />
          </Source>
        )}
        {showEvents !== false && (
          <Source id="quakes" type="geojson" data={quakeGeo as any}>
            <Layer
              id="quake-dot"
              type="circle"
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 3, 5, 6, 16],
                'circle-color': '#1f6f8b',
                'circle-opacity': 0.25,
                'circle-stroke-color': '#1f6f8b',
                'circle-stroke-width': 1.5,
              }}
            />
            <Layer
              id="quake-label"
              type="symbol"
              layout={{ 'text-field': ['get', 'label'], 'text-font': [MAP_FONT], 'text-size': 11, 'text-allow-overlap': true }}
              paint={{ 'text-color': '#10394a', 'text-halo-color': '#f4efe4', 'text-halo-width': 1.4 }}
            />
          </Source>
        )}
      </MapGL>
    </div>
  )
}
