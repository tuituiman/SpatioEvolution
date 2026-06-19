import React, { useState, useEffect, useRef, useMemo } from 'react'
import L from 'leaflet'
import { useAppStore } from '../store/useAppStore'
import { getMap, getColor, COLOR_PALETTES, getNextStartValue } from '../map/mapController'
import { getLocKeys, isInScope, getScopeFilters, getCentroid } from '../map/layerUtils'
import { getDictValue, getDictColor, buildCumulativeSlice } from '../data/aggregator'
import { registry } from '../data/registry'
import { getActiveCoordinatesSlice } from '../map/pointLayer'
import { useTranslation } from '../hooks/useTranslation'
import { X, Grid } from 'lucide-react'
import clsx from 'clsx'

interface MapComparisonModalProps {
  isOpen: boolean
  onClose: () => void
}

export const MapComparisonModal: React.FC<MapComparisonModalProps> = ({ isOpen, onClose }) => {
  const { t, language } = useTranslation()
  const {
    periods,
    dictionary,
    adminLevel,
    palette,
    globalBreaks,
    baseMapStyle,
    showBaseMap,
    colorMode,
    scope,
    showZeroAreas,
    showLegendZeroRow,
    currentStep,
    showBorders,
    geoMode,
    pointStyle,
    displayMode,
    showBoundaries,
    customColors,
    isCumulative,
    timelineStartKey,
    timelineEndKey,
    breaksStart
  } = useAppStore()

  const [count, setCount] = useState<2 | 4 | 8 | 12>(2)
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>(() => {
    if (periods.length > 0) {
      const sIdx = timelineStartKey ? periods.findIndex(p => p.key === timelineStartKey) : 0
      const eIdx = timelineEndKey ? periods.findIndex(p => p.key === timelineEndKey) : periods.length - 1
      const startRange = sIdx === -1 ? 0 : sIdx
      const endRange = eIdx === -1 ? periods.length - 1 : eIdx

      let startIdx = currentStep
      if (startIdx < startRange) startIdx = startRange
      if (startIdx + count > endRange + 1) {
        startIdx = Math.max(startRange, endRange + 1 - count)
      }
      return Array.from({ length: count }).map((_, idx) => {
        const periodIdx = Math.min(startIdx + idx, endRange)
        return periods[periodIdx]?.key || ''
      })
    }
    return []
  })

  const compareMapsRef = useRef<Record<number, L.Map>>({})
  const dataLayersRef = useRef<Record<number, L.GeoJSON>>({})
  const pointLayersRef = useRef<Record<number, L.LayerGroup>>({})
  const tileLayersRef = useRef<Record<number, L.TileLayer>>({})
  const provBordersRef = useRef<Record<number, L.GeoJSON>>({})
  const distBordersRef = useRef<Record<number, L.GeoJSON>>({})
  const subBordersRef = useRef<Record<number, L.GeoJSON>>({})
  const isSyncingRef = useRef(false)
  const scopeBoundsRef = useRef<L.LatLngBounds | null>(null)

  // 1. จัดเรียงคีย์ช่วงเวลาเริ่มต้นเปรียบเทียบแบบเรียงลำดับเวลา (Sequential periods assignment)
  const periodsKey = periods.map(p => p.key).join(',')
  const [prevCompareConfig, setPrevCompareConfig] = useState({
    count,
    periodsKey,
    currentStep,
    timelineStartKey,
    timelineEndKey
  })
  if (
    count !== prevCompareConfig.count ||
    periodsKey !== prevCompareConfig.periodsKey ||
    currentStep !== prevCompareConfig.currentStep ||
    timelineStartKey !== prevCompareConfig.timelineStartKey ||
    timelineEndKey !== prevCompareConfig.timelineEndKey
  ) {
    setPrevCompareConfig({ count, periodsKey, currentStep, timelineStartKey, timelineEndKey })
    if (periods.length > 0) {
      const sIdx = timelineStartKey ? periods.findIndex(p => p.key === timelineStartKey) : 0
      const eIdx = timelineEndKey ? periods.findIndex(p => p.key === timelineEndKey) : periods.length - 1
      const startRange = sIdx === -1 ? 0 : sIdx
      const endRange = eIdx === -1 ? periods.length - 1 : eIdx

      let startIdx = currentStep
      if (startIdx < startRange) startIdx = startRange
      if (startIdx + count > endRange + 1) {
        startIdx = Math.max(startRange, endRange + 1 - count)
      }
      const keys = Array.from({ length: count }).map((_, idx) => {
        const periodIdx = Math.min(startIdx + idx, endRange)
        return periods[periodIdx]?.key || ''
      })
      setSelectedPeriods(keys)
    }
  }

  // ฟังก์ชันคำนวณรูปแบบสไตล์ขอบเขตสำหรับจอย่อย (สอดคล้องตามแผนที่หลัก)
  const getChoroplethStyle = (
    style: 'dark' | 'street' | 'satellite',
    inScope: boolean,
    val: number,
    color: string,
    directColor?: string | null
  ) => {
    const hasData = (val > 0) || !!directColor
    const activeColor = directColor || color

    if (!inScope) {
      return { fillColor: 'transparent', fillOpacity: 0, color: 'transparent', weight: 0, opacity: 0 }
    }

    if (!hasData) {
      if (!showZeroAreas) {
        return { fillColor: 'transparent', fillOpacity: 0, color: '#94a3b8', weight: 0.5, opacity: 0.8 }
      }
      return { fillColor: '#f8fafc', fillOpacity: 1.0, color: '#94a3b8', weight: 0.5, opacity: 0.8 }
    }

    return { fillColor: activeColor, fillOpacity: 1.0, color: '#94a3b8', weight: 0.5, opacity: 0.8 }
  }

  // 2. เมาท์และซิงโครไนซ์ตำแหน่งแผนที่ Leaflet ในจอย่อยทั้งหมด (Leaflet Initialization & Sync)
  useEffect(() => {
    if (!isOpen || periods.length === 0) return

    // ทำลายสเตตตัวเก่าทั้งหมดก่อนวาดใหม่ (ป้องกัน Memory Leak)
    destroyMaps()

    const mainMap = getMap()
    const center = mainMap ? mainMap.getCenter() : new L.LatLng(13.736717, 100.523186)
    const zoom = mainMap ? mainMap.getZoom() : 6

    const syncViews = (e: any) => {
      if (isSyncingRef.current) return
      isSyncingRef.current = true
      const targetMap = e.target
      const targetCenter = targetMap.getCenter()
      const targetZoom = targetMap.getZoom()

      Object.entries(compareMapsRef.current).forEach(([idxStr, m]) => {
        if (m && m !== targetMap) {
          m.setView(targetCenter, targetZoom, { animate: false })
        }
      })
      isSyncingRef.current = false
    }

    // สร้างแผนที่ย่อยตามจำนวนหน้าจอเปรียบเทียบ
    for (let i = 0; i < count; i++) {
      const containerId = `compare-map-${i}`
      const containerEl = document.getElementById(containerId)
      if (!containerEl) continue

      const map = L.map(containerId, {
        zoomControl: false,
        attributionControl: false
      })
      compareMapsRef.current[i] = map

      L.control.zoom({ position: 'topright' }).addTo(map)

      // ซิงค์ตำแหน่งและระดับซูมแรกเริ่มจากแผนที่หลัก
      map.setView(center, zoom, { animate: false })

      // ซิงค์แผนที่ฐาน (Base Map Style)
      updateTileLayer(i, baseMapStyle, showBaseMap)

      // แนบ Event Listener เพื่อทำการซิงค์พิกัดเมื่อลาก/ซูม
      map.on('drag', syncViews)
      map.on('zoom', syncViews)
    }

    // วาดสีกราฟิกขอบเขตข้อมูล
    renderAllData()

    return () => {
      destroyMaps()
    }
  }, [isOpen, count, adminLevel, baseMapStyle, showBaseMap, scope, showZeroAreas, showBorders, geoMode, pointStyle, displayMode, showBoundaries])

  // ฟังก์ชันคำนวณปรับขนาดและตำแหน่งกล้องแผนที่ให้ Fit ขอบเขตจังหวัด/อำเภอ/ตำบล ที่เลือกโดยอัตโนมัติ
  const fitAllMapBounds = () => {
    Object.entries(compareMapsRef.current).forEach(([idxStr, map]) => {
      const idx = Number(idxStr)
      if (!map) return

      if (scopeBoundsRef.current && scopeBoundsRef.current.isValid()) {
        map.fitBounds(scopeBoundsRef.current, { padding: [15, 15], animate: false })
      } else {
        const mainMap = getMap()
        if (mainMap) {
          map.setView(mainMap.getCenter(), mainMap.getZoom(), { animate: false })
        }
      }
    })
  }

  // 4. บังคับให้ Leaflet คำนวณขนาดช่องและ Fit แผนที่โดยอัตโนมัติเมื่อเปิดใช้งาน (Invalidate Size to Fit Slots)
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        Object.values(compareMapsRef.current).forEach(m => {
          if (m) {
            m.invalidateSize({ animate: false })
          }
        })
        fitAllMapBounds()
      }, 350)
      return () => clearTimeout(timer)
    }
  }, [isOpen, count])

  // วาดสีกราฟิกและ Tooltip ใหม่เมื่อตัวเลือกวันเวลาของจอย่อยนั้นๆ มีการเปลี่ยนแปลง
  useEffect(() => {
    if (!isOpen) return
    selectedPeriods.forEach((periodKey, idx) => {
      if (periodKey) {
        renderMapData(idx, periodKey)
      }
    })
  }, [selectedPeriods, dictionary, palette, globalBreaks, colorMode, geoMode, pointStyle, displayMode, showBoundaries, customColors, showZeroAreas, showBorders, adminLevel, isCumulative])

  function updateTileLayer(idx: number, style: 'dark' | 'street' | 'satellite', show: boolean) {
    const map = compareMapsRef.current[idx]
    if (!map) return

    if (tileLayersRef.current[idx]) {
      map.removeLayer(tileLayersRef.current[idx])
    }

    let url = 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
    let maxNativeZoom = 19

    if (style === 'street') {
      url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    } else if (style === 'satellite') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      maxNativeZoom = 17
    }

    const tile = L.tileLayer(url, {
      maxZoom: 20,
      maxNativeZoom,
      opacity: show ? 1 : 0
    }).addTo(map)

    tileLayersRef.current[idx] = tile
  }

  function renderAllData() {
    selectedPeriods.forEach((periodKey, idx) => {
      if (periodKey) {
        renderMapData(idx, periodKey)
      }
    })
  }

  const renderPointLayerForMap = (idx: number, map: L.Map, periodKey: string) => {
    const stepIdx = periods.findIndex(p => p.key === periodKey)
    const keysToUse = (isCumulative && stepIdx !== -1) ? periods.slice(0, stepIdx + 1).map(p => p.key) : [periodKey]
    const sliceData = getActiveCoordinatesSlice(keysToUse)
    if (sliceData.length === 0) return

    const pointGroup = L.layerGroup([])
    const colors = (palette === 'Custom' && customColors && customColors.length > 0)
      ? customColors
      : (COLOR_PALETTES[palette] ?? COLOR_PALETTES.YlOrRd)
    const breaks = globalBreaks.length > 0 ? globalBreaks : [1, 5, 10, 50, 100]

    const textStatVal = language === 'th' ? 'ค่าตัวเลขสถิติ:' : 'Statistical value:'
    const textCoords = language === 'th' ? 'พิกัด:' : 'Coords:'
    const textOutbreakCoords = language === 'th' ? 'จุดพิกัดระบาด' : 'Outbreak coordinates'
    const textCaseDensity = language === 'th' ? 'ความหนาแน่นเคส:' : 'Case density:'
    const textPatientLocation = language === 'th' ? 'ตำแหน่งผู้ป่วย' : 'Patient location'
    const textCasesHere = language === 'th' ? 'จำนวนเคสในจุดนี้:' : 'Cases count here:'

    if (pointStyle === 'proportional') {
      sliceData.forEach(pt => {
        if (pt.value <= 0) return

        const color = (colorMode === 'custom' && pt.color)
          ? pt.color
          : getColor(pt.value, breaks, palette, customColors)

        const baseRadius = 6
        const scaleFactor = Math.sqrt(pt.value) * 2.5
        const radius = Math.min(65, Math.max(6, baseRadius + scaleFactor))

        const marker = L.circleMarker([pt.lat, pt.lng], {
          radius,
          fillColor: color,
          fillOpacity: 0.65,
          color: '#ffffff',
          weight: 1.5,
          opacity: 0.9,
        })

        marker.bindTooltip(`
          <div class="p-1 text-spatio-text text-xs font-semibold">
            <div class="font-bold border-b border-spatio-border pb-1 mb-1">${pt.label ?? (language === 'th' ? 'จุดพิกัด' : 'Coordinates')}</div>
            <div>${textStatVal} <span class="text-indigo-600 dark:text-indigo-400 font-bold">${pt.value.toLocaleString()}</span></div>
            <div class="text-[10px] text-spatio-muted mt-0.5">${textCoords} ${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}</div>
          </div>
        `, {
          direction: 'top',
          className: 'spatio-tooltip-leaflet border border-spatio-border bg-spatio-surface/90 rounded-lg p-2 shadow-2xl backdrop-blur-sm'
        })

        pointGroup.addLayer(marker)
      })
    } else if (pointStyle === 'heatmap') {
      sliceData.forEach(pt => {
        if (pt.value <= 0) return

        const heatRadius = 2500 // 2.5 กิโลเมตร
        const marker = L.circle([pt.lat, pt.lng], {
          radius: heatRadius,
          fillColor: '#ef4444',
          fillOpacity: Math.min(0.2, 0.02 * pt.value),
          color: '#ef4444',
          weight: 0,
          opacity: 0
        })

        marker.bindTooltip(`
          <div class="p-1 text-spatio-text text-xs font-semibold">
            <div class="font-bold border-b border-spatio-border pb-1 mb-1">${pt.label ?? textOutbreakCoords}</div>
            <div>${textCaseDensity} <span class="text-rose-650 dark:text-rose-400 font-bold">${pt.value.toLocaleString()}</span></div>
          </div>
        `, { direction: 'top', className: 'spatio-tooltip-leaflet border border-spatio-border bg-spatio-surface/90 rounded-lg p-2' })

        pointGroup.addLayer(marker)
      })

      sliceData.forEach(pt => {
        const marker = L.circleMarker([pt.lat, pt.lng], {
          radius: 3,
          fillColor: '#ffffff',
          fillOpacity: 0.9,
          color: '#e2e8f0',
          weight: 1,
        })
        pointGroup.addLayer(marker)
      })
    } else {
      sliceData.forEach(pt => {
        if (pt.value <= 0) return

        const marker = L.circleMarker([pt.lat, pt.lng], {
          radius: 8,
          fillColor: '#4f46e5',
          fillOpacity: 0.8,
          color: '#ffffff',
          weight: 2,
          opacity: 1
        })

        marker.bindTooltip(`
          <div class="p-1 text-spatio-text text-xs font-semibold">
            <div class="font-bold border-b border-spatio-border pb-1 mb-1">${pt.label ?? textPatientLocation}</div>
            <div>${textCasesHere} <span class="text-indigo-650 dark:text-indigo-400 font-bold">${pt.value.toLocaleString()} ${language === 'th' ? 'เคส' : 'cases'}</span></div>
            <div class="text-[10px] text-spatio-muted mt-0.5">${language === 'th' ? 'พิกัดจริง:' : 'True coords:'} ${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}</div>
          </div>
        `, { direction: 'top', className: 'spatio-tooltip-leaflet border border-spatio-border bg-spatio-surface/90 rounded-lg p-2' })

        pointGroup.addLayer(marker)
      })
    }

    pointGroup.addTo(map)
    pointLayersRef.current[idx] = pointGroup
  }

  const renderBubbleLayerForMap = (
    idx: number,
    map: L.Map,
    activeDict: any,
    activeKey: string,
    features: any[],
    filters: ReturnType<typeof getScopeFilters>
  ) => {
    // 1. วาดขอบเขตแบบไม่มีสีระบายเพื่อเป็นฐานหลัง (Transparent Base Polygons)
    const baseLayer = L.geoJSON(features as any, {
      style: (feature: any) => {
        const props = feature.properties
        const { pCode, aCode } = getLocKeys(props, adminLevel)
        const inScope = isInScope(pCode, aCode, filters)

        // เรียกสไตล์เดียวกันกับแผนที่หลักเพื่อให้แสดงผลทึบ/โปร่งแสง และสวิตช์ไม่มีข้อมูลตรงกันทั้งหมด
        return getChoroplethStyle(baseMapStyle, inScope, 0, '#f8fafc')
      }
    }).addTo(map)

    dataLayersRef.current[idx] = baseLayer

    // 2. คำนวณค่าสูงสุดเพื่อทำสเกลขนาด Bubble
    let maxVal = globalBreaks.length > 0 ? globalBreaks[globalBreaks.length - 1] : 0
    if (!maxVal) {
      features.forEach(f => {
        const { p, a, t, pCode, aCode, tCode } = getLocKeys(f.properties, adminLevel)
        if (!isInScope(pCode, aCode, filters)) return
        const v = getDictValue(activeDict, activeKey, p, a, t, adminLevel, pCode, aCode, tCode)
        if (v > maxVal) maxVal = v
      })
    }
    if (!maxVal) maxVal = 1

    // 3. วาดฟองสถิติ (Bubbles) ทับบนจุดกึ่งกลาง
    const bubbleGroup = L.layerGroup([])

    features.forEach(f => {
      const { p, a, t, pCode, aCode, tCode } = getLocKeys(f.properties, adminLevel)
      if (!isInScope(pCode, aCode, filters)) return

      const val = getDictValue(activeDict, activeKey, p, a, t, adminLevel, pCode, aCode, tCode)
      if (!val || val <= 0) return

      const centroid = getCentroid(f)
      if (!centroid) return

      const radius = Math.max(3, Math.sqrt(val / maxVal) * 40)
      const fillColor = getColor(val, globalBreaks, palette, customColors)
      const circle = L.circleMarker(centroid, {
        radius,
        fillColor,
        color: '#ffffff',
        weight: 1.5,
        opacity: 0.9,
        fillOpacity: 0.7
      })

      const cp = p.replace(/^(จังหวัด|จ\.)/, '').trim()
      const ca = a.replace(/^(อำเภอ|อ\.)/, '').trim()
      const ct = t.replace(/^(ตำบล|ต\.)/, '').trim()
      let title = `จ.${cp}`
      if (adminLevel === 'district') title = `อ.${ca}, ${title}`
      if (adminLevel === 'subdistrict') title = `ต.${ct}, อ.${ca}, ${title}`

      circle.bindTooltip(`
        <div class="flex flex-col gap-0.5 font-sans">
          <div class="font-bold text-spatio-text border-b border-spatio-border pb-0.5 mb-0.5 text-[10px]">${title}</div>
          <div class="flex items-center justify-between gap-3 text-[9px]">
            <span class="text-spatio-muted">${language === 'th' ? 'จำนวน:' : 'Count:'}</span>
            <span class="font-mono font-bold text-spatio-text">${val.toLocaleString()} ${language === 'th' ? 'ราย' : 'cases'}</span>
          </div>
        </div>
      `, { sticky: true, className: 'spatio-tooltip bg-spatio-surface/90 border border-spatio-border rounded-lg p-1.5' })

      bubbleGroup.addLayer(circle)
    })

    bubbleGroup.addTo(map)
    pointLayersRef.current[idx] = bubbleGroup
  }

  const renderMapData = (idx: number, periodKey: string) => {
    const map = compareMapsRef.current[idx]
    if (!map) return

    // ลบเลเยอร์ชุดข้อมูลเดิมออกก่อน
    if (dataLayersRef.current[idx]) {
      map.removeLayer(dataLayersRef.current[idx])
      delete dataLayersRef.current[idx]
    }
    if (pointLayersRef.current[idx]) {
      map.removeLayer(pointLayersRef.current[idx])
      delete pointLayersRef.current[idx]
    }

    const allFeatures = registry.getFeatures(adminLevel)
    if (allFeatures.length === 0) return

    const filters = getScopeFilters(scope)

    // กรองเฉพาะ Features ที่อยู่ในขอบเขต Scope ปัจจุบัน เพื่อให้ getBounds() ได้ค่าที่ถูกต้องของ Scope นั้นจริงๆ
    const features = allFeatures.filter((f: any) => {
      const props = f.properties
      const { pCode, aCode } = getLocKeys(props, adminLevel)
      return isInScope(pCode, aCode, filters)
    })

    if (features.length === 0) return

    // บันทึกขอบเขตของ active scope เพื่อคำนวณ bounds ที่แท้จริง
    const tempGeo = L.geoJSON(features as any)
    if (tempGeo.getBounds().isValid()) {
      scopeBoundsRef.current = tempGeo.getBounds()
    }

    const stepIdx = periods.findIndex(p => p.key === periodKey)
    const activeDict = (isCumulative && stepIdx !== -1)
      ? buildCumulativeSlice(dictionary, periods, stepIdx)
      : dictionary
    const activeKey = (isCumulative && stepIdx !== -1)
      ? '__cumulative__'
      : periodKey

    if (geoMode === 'coordinate') {
      // 1. เรนเดอร์เป็นจุดพิกัดจริง
      if (showBoundaries) {
        const baseLayer = L.geoJSON(features as any, {
          style: (feature: any) => {
            const props = feature.properties
            const { pCode, aCode } = getLocKeys(props, adminLevel)
            const inScope = isInScope(pCode, aCode, filters)
            return getChoroplethStyle(baseMapStyle, inScope, 0, '#f8fafc')
          }
        }).addTo(map)
        dataLayersRef.current[idx] = baseLayer
      }
      renderPointLayerForMap(idx, map, periodKey)
    } else if (!showBoundaries) {
      // 2. ถ้าปิดสวิตช์ "ระบายสีพื้นหลังแผนที่" (showBoundaries === false) จะข้ามการวาด Choropleth / Bubble เพื่อให้เหมือนแผนที่หลัก
    } else if (displayMode === 'bubble') {
      // 3. เรนเดอร์เป็นวงกลมสถิติเชิงพื้นที่ (Bubbles)
      renderBubbleLayerForMap(idx, map, activeDict, activeKey, features, filters)
    } else {
      // 4. เรนเดอร์เป็นสีกราฟิกขอบเขตพื้นที่ปกครอง
      const geoJsonLayer = L.geoJSON(features as any, {
        style: (feature: any) => {
          const props = feature.properties
          const { p, a, t, pCode, aCode, tCode } = getLocKeys(props, adminLevel)
          const val = getDictValue(activeDict, activeKey, p, a, t, adminLevel, pCode, aCode, tCode)
          const inScope = isInScope(pCode, aCode, filters)

          const directColor = colorMode === 'custom'
            ? getDictColor(activeDict, activeKey, p, a, t, adminLevel, pCode, aCode, tCode)
            : null

          const valColor = globalBreaks.length > 0
            ? getColor(val, globalBreaks, palette, customColors)
            : '#f8fafc'

          return getChoroplethStyle(baseMapStyle, inScope, val, valColor, directColor)
        },
        onEachFeature: (feature: any, layer: any) => {
          const props = feature.properties
          const { p, a, t, pCode, aCode, tCode } = getLocKeys(props, adminLevel)
          const val = getDictValue(activeDict, activeKey, p, a, t, adminLevel, pCode, aCode, tCode)
          const inScope = isInScope(pCode, aCode, filters)

          const directColor = colorMode === 'custom'
            ? getDictColor(activeDict, activeKey, p, a, t, adminLevel, pCode, aCode, tCode)
            : null

          const hasData = (val > 0) || !!directColor
          if (inScope && hasData) {
            const cp = p.replace(/^(จังหวัด|จ\.)/, '').trim()
            const ca = a.replace(/^(อำเภอ|อ\.)/, '').trim()
            const ct = t.replace(/^(ตำบล|ต\.)/, '').trim()
            let title = `จ.${cp}`
            if (adminLevel === 'district') title = `อ.${ca}, ${title}`
            if (adminLevel === 'subdistrict') title = `ต.${ct}, อ.${ca}, ${title}`

            layer.bindTooltip(`
              <div class="flex flex-col gap-0.5 font-sans">
                <div class="font-bold text-spatio-text border-b border-spatio-border pb-0.5 mb-0.5 text-[10px]">${title}</div>
                <div class="flex items-center justify-between gap-3 text-[9px]">
                  <span class="text-spatio-muted">${language === 'th' ? 'จำนวน:' : 'Count:'}</span>
                  <span class="font-mono font-bold text-spatio-text">${val.toLocaleString()} ${language === 'th' ? 'ราย' : 'cases'}</span>
                </div>
              </div>
            `, { sticky: true, className: 'spatio-tooltip bg-spatio-surface/90 border border-spatio-border rounded-lg p-1.5', opacity: 1 })
          }
        }
      }).addTo(map)

      dataLayersRef.current[idx] = geoJsonLayer
    }

    renderBordersForMap(idx, map, filters)
  }

  const renderBordersForMap = (idx: number, map: L.Map, filters: ReturnType<typeof getScopeFilters>) => {
    if (provBordersRef.current[idx]) map.removeLayer(provBordersRef.current[idx])
    if (distBordersRef.current[idx]) map.removeLayer(distBordersRef.current[idx])
    if (subBordersRef.current[idx]) map.removeLayer(subBordersRef.current[idx])

    if (!showBorders) return

    const provColor = '#0f172a' // จังหวัด: ดำเข้มชัดเจน
    const distColor = '#334155' // อำเภอ: Slate-700 เทาเข้มจัด
    const subColor = '#64748b'  // ตำบล: Slate-500 เทากลางเข้ม

    // 1. เส้นขอบจังหวัด (หนา: 2.5)
    const provFeatures = registry.getFeatures('province').filter((f: any) => {
      const { pCode } = getLocKeys(f.properties, 'province')
      return !filters.scopePCodes || filters.scopePCodes.has(pCode)
    })
    provBordersRef.current[idx] = L.geoJSON({ type: 'FeatureCollection', features: provFeatures } as any, {
      style: { fill: false, color: provColor, weight: 2.5, opacity: 1.0, interactive: false }
    }).addTo(map)

    // 2. เส้นขอบอำเภอ (หนา: 1.2)
    if (adminLevel === 'district' || adminLevel === 'subdistrict') {
      const distFeatures = registry.getFeatures('district').filter((f: any) => {
        const { pCode, aCode } = getLocKeys(f.properties, 'district')
        return isInScope(pCode, aCode, filters)
      })
      distBordersRef.current[idx] = L.geoJSON({ type: 'FeatureCollection', features: distFeatures } as any, {
        style: { fill: false, color: distColor, weight: 1.2, opacity: 0.85, interactive: false }
      }).addTo(map)
    }

    // 3. เส้นขอบตำบล (หนา: 0.5)
    if (adminLevel === 'subdistrict') {
      const subFeatures = registry.getFeatures('subdistrict').filter((f: any) => {
        const { pCode, aCode } = getLocKeys(f.properties, 'subdistrict')
        return isInScope(pCode, aCode, filters)
      })
      subBordersRef.current[idx] = L.geoJSON({ type: 'FeatureCollection', features: subFeatures } as any, {
        style: { fill: false, color: subColor, weight: 0.5, opacity: 0.6, interactive: false }
      }).addTo(map)
    }

    try {
      if (subBordersRef.current[idx]) subBordersRef.current[idx].bringToFront()
      if (distBordersRef.current[idx]) distBordersRef.current[idx].bringToFront()
      if (provBordersRef.current[idx]) provBordersRef.current[idx].bringToFront()
    } catch (e) {
      console.warn('[MapCompare] bringToFront error:', e)
    }
  }

  function destroyMaps() {
    Object.entries(compareMapsRef.current).forEach(([idxStr, m]) => {
      const idx = Number(idxStr)
      if (m) {
        try {
          if (provBordersRef.current[idx]) m.removeLayer(provBordersRef.current[idx])
          if (distBordersRef.current[idx]) m.removeLayer(distBordersRef.current[idx])
          if (subBordersRef.current[idx]) m.removeLayer(subBordersRef.current[idx])
          if (pointLayersRef.current[idx]) m.removeLayer(pointLayersRef.current[idx])
          m.off()
          m.remove()
        } catch (e) {
          console.error('[MapCompare] destroy error:', e)
        }
      }
      delete compareMapsRef.current[idx]
    })
    dataLayersRef.current = {}
    pointLayersRef.current = {}
    tileLayersRef.current = {}
    provBordersRef.current = {}
    distBordersRef.current = {}
    subBordersRef.current = {}
  }

  // ตัวแปลงเลเบลช่วงเวลาสำหรับกล่องดรอปดาวน์เลือกในหน้าจอย่อย
  const periodOptions = useMemo(() => {
    const sIdx = timelineStartKey ? periods.findIndex(p => p.key === timelineStartKey) : 0
    const eIdx = timelineEndKey ? periods.findIndex(p => p.key === timelineEndKey) : periods.length - 1
    const startRange = sIdx === -1 ? 0 : sIdx
    const endRange = eIdx === -1 ? periods.length - 1 : eIdx

    return periods.map((p, idx) => ({
      value: p.key,
      label: p.label,
      disabled: idx < startRange || idx > endRange
    }))
  }, [periods, timelineStartKey, timelineEndKey])

  if (!isOpen) return null

  // 3. แนบตำนานสีสะสมแบบกระชับ (Compact Legend Panel)
  const renderLegend = () => {
    if (!showBoundaries) return null
    if (globalBreaks.length === 0 || colorMode === 'custom') return null
    if (geoMode !== 'admin' || displayMode !== 'choropleth') return null
    const colors = (palette === 'Custom' && customColors && customColors.length > 0)
      ? customColors
      : (COLOR_PALETTES[palette] ?? COLOR_PALETTES.YlOrRd)
    const bands: { color: string; label: string }[] = globalBreaks.map((b, i) => {
      const startVal = i === 0 ? breaksStart : getNextStartValue(globalBreaks[i - 1])
      return {
        color: colors[i] ?? colors[colors.length - 1],
        label: `${startVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 10 })}–${b.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 10 })}`
      }
    })
    bands.push({
      color: colors[globalBreaks.length] ?? colors[colors.length - 1],
      label: `>${globalBreaks[globalBreaks.length - 1].toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 10 })}`
    })

    return (
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 p-2 bg-spatio-surface border border-spatio-border rounded-xl max-w-lg select-none">
        <span className="text-[9px] font-bold text-spatio-muted uppercase tracking-widest self-center pr-1 border-r border-spatio-border mr-1.5">{t('info_legend')}:</span>
        {bands.map((b, idx) => (
          <div key={idx} className="flex items-center gap-1">
            <div className="w-3.5 h-2.5 rounded-sm shadow-inner" style={{ background: b.color }} />
            <span className="text-[9px] text-spatio-text font-medium">{b.label}</span>
          </div>
        ))}
        {showLegendZeroRow && (
          <div className="flex items-center gap-1 border-l border-spatio-border pl-2">
            <div 
              className="w-3.5 h-2.5 rounded-sm border border-spatio-border" 
              style={{ backgroundColor: showZeroAreas ? '#f8fafc' : 'transparent' }}
            />
            <span className="text-[9px] text-spatio-muted">{t('info_no_data_short')}</span>
          </div>
        )}
      </div>
    )
  }

  // คำนวณรูปแบบ Grid Class
  let gridClass = 'grid-cols-2 grid-rows-1'
  if (count === 4) gridClass = 'grid-cols-2 grid-rows-2'
  else if (count === 8) gridClass = 'grid-cols-4 grid-rows-2'
  else if (count === 12) gridClass = 'grid-cols-4 grid-rows-3'

  return (
    <div className="fixed inset-0 z-[4000] bg-spatio-surface-alt flex flex-col font-sans select-none animate-fade-in">
      {/* Header Toolbar */}
      <header className="flex justify-between items-center px-4 py-3 bg-spatio-surface border-b border-spatio-border shadow-xl shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-md">
            <Grid size={15} className="text-white" />
          </div>
          <div>
            <div className="text-xs font-bold text-spatio-text">
              {language === 'th' ? 'โหมดเปรียบเทียบช่วงเวลาระบาด (Multi-Time Comparison)' : 'Multi-Time Outbreak Comparison Mode'}
            </div>
            <div className="text-[10px] text-spatio-muted mt-0.5">
              {language === 'th' ? 'แสดงผล:' : 'Visualization:'}{' '}
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                {geoMode === 'coordinate'
                  ? (language === 'th' ? `จุดพิกัด (${pointStyle === 'cluster' ? 'กลุ่มหมุด' : pointStyle === 'heatmap' ? 'ความร้อน' : 'ตามสถิติ'})` : `Coordinates (${pointStyle === 'cluster' ? 'Cluster' : pointStyle === 'heatmap' ? 'Heatmap' : 'Proportional'})`)
                  : (language === 'th' ? `พื้นที่ (${adminLevel === 'province' ? 'จังหวัด' : adminLevel === 'district' ? 'อำเภอ' : 'ตำบล'})` : `Area (${adminLevel === 'province' ? 'Province' : adminLevel === 'district' ? 'District' : 'Subdistrict'})`)}
              </span>{' '}
              | {language === 'th' ? 'แผนที่ฐานซิงโครไนซ์แล้ว' : 'Synchronized base maps'}
            </div>
          </div>
        </div>

        {/* Legend rendering */}
        <div className="hidden lg:block">
          {renderLegend()}
        </div>

        <div className="flex items-center gap-2.5">
          {/* Layout buttons */}
          <div className="flex items-center gap-1 p-0.5 bg-spatio-surface border border-spatio-border rounded-lg shadow-inner">
            {([2, 4, 8, 12] as const).map(num => (
              <button
                key={num}
                onClick={() => setCount(num)}
                className={clsx(
                  'px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer',
                  count === num
                    ? 'bg-indigo-600/25 border border-indigo-500/40 text-indigo-650 dark:text-indigo-400 shadow-md'
                    : 'text-spatio-muted hover:text-spatio-text hover:bg-spatio-surface-alt border border-transparent'
                )}
              >
                {language === 'th' ? `${num} จอ` : `${num} Screens`}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-spatio-surface hover:bg-red-500/10 hover:text-red-650 dark:hover:text-red-400 border border-spatio-border hover:border-red-500/30 rounded-xl text-xs font-semibold text-spatio-text transition-all cursor-pointer active:scale-95"
          >
            <X size={14} />
            <span>{language === 'th' ? 'ออกจากการเปรียบเทียบ' : 'Exit Comparison'}</span>
          </button>
        </div>
      </header>

      {/* Grid Container */}
      <main className={clsx('flex-1 grid gap-2 p-2 bg-spatio-surface-alt overflow-hidden', gridClass)}>
        {Array.from({ length: count }).map((_, idx) => {
          const currentVal = selectedPeriods[idx] || ''
          return (
            <div
              key={idx}
              className="relative w-full h-full rounded-xl overflow-hidden border border-spatio-border bg-spatio-surface/40 shadow-inner flex flex-col"
            >
              {/* Select Dropdown Toolbar */}
              <div className="absolute top-2 left-2 z-[1000] p-1 rounded-lg bg-spatio-surface/90 border border-spatio-border backdrop-blur-md flex items-center gap-1 max-w-[200px] shadow-lg">
                <span className="text-[9px] text-spatio-muted px-1 font-bold">
                  {language === 'th' ? `จอที่ ${idx + 1}` : `Screen ${idx + 1}`}
                </span>
                <select
                  value={currentVal}
                  onChange={(e) => {
                    const newKeys = [...selectedPeriods]
                    newKeys[idx] = e.target.value
                    setSelectedPeriods(newKeys)
                  }}
                  className="bg-spatio-surface text-spatio-text text-[10px] font-bold focus:outline-none cursor-pointer pr-1"
                >
                  <option value="" disabled className="bg-white dark:bg-slate-900 text-black dark:text-white">{language === 'th' ? 'เลือกช่วงเวลา' : 'Select period'}</option>
                  {periodOptions.map(opt => (
                    <option key={opt.value} value={opt.value} disabled={opt.disabled} className="bg-white dark:bg-slate-900 text-black dark:text-white disabled:opacity-40">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Leaflet Map Div */}
              <div id={`compare-map-${idx}`} className="w-full h-full relative" />
            </div>
          )
        })}
      </main>
    </div>
  )
}
