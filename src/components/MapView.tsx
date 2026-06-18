import { useEffect, useMemo, useRef, useState } from 'react'
import MapGL, { Source, Layer, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import bbox from '@turf/bbox'
import { scoreColor, NO_DATA_COLOR } from '@/lib/colors'
import { computeCentroids } from '@/lib/centroids'
import type { CountyRisk, MetricKey } from '@/lib/types'
import type { DisasterEvent } from '@/lib/disasters/types'

type ColorBy = 'composite' | MetricKey

function valueFor(r: CountyRisk, colorBy: ColorBy): number {
  if (colorBy === 'composite') return r.score ?? 0
  return r.subScores[colorBy] ?? 0
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
  events?: DisasterEvent[]
  showEvents?: boolean
}

export function MapView({ risks, colorBy, selectedCode, onSelect, events, showEvents }: Props) {
  const mapRef = useRef<MapRef>(null)
  const [geo, setGeo] = useState<any>(null)

  useEffect(() => {
    fetch('/taiwan-counties.json').then((r) => r.json()).then(setGeo)
  }, [])

  const byCode = useMemo(() => new Map(risks.map((r) => [r.code, r])), [risks])

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

  const alertedCodes = useMemo(() => {
    const s = new Set<string>()
    // 只描邊「嚴重」等級的縣市；常見且全台廣布的告警（強風/雷雨/高溫）改由 drawer/警示清單呈現，避免淹沒地圖
    for (const e of events ?? []) {
      if (e.type !== 'earthquake' && e.severity === 'severe') e.countyCodes.forEach((c) => s.add(c))
    }
    return s
  }, [events])

  // 每縣市面注入熱度色
  const fillGeo = useMemo(() => {
    if (!geo) return null
    return {
      ...geo,
      features: geo.features.map((f: any) => {
        const r = byCode.get(f.properties.COUNTYCODE)
        const noData = !r || r.score === null
        const v = !noData ? valueFor(r!, colorBy) : 0
        return {
          ...f,
          properties: {
            ...f.properties,
            _color: noData ? NO_DATA_COLOR : scoreColor(v),
            _alerted: alertedCodes.has(f.properties.COUNTYCODE) ? 1 : 0,
          },
        }
      }),
    }
  }, [geo, byCode, colorBy, alertedCodes])

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
        mapStyle={STYLE as any}
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
                // 中性陸地（讓壓力圓泡跳出來，不與圓泡重複編碼顏色）
                'fill-color': ['case', ['==', ['get', 'COUNTYCODE'], sel], '#ded3bf', '#e9e2d3'],
                'fill-opacity': 1,
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
              id="county-alert"
              type="line"
              filter={showEvents === false ? ['==', ['get', 'COUNTYCODE'], '__none__'] : ['==', ['get', '_alerted'], 1]}
              paint={{ 'line-color': '#1f6f8b', 'line-width': 2, 'line-dasharray': [2, 1.5], 'line-opacity': 0.9 }}
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
                'text-font': ['Open Sans Semibold'],
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
              layout={{ 'text-field': ['get', 'label'], 'text-font': ['Open Sans Semibold'], 'text-size': 11, 'text-allow-overlap': true }}
              paint={{ 'text-color': '#10394a', 'text-halo-color': '#f4efe4', 'text-halo-width': 1.4 }}
            />
          </Source>
        )}
      </MapGL>
    </div>
  )
}
