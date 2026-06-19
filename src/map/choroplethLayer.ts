/**
 * choroplethLayer.ts — ควบคุม Layer แผนที่ระบายสี (Choropleth)
 */
import L from 'leaflet'
import { registry, type GeoFeature } from '../data/registry'
import { getDictValue, getDictColor } from '../data/aggregator'
import { getMap, PANES, getColor, calcBreaks } from './mapController'
import { getLocKeys, makeTooltip, getScopeFilters, isInScope } from './layerUtils'
import { useAppStore, type AppState } from '../store/useAppStore'

let _layer: L.GeoJSON | null = null
let _currentBreaks: number[] = []
let _currentPalette: string = 'YlOrRd'
let _hasValueData: boolean = true
let _currentLevel: string = ''

/**
 * คำนวณรูปแบบสไตล์ที่เหมาะสมกับธีมแผนที่ฐาน (Base Map Style) อย่างอัจฉริยะ
 */
function getChoroplethStyle(
  baseMapStyle: 'dark' | 'street' | 'satellite',
  inScope: boolean,
  val: number,
  color: string,
  directColor?: string | null
) {
  const hasData = (val > 0) || !!directColor
  const activeColor = directColor || color

  if (!inScope) {
    // 1. แผนที่ที่ไม่ได้เลือก ให้ลบออกชั่วคราว (ซ่อน 100% ไร้รอยบดบัง)
    return { fillColor: 'transparent', fillOpacity: 0, color: 'transparent', weight: 0, opacity: 0 }
  }

  if (!hasData) {
    // 2. พื้นหลังของ scope ที่เลือก อยากให้ default สีทึบเหมือนเดิม (เทาอ่อน/ขาวทึบ 100%)
    const showZeroAreas = useAppStore.getState().showZeroAreas
    if (!showZeroAreas) {
      // ซ่อนสีพื้นหลังว่างเปล่า 0/null เพื่อให้เห็นภูมิประเทศด้านล่างแยกต่างหาก
      return { fillColor: 'transparent', fillOpacity: 0, color: '#94a3b8', weight: 0.5, opacity: 0.8 }
    }
    return { fillColor: '#f8fafc', fillOpacity: 1.0, color: '#94a3b8', weight: 0.5, opacity: 0.8 }
  }

  // พื้นที่แอกทีฟที่มีข้อมูล ถมแบบทึบ 100% เพื่อความสม่ำเสมอและสวยงามของตัวแผนที่หลัก
  return { fillColor: activeColor, fillOpacity: 1.0, color: '#94a3b8', weight: 0.5, opacity: 0.8 }
}

export function mountChoropleth(level: AppState['adminLevel']): void {
  const map = getMap()
  if (!map || (_layer && _currentLevel === level && map.hasLayer(_layer))) return

  if (_layer) { try { map.removeLayer(_layer) } catch { } }
  _currentLevel = level; _currentBreaks = []

  const features = registry.getFeatures(level)
  if (features.length === 0) return

  const baseMapStyle = useAppStore.getState().baseMapStyle

  _layer = L.geoJSON(features as any, {
    pane: PANES.CHOROPLETH.name,
    style: () => getChoroplethStyle(baseMapStyle, true, 0, '#f8fafc'),
  }).addTo(map)
}

