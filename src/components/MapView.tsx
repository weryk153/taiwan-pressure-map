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

function circlePolygon(lng: number, lat: number, radiusKm: number, seg = 48): number[][] {
  const coords: number[][] = []
  const dLat = radiusKm / 110.574
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * 2 * Math.PI
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)])
  }
  return coords
}

const STYLE = {
  version: 8 as const,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'bg', type: 'background' as const, paint: { 'background-color': '#0a0e14' } }],
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

  const fillGeo = useMemo(() => {
    if (!geo) return null
    return {
      ...geo,
      features: geo.features.map((f: any) => {
        const r = byCode.get(f.properties.COUNTYCODE)
        const v = r ? valueFor(r, colorBy) : 0
        return { ...f, properties: { ...f.properties, _v: v, _color: scoreColor(v) } }
      }),
    }
  }, [geo, byCode, colorBy])

  const barGeo = useMemo(() => {
    if (!geo) return null
    const centroids = computeCentroids(geo)
    return {
      type: 'FeatureCollection',
      features: risks.flatMap((r) => {
        const c = centroids[r.code]
        if (!c) return []
        const v = valueFor(r, colorBy)
        const radius = 4 + r.confidence * 6 // km
        return [{
          type: 'Feature',
          properties: { _height: v * 600, _color: scoreColor(v) },
          geometry: { type: 'Polygon', coordinates: [circlePolygon(c[0], c[1], radius)] },
        }]
      }),
    }
  }, [geo, risks, colorBy])

  useEffect(() => {
    if (!geo || !mapRef.current) return
    const [minX, minY, maxX, maxY] = bbox(geo)
    mapRef.current.fitBounds([[minX, minY], [maxX, maxY]], { padding: 40, duration: 0 })
  }, [geo])

  return (
    <MapGL
      ref={mapRef}
      mapStyle={STYLE as any}
      initialViewState={{ longitude: 120.9, latitude: 23.8, zoom: 6, pitch: 45 }}
      interactiveLayerIds={['county-fill']}
      onClick={(e) => {
        const f = e.features?.[0]
        if (f) onSelect(f.properties!.COUNTYCODE)
      }}
      style={{ width: '100%', height: '100%' }}
    >
      {fillGeo && (
        <Source id="counties" type="geojson" data={fillGeo}>
          <Layer
            id="county-fill"
            type="fill"
            paint={{ 'fill-color': ['get', '_color'], 'fill-opacity': 0.55 }}
          />
          <Layer
            id="county-line"
            type="line"
            paint={{
              'line-color': ['case', ['==', ['get', 'COUNTYCODE'], selectedCode ?? ''], '#ffffff', '#2b3b4d'],
              'line-width': ['case', ['==', ['get', 'COUNTYCODE'], selectedCode ?? ''], 2.5, 0.6],
            }}
          />
        </Source>
      )}
      {barGeo && (
        <Source id="bars" type="geojson" data={barGeo as any}>
          <Layer
            id="county-bars"
            type="fill-extrusion"
            paint={{
              'fill-extrusion-color': ['get', '_color'],
              'fill-extrusion-height': ['get', '_height'],
              'fill-extrusion-opacity': 0.85,
            }}
          />
        </Source>
      )}
    </MapGL>
  )
}
