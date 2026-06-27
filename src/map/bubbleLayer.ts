import L from 'leaflet'
import { registry } from '../data/registry'
import { getDictValue } from '../data/aggregator'
import { getMap, PANES, getColor, calcBreaks } from './mapController'
import { getLocKeys, makeTooltip, getScopeFilters, isInScope, getCentroid } from './layerUtils'
import type { AppState } from '../store/useAppStore'

let _layerGroup: L.LayerGroup | null = null

/** สร้าง Bubble Layer (Optimized: Single Pass + Centroid Cache) */
export function mountBubbles(
  dictionary: AppState['dictionary'], dateKey: string, level: AppState['adminLevel'],
  palette: string, scope: AppState['scope'], breaks?: number[], customColors?: string[],
  bubbleScale: number = 1.0
): void {
  const map = getMap()
  if (!map) return

  // ล้างของเก่า
  if (_layerGroup) { map.removeLayer(_layerGroup); _layerGroup = null }
  _layerGroup = L.layerGroup().addTo(map)

  const features = registry.getFeatures(level)
  const filters = getScopeFilters(scope)
  
  // หาค่าสูงสุดสำหรับคำนวณขนาด (ถ้าไม่มี Breaks ส่งมา)
  let maxVal = (breaks && breaks.length > 0) ? breaks[breaks.length - 1] : 0
  if (!maxVal) {
    features.forEach(f => {
      const { p, a, t, pCode, aCode, tCode } = getLocKeys(f.properties, level)
      if (!isInScope(pCode, aCode, filters, tCode)) return
      const v = getDictValue(dictionary, dateKey, p, a, t, level, pCode, aCode, tCode)
      if (v > maxVal) maxVal = v
    })
  }
  if (!maxVal) maxVal = 1

  // Resolve active breaks for coloring
  const activeBreaks = (breaks && breaks.length > 0) ? breaks : []
  if (activeBreaks.length === 0) {
    const allVals: number[] = []
    features.forEach(f => {
      const { p, a, t, pCode, aCode, tCode } = getLocKeys(f.properties, level)
      if (!isInScope(pCode, aCode, filters, tCode)) return
      const v = getDictValue(dictionary, dateKey, p, a, t, level, pCode, aCode, tCode)
      if (v > 0) allVals.push(v)
    })
    if (allVals.length > 0) {
      activeBreaks.push(...calcBreaks(allVals))
    }
  }

  // วาด Bubble
  features.forEach(f => {
    const { p, a, t, pCode, aCode, tCode } = getLocKeys(f.properties, level)
    
    // 1. เช็ค Scope (Barcode Check - เร็วมาก)
    if (!isInScope(pCode, aCode, filters, tCode)) return

    // 2. ดึงค่า
    const val = getDictValue(dictionary, dateKey, p, a, t, level, pCode, aCode, tCode)
    if (!val || val <= 0) return

    // 3. หาจุดกึ่งกลาง (ใช้ Cache จาก layerUtils - เร็วมาก)
    const centroid = getCentroid(f)
    if (!centroid) return

    // 4. คำนวณขนาดและสร้าง Marker
    const radius = Math.max(3, Math.sqrt(val / maxVal) * 20 * bubbleScale)
    
    // Use active breaks and palette to color the bubble
    const fillColor = getColor(val, activeBreaks, palette, customColors)

    const circle = L.circleMarker(centroid, {
      pane: PANES.BUBBLE.name, radius, fillColor, color: '#ffffff',
      weight: 1.5, opacity: 0.9, fillOpacity: 0.7, bubblingMouseEvents: true
    })

    circle.bindTooltip(makeTooltip(p, a, t, val, level), { sticky: true, className: 'spatio-tooltip', opacity: 1 })
    _layerGroup?.addLayer(circle)
  })
}

export function destroyBubbles(): void { if (_layerGroup) { getMap()?.removeLayer(_layerGroup); _layerGroup = null } }