export function updateChoropleth(
  dictionary: any,
  dateKey: string,
  level: AppState['adminLevel'],
  palette: AppState['palette'],
  scope: AppState['scope'],
  isColorOnly: boolean,
  forcedBreaks?: number[]
): void {
  if (!_layer) return
  _hasValueData = !isColorOnly
  const filters = getScopeFilters(scope)
  const scopedValues: number[] = []

  const storeState = useAppStore.getState()
  const baseMapStyle = storeState.baseMapStyle
  const colorMode = storeState.colorMode
  const customColors = storeState.customColors
  const numClasses = storeState.numClasses
  const useForced = (forcedBreaks && forcedBreaks.length > 0)

  // Pass 1: Gather all scoped values (only if breaks are not forced)
  if (!useForced) {
    _layer.eachLayer((l: any) => {
      const props = l.feature.properties
      const { p, a, t, pCode, aCode, tCode } = getLocKeys(props, level)
      const val = getDictValue(dictionary, dateKey, p, a, t, level, pCode, aCode, tCode)
      const inScope = isInScope(pCode, aCode, filters, tCode)
      if (inScope && val > 0) {
        scopedValues.push(val)
      }
    })
  }

  const breaks = useForced
    ? (forcedBreaks as number[])
    : (scopedValues.length > 0 ? calcBreaks(scopedValues, numClasses) : [])

  // Pass 2: Apply styles with the finalized breaks
  _layer.eachLayer((l: any) => {
    const props = l.feature.properties
    const { p, a, t, pCode, aCode, tCode } = getLocKeys(props, level)
    const val = getDictValue(dictionary, dateKey, p, a, t, level, pCode, aCode, tCode)

    // บังคับจำรหัสไว้เสมอ (สำคัญมากตอนสลับโหมดกลับมา)
    l._spatioPCode = pCode
    l._spatioACode = aCode
    l._spatioTCode = tCode
    l._spatioValue = val

    const inScope = isInScope(pCode, aCode, filters, tCode)

    // ดึงรหัสสีระบุเองเฉพาะเมื่อเลือกโหมด 'custom'
    const directColor = colorMode === 'custom'
      ? getDictColor(dictionary, dateKey, p, a, t, level, pCode, aCode, tCode)
      : null

    const valColor = val > 0 && breaks.length > 0
      ? getColor(val, breaks, palette, customColors)
      : '#f8fafc'

    const style = getChoroplethStyle(baseMapStyle, inScope, val, valColor, directColor)
    const cacheColorKey = `${style.fillColor}_${style.fillOpacity}_${style.color}_${style.weight}`

    if (l._lastSpatioColor !== cacheColorKey) {
      l.setStyle(style)
      l._lastSpatioColor = cacheColorKey
    }

    // จัดการ Tooltip: ผูกเฉพาะเมื่ออยู่ใน Scope และมีข้อมูลจริงเท่านั้น เพื่อไม่ให้เกิดป๊อปอัปสีดำเปล่าๆ ขึ้นรบกวนสายตา!
    const hasData = (val > 0) || !!directColor
    if (inScope && hasData) {
      l.bindTooltip(makeTooltip(p, a, t, val, level), { sticky: true, className: 'spatio-tooltip', opacity: 1 })
    } else {
      try { l.unbindTooltip() } catch { }
    }
  })

  _currentBreaks = breaks
  _currentPalette = palette
}

export function clearChoroplethColors(scope: AppState['scope'], level: AppState['adminLevel']): void {
  if (!_layer) return
  const filters = getScopeFilters(scope)
  const baseMapStyle = useAppStore.getState().baseMapStyle

  _layer.eachLayer((l: any) => {
    const { pCode, aCode, tCode } = getLocKeys(l.feature.properties, level)
    const inScope = isInScope(pCode, aCode, filters, tCode)
    
    const style = getChoroplethStyle(baseMapStyle, inScope, 0, '#f8fafc')
    const cacheColorKey = `${style.fillColor}_${style.fillOpacity}_${style.color}_${style.weight}`

    l.setStyle(style)
    l._lastSpatioColor = cacheColorKey
    l._spatioValue = 0

    // เมื่อล้างค่า ให้ล้าง Tooltip ออกด้วย เพื่อป้องกันข้อผิดพลาดการเกิดกล่องเปล่า
    try { l.unbindTooltip() } catch { }
  })
}

export function maskChoropleth(scope: AppState['scope'], level: AppState['adminLevel']): void { clearChoroplethColors(scope, level) }
export function destroyChoropleth(): void { if (_layer) { try { getMap()?.removeLayer(_layer) } catch { } _layer = null } }
export function forceRedrawChoropleth(): void {
  if (_layer) {
    _layer.eachLayer((l: any) => {
      delete l._lastSpatioColor
    })
  }
}
export function getCurrentBreaks(): number[] { return _currentBreaks }


