import React, { useEffect, useState, useMemo } from 'react'
import { useAppStore, type MapWidgetConfig } from '../store/useAppStore'
import { useTranslation } from '../hooks/useTranslation'
import { getMap } from '../map/mapController'
import { getCentroid, getScopeFilters, isInScope } from '../map/layerUtils'
import { registry, type GeoFeature } from '../data/registry'
import { clsx } from 'clsx'
import { locationResolver } from '../data/locationResolver'
import { buildSelectionSlice, buildCumulativeSlice } from '../data/aggregator'

interface MapCalloutsProps {
  isExportMode?: boolean
}

export const MapCallouts: React.FC<MapCalloutsProps> = ({ isExportMode = false }) => {
  const map = getMap()
  const { language } = useTranslation()
  const {
    mapLabelSource,
    mapLabelColumn,
    mapLabelLimit,
    mapLabelThreshold,
    mapLabelNameLevel,
    labelCallouts,
    globalLabelStyle,
    selectedLabelId,
    setSelectedLabelId,
    updateLabelOffset,
    currentStep,
    periods,
    dictionary,
    adminLevel,
    scope,
    rawRows,
    dataKeys,
    isCumulative,
    selectedPeriods,
    canvasWidgets,
    widgetConfigs,
    showLocationPrefix,
  } = useAppStore()

  const mapWidget = canvasWidgets?.find(w => w.type === 'map')
  const mapConfig = mapWidget ? (widgetConfigs[mapWidget.id] as MapWidgetConfig | undefined) : undefined
  const showCallouts = mapConfig?.showLabelCallouts ?? true


  // Track map moves and zooms to re-project centroid coordinates to screen coordinates
  const [mapVersion, setMapVersion] = useState(0)

  useEffect(() => {
    if (!map) return
    const onMove = () => setMapVersion(v => v + 1)
    map.on('move zoom viewreset resize', onMove)
    return () => {
      map.off('move zoom viewreset resize', onMove)
    }
  }, [map])

  const periodSlice = useMemo(() => {
    if (periods.length === 0 || !dictionary) return {}
    const period = periods[currentStep]
    if (!period) return {}

    if (selectedPeriods.size > 1) {
      return buildSelectionSlice(dictionary, periods, selectedPeriods).__selection__ || {}
    } else if (isCumulative) {
      return buildCumulativeSlice(dictionary, periods, currentStep).__cumulative__ || {}
    }
    return dictionary[period.key] || {}
  }, [dictionary, periods, currentStep, isCumulative, selectedPeriods])

  // ─── Helper: ดึงค่าจาก slice ตาม adminLevel ───
  const lookupValue = (
    slice: Record<string, any>,
    level: string,
    pCode: string,
    aCode: string,
    tCode: string,
  ): number => {
    if (level === 'province') return slice[pCode]?._total ?? 0
    if (level === 'district') return slice[pCode]?.districts?.[aCode]?._total ?? 0
    return slice[pCode]?.districts?.[aCode]?.subdistricts?.[tCode] ?? 0
  }

  // ─── 1) คำนวณค่าสูงสุดของแต่ละพื้นที่ข้ามทุก period (สำหรับ top-N / threshold ที่คงที่) ───
  // ─── 2) Layout คงที่: ตำแหน่ง + ชื่อ + พื้นที่ที่จะแสดง (ไม่ขึ้นกับเฟรมปัจจุบัน) ───
  const stableLayout = useMemo(() => {
    if (!labelCallouts || !map || mapLabelSource === 'none') return []

    const features = registry.getFeatures(adminLevel)
    const filters = getScopeFilters(scope)

    let list: Array<{
      id: string
      name: string
      resolvedValue: number
      featureValue: number
      latLng: [number, number]
      customVal?: string
      nameLevelCode: string
      nameLevelResolved: string
      pCode: string
      aCode: string
      tCode: string
    }> = []

    features.forEach((f: GeoFeature) => {
      const p = f.properties

      const pCode = String(p.P_code ?? '').replace(/\D/g, '').padStart(2, '0')
      const pName = String(p.P_Name_T ?? p.PV_TN ?? '')
      const aName = String(p.A_Name_T ?? p.AM_TN ?? '')
      const tName = String(p.T_Name_T ?? p.TB_TN ?? '')
      let aCode = ''
      let tCode = ''

      if (adminLevel === 'district') {
        aCode = String(p.Admin_code ?? p.A_code_full ?? '').replace(/\D/g, '').padStart(4, '0')
      } else if (adminLevel === 'subdistrict') {
        aCode = String(p.Admin_code ?? p.A_code_full ?? '').replace(/\D/g, '').substring(0, 4).padStart(4, '0')
        tCode = String(p.Admin_code ?? p.T_code ?? '').replace(/\D/g, '').padStart(6, '0')
      }

      if (!isInScope(pCode, aCode, filters, tCode)) return

      // Determine the resolved name level and label code
      let nameLevelResolved = adminLevel
      let labelCode = adminLevel === 'province' ? pCode : adminLevel === 'district' ? aCode : tCode

      if (mapLabelNameLevel === 'province') {
        nameLevelResolved = 'province'
        labelCode = pCode
      } else if (mapLabelNameLevel === 'district') {
        nameLevelResolved = adminLevel === 'subdistrict' ? 'district' : adminLevel
        labelCode = adminLevel === 'subdistrict' ? aCode : labelCode
      }

      // Resolve area name for label
      let dispName = nameLevelResolved === 'province' ? pName : nameLevelResolved === 'district' ? aName : tName
      const resolved = locationResolver.getByCode(labelCode)
      if (resolved) {
        if (language === 'en') {
          dispName = (nameLevelResolved === 'province' ? resolved.pNameEn : nameLevelResolved === 'district' ? resolved.aNameEn : resolved.tNameEn) || dispName
        } else {
          dispName = (nameLevelResolved === 'province' ? resolved.pName : nameLevelResolved === 'district' ? resolved.aName : resolved.tName) || dispName
        }
      }
      if (language !== 'en' && !showLocationPrefix) {
        dispName = stripThaiPrefix(dispName, nameLevelResolved)
      }

      // Resolve Lat/Lng Centroid based on resolved label code level
      let latLng: [number, number] | null = null
      const resolvedFeature = registry.findByCode(labelCode)
      if (resolvedFeature) {
        latLng = getCentroid(resolvedFeature)
      }
      if (!latLng) {
        latLng = getCentroid(f)
      }
      if (!latLng || isNaN(latLng[0]) || isNaN(latLng[1])) return

      // Resolve custom column value if source is custom-column
      let customVal = ''
      if (mapLabelSource === 'custom-column' && mapLabelColumn && rawRows.length > 0) {
        const hasProvKey = !!dataKeys.province
        const hasDistKey = !!dataKeys.district
        const hasSubKey = !!dataKeys.subdistrict
        
        const matchedRow = rawRows.find(row => {
          if (hasProvKey && String(row[dataKeys.province]).includes(pName)) {
            if (adminLevel === 'province') return true
            if (hasDistKey && String(row[dataKeys.district]).includes(aName)) {
              if (adminLevel === 'district') return true
              if (hasSubKey && String(row[dataKeys.subdistrict]).includes(tName)) return true
            }
          }
          return false
        })
        if (matchedRow) {
          customVal = String(matchedRow[mapLabelColumn] || '')
        }
      }

      // Calculate featureValue & resolvedValue for the current active frame (periodSlice)
      let featureValue = 0
      let resolvedValue = 0
      if (periodSlice) {
        featureValue = lookupValue(periodSlice, adminLevel, pCode, aCode, tCode)
        resolvedValue = lookupValue(periodSlice, nameLevelResolved, pCode, aCode, tCode)
      }

      const id = adminLevel === 'province' ? pCode : adminLevel === 'district' ? aCode : tCode
      list.push({
        id,
        name: dispName,
        resolvedValue,
        featureValue,
        latLng,
        customVal,
        nameLevelCode: labelCode,
        nameLevelResolved,
        pCode,
        aCode,
        tCode,
      })
    })

    // Deduplicate by nameLevelCode (keep the representative with the highest native featureValue for centroid placement)
    if (mapLabelNameLevel && mapLabelNameLevel !== 'default') {
      const grouped: Record<string, typeof list[number]> = {}
      list.forEach(item => {
        const key = item.nameLevelCode
        if (!grouped[key] || item.featureValue > grouped[key].featureValue) {
          grouped[key] = item
        }
      })
      list = Object.values(grouped)
    }

    // Apply Density Limit Filters ─ sorting and filtering by the resolved level value in the current period
    if (mapLabelLimit === 'top-5') {
      list.sort((a, b) => b.resolvedValue - a.resolvedValue)
      list = list.slice(0, 5)
    } else if (mapLabelLimit === 'top-10') {
      list.sort((a, b) => b.resolvedValue - a.resolvedValue)
      list = list.slice(0, 10)
    } else if (mapLabelLimit === 'top-20') {
      list.sort((a, b) => b.resolvedValue - a.resolvedValue)
      list = list.slice(0, 20)
    } else if (mapLabelLimit === 'threshold') {
      list = list.filter(item => item.resolvedValue >= mapLabelThreshold)
    }

    return list
  }, [mapLabelSource, mapLabelColumn, mapLabelLimit, mapLabelThreshold, mapLabelNameLevel, adminLevel, scope, map, rawRows, dataKeys, mapVersion, dictionary, periods, language, labelCallouts, showLocationPrefix, periodSlice])

  // ─── 3) ข้อมูล label สุดท้าย ───
  const labelData = useMemo(() => {
    if (!stableLayout.length) return []

    return stableLayout.map(item => ({
      ...item,
      value: item.resolvedValue,
    }))
  }, [stableLayout])

  // Drag interaction handler
  const handleDragStart = (e: React.MouseEvent, id: string, initialDx: number, initialDy: number) => {
    e.preventDefault()
    e.stopPropagation()
    
    setSelectedLabelId(id)

    const startX = e.clientX
    const startY = e.clientY

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = initialDx + (moveEvent.clientX - startX)
      const dy = initialDy + (moveEvent.clientY - startY)
      updateLabelOffset(id, dx, dy)
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  if (!labelCallouts || mapLabelSource === 'none' || !map || labelData.length === 0) return null

  return (
    <div className="absolute inset-0 pointer-events-none z-[1200] w-full h-full select-none">
      {/* SVG Callout lines overlay */}
      {showCallouts && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <marker
              id="callout-arrow"
              markerWidth="6"
              markerHeight="5"
              refX="5"
              refY="2.5"
              orient="auto"
            >
              <polygon points="0 0, 6 2.5, 0 5" fill="#f43f5e" />
            </marker>
          </defs>

          {labelData.map(item => {
            const callout = labelCallouts[item.id]
            const dx = callout?.dx ?? 0
            const dy = callout?.dy ?? 0
            if (dx === 0 && dy === 0) return null

            const screenCentroid = map.latLngToContainerPoint(item.latLng)
            
            // Get specific callout style or global fallback
            const style = { ...globalLabelStyle, ...(callout?.style ?? {}) }
            const strokeColor = style.lineColor || '#f1f5f9'
            const strokeWidth = style.lineWidth || 1.5
            const dashArray = style.lineStyle === 'dashed' ? '4 3' : style.lineStyle === 'dotted' ? '1.5 2' : 'none'

            // Line from target (centroid) to label card center (point + dx, dy)
            return (
              <g key={`line-${item.id}`}>
                {/* Leader Line */}
                <line
                  x1={screenCentroid.x}
                  y1={screenCentroid.y}
                  x2={screenCentroid.x + dx}
                  y2={screenCentroid.y + dy}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashArray}
                  className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                />
                
                {/* Target pointer marker */}
                {style.markerType === 'dot' && (
                  <circle
                    cx={screenCentroid.x}
                    cy={screenCentroid.y}
                    r="3.5"
                    fill={strokeColor}
                    stroke="#000000"
                    strokeWidth="1"
                    className="drop-shadow-md"
                  />
                )}
                {style.markerType === 'arrow' && (
                  <line
                    x1={screenCentroid.x + dx * 0.1}
                    y1={screenCentroid.y + dy * 0.1}
                    x2={screenCentroid.x}
                    y2={screenCentroid.y}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    markerEnd="url(#callout-arrow)"
                  />
                )}
              </g>
            )
          })}
        </svg>
      )}

      {/* HTML Label badges */}
      {labelData.map(item => {
        const callout = labelCallouts[item.id]
        const dx = callout?.dx ?? 0
        const dy = callout?.dy ?? 0
        
        const screenCentroid = map.latLngToContainerPoint(item.latLng)
        const style = { ...globalLabelStyle, ...(callout?.style ?? {}) }

        // Compile display text
        let displayHtml = ''
        if (mapLabelSource === 'name') {
          displayHtml = item.name
        } else if (mapLabelSource === 'value') {
          displayHtml = item.value.toLocaleString()
        } else if (mapLabelSource === 'name-value') {
          displayHtml = `${item.name} (${item.value.toLocaleString()})`
        } else if (mapLabelSource === 'custom-column') {
          displayHtml = item.customVal || item.name
        }

        const isSelected = selectedLabelId === item.id

        return (
          <div
            key={`label-${item.id}`}
            style={{
              position: 'absolute',
              left: `${screenCentroid.x + dx}px`,
              top: `${screenCentroid.y + dy}px`,
              transform: 'translate(-50%, -50%)',
              fontSize: `${style.fontSize || 10}px`,
              color: style.color || '#ffffff',
              backgroundColor: isExportMode ? 'transparent' : (style.bgOpacity ? `rgba(${hexToRgb(style.bgColor || '#0f172a')}, ${style.bgOpacity})` : style.bgColor || '#0f172a'),
              borderColor: isExportMode ? 'transparent' : (style.borderColor || '#475569'),
              borderWidth: isExportMode ? 0 : `${style.borderWidth ?? 1}px`,
              borderStyle: isExportMode ? 'none' : (style.borderStyle || 'solid'),
              borderRadius: `${style.borderRadius ?? 4}px`,
              textShadow: isExportMode
                ? createTextOutline(style.textStrokeWidth ?? 1.5, style.textStrokeColor || '#000000')
                : '0 0 2px #000',
              boxShadow: isExportMode ? 'none' : (isSelected ? '0 0 0 2px #4f46e5, 0 10px 15px -3px rgba(0,0,0,0.5)' : '0 4px 6px -1px rgba(0,0,0,0.3)'),
              fontFamily: "'Inter', 'Noto Sans Thai', 'Leelawadee UI', Tahoma, sans-serif",
            }}
            className={clsx(
              "px-2 py-0.5 pointer-events-auto cursor-move transition-shadow z-[20] flex items-center gap-1",
              isSelected && "ring-2 ring-indigo-500/80"
            )}
            onMouseDown={(e) => handleDragStart(e, item.id, dx, dy)}
            onClick={(e) => {
              e.stopPropagation()
              setSelectedLabelId(item.id)
            }}
          >
            <span className={clsx("inline-block font-bold select-none whitespace-nowrap leading-tight pr-0.5", !isExportMode && "tracking-wide text-shadow-md")}>
              {displayHtml}
            </span>

            {/* Reset position button if dragged */}
            {(dx !== 0 || dy !== 0) && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  useAppStore.getState().resetLabelOffset(item.id)
                  if (isSelected) setSelectedLabelId(null)
                }}
                className="no-export w-3.5 h-3.5 rounded bg-spatio-surface-alt hover:bg-spatio-border text-[8px] flex items-center justify-center shrink-0 border border-spatio-border font-mono transition-colors text-spatio-muted cursor-pointer"
                title={language === 'th' ? 'กลับตำแหน่งเดิม' : 'Reset Position'}
              >
                ↺
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function hexToRgb(hex: string): string {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '15, 23, 42'
  return `${r}, ${g}, ${b}`
}

function createTextOutline(width: number, color: string): string {
  if (width <= 0) return 'none'
  const shadows = []
  const step = width <= 1 ? 0.5 : 1
  for (let x = -width; x <= width; x += step) {
    for (let y = -width; y <= width; y += step) {
      if (x === 0 && y === 0) continue
      if (x * x + y * y <= width * width) {
        shadows.push(`${x}px ${y}px 0 ${color}`)
      }
    }
  }
  shadows.push(`0px 0px 2px rgba(0,0,0,0.8)`)
  return shadows.join(', ')
}

function stripThaiPrefix(name: string, level: 'province' | 'district' | 'subdistrict'): string {
  if (!name) return ''
  if (level === 'province') {
    return name.replace(/^จังหวัด/, '')
  } else if (level === 'district') {
    return name.replace(/^(อำเภอ|เขต)/, '')
  } else if (level === 'subdistrict') {
    return name.replace(/^(ตำบล|แขวง)/, '')
  }
  return name
}
