/**
 * borderLayer.ts — Static Administrative Boundaries
 * วาดเส้นแบ่ง จังหวัด/อำเภอ ตลอดเวลาเพื่อให้แผนที่ดูชัดเจน
 */
import L from 'leaflet'
import { registry } from '../data/registry'
import { getMap, PANES } from './mapController'
import { cleanName, expandMueang, findProvinceInProps } from '../data/thaiNormalizer'
import { useAppStore, type AppState } from '../store/useAppStore'

let _provinceBorder: L.GeoJSON | null = null
let _districtBorder: L.GeoJSON | null = null
let _subdistrictBorder: L.GeoJSON | null = null
let _currentScopeProvinces: Set<string> | null = null

/** Mount เส้นขอบจังหวัด อำเภอ ตำบล */
export function mountBorders(): void {
  const map = getMap()
  if (!map) return

  // 1. เส้นขอบจังหวัด
  if (!_provinceBorder) {
    const provFeatures = registry.getFeatures('province')
    _provinceBorder = L.geoJSON({ type: 'FeatureCollection', features: provFeatures } as any, {
      pane: PANES.BORDER.name,
      style: { fill: false, color: '#475569', weight: 1.2, opacity: 0.6, interactive: false }
    })
  }
  if (!map.hasLayer(_provinceBorder)) _provinceBorder.addTo(map)

  // 2. เส้นขอบอำเภอ
  if (!_districtBorder) {
    const distFeatures = registry.getFeatures('district')
    _districtBorder = L.geoJSON({ type: 'FeatureCollection', features: distFeatures } as any, {
      pane: PANES.BORDER.name,
      style: { fill: false, color: '#94a3b8', weight: 0.5, opacity: 0.4, interactive: false }
    })
  }
  if (!map.hasLayer(_districtBorder)) _districtBorder.addTo(map)

  // 3. เส้นขอบตำบล
  if (!_subdistrictBorder) {
    const subFeatures = registry.getFeatures('subdistrict')
    _subdistrictBorder = L.geoJSON({ type: 'FeatureCollection', features: subFeatures } as any, {
      pane: PANES.BORDER.name,
      style: { fill: false, color: '#cbd5e1', weight: 0.3, opacity: 0, interactive: false }
    })
  }
  if (!map.hasLayer(_subdistrictBorder)) _subdistrictBorder.addTo(map)

  console.log('[BorderLayer] Borders mounted')
}

