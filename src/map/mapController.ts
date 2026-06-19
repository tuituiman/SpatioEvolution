/**
 * mapController.ts — Leaflet Map Initialization & Pane Manager
 * สร้างแผนที่ + จัดการ Panes แบบ strict Z-index
 */
import L from 'leaflet'
import { registry } from '../data/registry'
import type { AdminLevel } from '../store/useAppStore'
import { useAppStore } from '../store/useAppStore'
import { locationResolver } from '../data/locationResolver'

// ──────────────────────────────────────────
// Constants
// ──────────────────────────────────────────
export const PANES = {
  BASE: { name: 'basePane', z: 210 },
  CHOROPLETH: { name: 'choroplethPane', z: 400 },
  BUBBLE: { name: 'bubblePane', z: 450 }, // เพิ่มตัวนี้
  MASK: { name: 'maskPane', z: 500 },
  BORDER: { name: 'borderPane', z: 600 },
  LABEL: { name: 'labelPane', z: 650 },
} as const

export const COLOR_PALETTES: Record<string, string[]> = {
  YlOrRd: ['#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026'],
  Blues: ['#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
  Greens: ['#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
  Reds: ['#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'],
  YlGnBu: ['#edf8b1', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#0c2c84'],
  Spectral: ['#d53e4f', '#fc8d59', '#fee08b', '#ffffbf', '#e6f598', '#99d594', '#3288bd'],
  GnYlRd: ['#1a9850', '#91cf60', '#d9ef8b', '#fee08b', '#fdbb6f', '#f46d43', '#d73027'],
  Spectrum: ['#2b5c8f', '#46a3b7', '#5da570', '#e3c654', '#e28f37', '#d35235', '#b11e1e'],
}

// ──────────────────────────────────────────
// Map instance (singleton)
// ──────────────────────────────────────────
let _map: L.Map | null = null
let _currentTileLayer: L.TileLayer | null = null

// เก็บตำแหน่งแผนที่ล่าสุด แยกกันระหว่างหน้า live explorer กับหน้า export canvas
let _explorerCenter: [number, number] = [13.0, 101.5]
let _explorerZoom: number = 6
let _exportCenter: [number, number] = [13.0, 101.5]
let _exportZoom: number = 6

/** สลับความสำคัญ of Layer (ใครอยู่หน้า ใครอยู่หลัง) */
export function setPanePriority(activeMode: 'choropleth' | 'bubble'): void {
  const map = _map
  if (!map) return

  const cPane = map.getPane(PANES.CHOROPLETH.name)
  const bPane = map.getPane(PANES.BUBBLE.name)

  if (cPane && bPane) {
    if (activeMode === 'choropleth') {
      cPane.style.zIndex = '450'
      bPane.style.zIndex = '400'
    } else {
      cPane.style.zIndex = '400'
      bPane.style.zIndex = '450'
    }
  }
}

export function getMap(): L.Map | null { return _map }

export function destroyMap(): void {
  if (_map) {
    try { _map.remove() } catch { /* ignore */ }
    _map = null
  }
  useAppStore.getState().setMapReady(false)
}

/** สร้างแผนที่ + Panes + Base Tile */
export function initMap(containerId: string, isExportMode: boolean = false): L.Map | null {
  // ลบ instance เก่าและอัปเดตสถานะก่อนตรวจสอบคอนเทนเนอร์
  destroyMap()

  const container = document.getElementById(containerId)
  if (!container) return null

  // ลบ Leaflet internal references ใน container DOM element
  // (ป้องกัน "Map container is being reused by another instance")
  const c = container as unknown as Record<string, unknown>
  delete c._leaflet_id
  delete c._leaflet

  const center = isExportMode ? _exportCenter : _explorerCenter
  const zoom = isExportMode ? _exportZoom : _explorerZoom

  const map = L.map(containerId, {
    center,   // คืนตำแหน่งตามโหมดหน้าจอ
    zoom,
    zoomControl: false,
    attributionControl: false,
    preferCanvas: true,
    maxZoom: 20, // ขยายระดับการซูมของแผนที่สูงสุดเป็น 20
    zoomSnap: 0.2, // ซูมแบบละเอียดระดับ 0.2 ขั้น
    zoomDelta: 0.2, // ซูมทีละ 0.2 เมื่อกดปุ่มซูม
    wheelPxPerZoomLevel: 120, // ให้การสกรอลเมาส์ซูมเข้าออกสมูทและช้าลงอย่างละเอียด
    zoomAnimation: true,
    zoomAnimationThreshold: 10,
    fadeAnimation: true,
    markerZoomAnimation: true,
  })

  // บันทึกตำแหน่งแยกตามโหมดหน้าจอทุกครั้งที่เลื่อน
  map.on('moveend', () => {
    const c = map.getCenter()
    if (!c || isNaN(c.lat) || isNaN(c.lng)) return
    const size = map.getSize()
    if (size.x === 0 || size.y === 0) return

    if (isExportMode) {
      _exportCenter = [c.lat, c.lng]
      _exportZoom = map.getZoom()
    } else {
      _explorerCenter = [c.lat, c.lng]
      _explorerZoom = map.getZoom()
    }
  })

  // พื้นหลังใน container = มืด (เหน็นก่อนที่ tile โหลด)
  container.style.backgroundColor = '#0f172a' // Slate 900 (dark ocean)

  // ── Create Panes ──
  for (const pane of Object.values(PANES)) {
    if (!map.getPane(pane.name)) {
      const el = map.createPane(pane.name)
      el.style.zIndex = String(pane.z)
      if (pane.name === 'maskPane' || pane.name === 'borderPane' || pane.name === 'basePane') {
        el.style.pointerEvents = 'none'
      }
    }
  }

  // Zoom control → ใช้ React buttons แทน (อยู่ใต้ปุ่ม upload ขวาบน)

  // ── Sync and Initialize Tile Layer ──
  const storeState = useAppStore.getState()
  const style = storeState.baseMapStyle || 'dark'
  const showBaseMap = storeState.showBaseMap

  let url = 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
  let maxNativeZoom = 19

  if (style === 'street') {
    url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    maxNativeZoom = 19
  } else if (style === 'satellite') {
    url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    maxNativeZoom = 17
  }

  _currentTileLayer = L.tileLayer(url, {
    maxZoom: 20,
    maxNativeZoom: maxNativeZoom,
    pane: PANES.BASE.name,
    opacity: showBaseMap ? 1 : 0,
    crossOrigin: true,
  }).addTo(map)

  _map = map
  useAppStore.getState().setMapReady(true)
  useAppStore.getState().incrementMapVersion()

  console.log('[MapController] Map initialized')
  return map
}

/** โหลด GeoJSON จาก JSON files (ดีกว่า global vars) */
export async function loadGeoDataFromJSON(basePath?: string): Promise<void> {
  if (registry.isReady) {
    console.log('[MapController] Registry already loaded. Skipping GeoJSON load.')
    return
  }

  // Ensure LocationResolver is initialized first
  await locationResolver.init()

  const finalBasePath = basePath ?? `${import.meta.env.BASE_URL || '/'}/geodata`.replace(/\/+/g, '/')
  const tasks: Array<{ url: string; level: AdminLevel; name: string }> = [
    { url: `${finalBasePath}/provinces.json`, level: 'province', name: 'provinces' },
    { url: `${finalBasePath}/districts.json`, level: 'district', name: 'districts' },
    { url: `${finalBasePath}/subdistricts.json`, level: 'subdistrict', name: 'subdistricts' },
  ]

  await Promise.all(tasks.map(async ({ url, level, name }) => {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      registry.load(data, level)
      console.log(`[MapController] Loaded ${name}`)
    } catch (e) {
      console.warn(`[MapController] Failed to load ${name}: ${e}`)
    }
  }))

  registry.markReady()
  console.log('[MapController] Registry ready ✓')
}

// loadGeoDataFromGlobals ถูกลบออก — ใช้ loadGeoDataFromJSON แทนทุกกรณี

/** ย้ายแผนที่ไปโฟกัสพื้นที่ที่เลือกตามลำดับชั้นเขต (Subdistrict -> District -> Province -> Health Zone) */
export function fitToScope(
  province = 'all',
  district = 'all',
  subdistrict = 'all',
  region = 'all'
): void {
  const map = _map
  if (!map) return

  // 1. Zoom to subdistrict
  if (province !== 'all' && district !== 'all' && subdistrict && subdistrict !== 'all') {
    import('../data/healthZones').then(({ computeSubdistrictBounds }) => {
      const bounds = computeSubdistrictBounds(province, district, subdistrict)
      if (bounds) {
        map.flyToBounds(bounds, { padding: [40, 40], duration: 1.0 })
      }
    })
    return
  }

  // 2. Zoom to district
  if (province !== 'all' && district !== 'all') {
    import('../data/healthZones').then(({ computeDistrictBounds }) => {
      const bounds = computeDistrictBounds(province, district)
      if (bounds) {
        map.flyToBounds(bounds, { padding: [40, 40], duration: 1.0 })
      }
    })
    return
  }

  // 3. Zoom to province
  if (province !== 'all') {
    import('../data/healthZones').then(({ computeProvinceBounds }) => {
      const bounds = computeProvinceBounds(province)
      if (bounds) {
        map.flyToBounds(bounds, { padding: [40, 40], duration: 1.0 })
      }
    })
    return
  }

  // 4. Zoom to health zone (region)
  if (region !== 'all') {
    import('../data/healthZones').then(({ HEALTH_ZONES }) => {
      const zone = HEALTH_ZONES.find(z => z.id === Number(region))
      if (zone && zone.bounds) {
        map.flyToBounds(zone.bounds as L.LatLngBoundsExpression, { padding: [40, 40], duration: 1.0 })
      }
    })
    return
  }

  // 5. Zoom to whole country (fitBounds to Thailand coordinates instead of fixed zoom level)
  map.flyToBounds([[5.61, 97.34], [20.46, 105.63]], { padding: [40, 40], duration: 1.0 })
}

export function getNextStartValue(v: number): number {
  const str = v.toString()
  const dotIdx = str.indexOf('.')
  if (dotIdx === -1) {
    return v + 1
  }
  const numDecimals = str.length - dotIdx - 1
  const increment = Math.pow(10, -numDecimals)
  return Number((v + increment).toFixed(numDecimals))
}

export function calcBreaks(values: number[], numClasses: number = 5): number[] {
  let defaultBreaks = [1, 5, 10, 50, 100, 500, 1000, 5000]
  const targetLen = numClasses - 1
  if (values.length === 0) return defaultBreaks.slice(0, targetLen)
  const sorted = [...values].filter(v => v > 0).sort((a, b) => a - b)
  if (sorted.length === 0) return defaultBreaks.slice(0, targetLen)

  const len = sorted.length
  const breaks: number[] = []
  for (let i = 1; i <= targetLen; i++) {
    const fraction = i / numClasses
    const index = Math.floor(len * fraction)
    const val = sorted[index >= len ? len - 1 : index] ?? defaultBreaks[i - 1] ?? i
    breaks.push(val)
  }

  const unique = [...new Set(breaks)].filter(v => v > 0).sort((a, b) => a - b)

  // Calculate dynamic step size based on actual unique breaks sequence
  let step = 10
  if (unique.length >= 2) {
    step = unique[unique.length - 1] - unique[unique.length - 2]
  } else if (unique.length === 1) {
    step = unique[0] > 0 ? unique[0] : 10
  }
  if (step <= 0) step = 10

  // Handle float precision if unique breaks contain decimals
  let decimalPlaces = 0
  unique.forEach(v => {
    const str = v.toString()
    const dotIdx = str.indexOf('.')
    if (dotIdx !== -1) {
      const dec = str.length - dotIdx - 1
      if (dec > decimalPlaces) decimalPlaces = dec
    }
  })

  while (unique.length < targetLen) {
    const lastVal = unique[unique.length - 1] ?? 0
    const nextVal = parseFloat((lastVal + step).toFixed(decimalPlaces))
    unique.push(nextVal)
  }
  return unique
}

/** แปลงค่า → สี */
export function getColor(value: number, breaks: number[], palette: string, customColors?: string[]): string {
  if (value <= 0) return 'transparent'
  const colors = (palette === 'Custom' && customColors && customColors.length > 0)
    ? customColors
    : (COLOR_PALETTES[palette] ?? COLOR_PALETTES.YlOrRd)
  for (let i = 0; i < breaks.length; i++) {
    if (value <= breaks[i]) return colors[i] ?? colors[colors.length - 1]
  }
  return colors[breaks.length] ?? colors[colors.length - 1]
}

/** ซูมแผนที่ไปยัง bounds ที่กำหนด */
export function zoomToBounds(
  bounds: L.LatLngBoundsExpression,
  options?: L.FitBoundsOptions
): void {
  const map = getMap()
  if (!map) return
  map.flyToBounds(bounds, { padding: [30, 30], maxZoom: 11, duration: 1.0, ...options })
}

/** รีเซ็ตมุมมองกลับเต็มประเทศ */
export function resetZoom(): void {
  const map = getMap()
  if (!map) return
  map.flyToBounds([[5.61, 97.34], [20.46, 105.63]], { padding: [40, 40], duration: 1.0 })
}

/** สลับแผนที่ฐาน (Base Map) เป็นแบบโลกมืด แผนที่ถนน หรือภาพดาวเทียม */
export function switchBaseMap(style: 'dark' | 'street' | 'satellite'): void {
  const map = _map
  if (!map) return

  if (_currentTileLayer) {
    map.removeLayer(_currentTileLayer)
    _currentTileLayer = null
  }

  let url = 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
  let maxNativeZoom = 19

  if (style === 'street') {
    url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    maxNativeZoom = 19
  } else if (style === 'satellite') {
    url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    maxNativeZoom = 17 // ระดับ 17 ปลอดภัยที่สุดในไทย เพื่อให้ซูมลึกกว่านี้แล้ว Leaflet ยืดขยายภาพอัตโนมัติแทนการขึ้นตารางเทา
  }

  const showBaseMap = useAppStore.getState().showBaseMap

  _currentTileLayer = L.tileLayer(url, {
    maxZoom: 20,
    maxNativeZoom: maxNativeZoom,
    pane: PANES.BASE.name,
    opacity: showBaseMap ? 1 : 0,
    crossOrigin: true,
  }).addTo(map)

  console.log(`[MapController] Base map switched to: ${style}, maxNativeZoom: ${maxNativeZoom}`)
}

/** สลับการแสดงผล/ซ่อน แผนที่พื้นหลัง (Base Map) */
export function updateBaseMapVisibility(show: boolean): void {
  if (_currentTileLayer) {
    _currentTileLayer.setOpacity(show ? 1 : 0)
  }
}