/** อัปเดตการแสดงผลตาม Admin Level (และรักษาสถานะ Scope) */
export function updateBorderVisibility(level: AppState['adminLevel']): void {
  if (!_provinceBorder || !_districtBorder) return

  const baseMapStyle = useAppStore.getState().baseMapStyle
  const showBaseMap = useAppStore.getState().showBaseMap
  const showBoundaries = useAppStore.getState().showBoundaries
  const showZeroAreas = useAppStore.getState().showZeroAreas

  // "มีพื้นหลังขาว" ถ้า:
  // 1. เปิดระเบิดสีระบายขอบเขต (showBoundaries) และ เปิดระบายพื้นที่ว่างเป็นสีขาวทึบ (showZeroAreas)
  // 2. หรือเปิดแผนที่ฐานแบบสว่างปกติ (showBaseMap และ baseMapStyle เป็น street)
  const isWhiteBg = (showBoundaries && showZeroAreas) || (showBaseMap && baseMapStyle === 'street')

  // กำหนดสีกรอบแผนที่แบบมีคอนทราสต์สูงตามธีมพื้นหลัง
  const provColor = isWhiteBg ? '#0f172a' : '#ffffff' // จังหวัด: ดำเข้มชัดเจน / ขาวเด่นชัด
  const distColor = isWhiteBg ? '#334155' : '#cbd5e1' // อำเภอ: Slate-700 / เทา Slate-300
  const subColor = isWhiteBg ? '#64748b' : '#94a3b8'  // ตำบล: Slate-500 / เทา Slate-400

  const applyStyle = (layer: L.GeoJSON | null, style: { opacity: number; weight: number; color: string }) => {
    if (!layer) return
    layer.eachLayer((l: L.Layer) => {
      const f = (l as L.GeoJSON).feature as { properties: Record<string, unknown> }
      if (!f) return

      const p = findProvinceInProps(f.properties)
      const inScope = !_currentScopeProvinces || _currentScopeProvinces.has(p)

      if (!inScope) {
        ; (l as L.Path).setStyle({ opacity: 0, weight: 0 })
      } else {
        ; (l as L.Path).setStyle(style)
      }
    })
  }

  const map = getMap()
  if (!map) return

  if (level === 'province') {
    // แสดงเฉพาะเส้นขอบจังหวัด
    if (!map.hasLayer(_provinceBorder)) _provinceBorder.addTo(map)
    if (map.hasLayer(_districtBorder)) map.removeLayer(_districtBorder)
    if (_subdistrictBorder && map.hasLayer(_subdistrictBorder)) map.removeLayer(_subdistrictBorder)

    applyStyle(_provinceBorder, { opacity: 0.85, weight: 1.5, color: provColor })
  } else if (level === 'district') {
    // แสดงขอบจังหวัด + ขอบอำเภอ
    if (!map.hasLayer(_provinceBorder)) _provinceBorder.addTo(map)
    if (!map.hasLayer(_districtBorder)) _districtBorder.addTo(map)
    if (_subdistrictBorder && map.hasLayer(_subdistrictBorder)) map.removeLayer(_subdistrictBorder)

    applyStyle(_provinceBorder, { opacity: 1.0, weight: 1.8, color: provColor })
    applyStyle(_districtBorder, { opacity: 0.75, weight: 0.8, color: distColor })
  } else {
    // แสดงขอบจังหวัด + ขอบอำเภอ + ขอบตำบล
    if (!map.hasLayer(_provinceBorder)) _provinceBorder.addTo(map)
    if (!map.hasLayer(_districtBorder)) _districtBorder.addTo(map)
    if (_subdistrictBorder && !map.hasLayer(_subdistrictBorder)) _subdistrictBorder.addTo(map)

    applyStyle(_provinceBorder, { opacity: 1.0, weight: 2.0, color: provColor })
    applyStyle(_districtBorder, { opacity: 0.85, weight: 1.2, color: distColor })
    applyStyle(_subdistrictBorder, { opacity: 0.75, weight: 0.5, color: subColor })
  }

  // ค้ำประกัน Z-Index ชั้นเส้นแบ่ง: ให้ระดับย่อยอยู่หลังสุด -> จังหวัดทับอยู่หน้าสุดเสมอ
  if (_subdistrictBorder && map.hasLayer(_subdistrictBorder)) {
    try { _subdistrictBorder.bringToFront() } catch { }
  }
  if (_districtBorder && map.hasLayer(_districtBorder)) {
    try { _districtBorder.bringToFront() } catch { }
  }
  if (_provinceBorder && map.hasLayer(_provinceBorder)) {
    try { _provinceBorder.bringToFront() } catch { }
  }
}

export function destroyBorders(): void {
  const map = getMap()
  if (map) {
    if (_provinceBorder) { try { map.removeLayer(_provinceBorder) } catch { } }
    if (_districtBorder) { try { map.removeLayer(_districtBorder) } catch { } }
    if (_subdistrictBorder) { try { map.removeLayer(_subdistrictBorder) } catch { } }
  }
  _provinceBorder = null
  _districtBorder = null
  _subdistrictBorder = null
}

/**
 * ซ่อนเส้น border ในพื้นที่นอก scope
 * scopeProvinces = null → แสดงทั้งหมดตามปกติ
 */
export function applyBorderScope(scopeProvinces: Set<string> | null, level: AppState['adminLevel']): void {
  _currentScopeProvinces = scopeProvinces
  // สั่ง update ทันทีเพื่อให้ mask ทำงาน
  updateBorderVisibility(level)
}
