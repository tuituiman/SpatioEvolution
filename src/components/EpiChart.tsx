import React, { useState, useMemo, useRef, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { useAppStore } from '../store/useAppStore'
import type { ChartWidgetConfig } from '../store/useAppStore'
import { ZoomIn, ZoomOut, Maximize2, Trash2 } from 'lucide-react'
import { getScopeFilters } from '../map/layerUtils'
import { isPointInScope } from '../data/healthZones'
import { parseDate, toDateKey } from '../data/dateParser'
import { useTranslation } from '../hooks/useTranslation'
import { clsx } from 'clsx'

const MONTHS_FULL_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const MONTHS_SHORT_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ด.ค.']
const MONTHS_FULL_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_SHORT_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const EpiChart: React.FC<{ isExportPreview?: boolean; config?: ChartWidgetConfig }> = ({ isExportPreview = false, config }) => {
  const { t, language } = useTranslation()
  const padding = isExportPreview ? 25 : 40
  // Resolved config values (with defaults)
  const barColor = config?.barColor ?? '#4f46e5'
  const barActiveColor = config?.barActiveColor ?? '#a855f7'
  const peakColor = config?.peakColor ?? '#fbbf24'
  const showGrid = config?.showGrid ?? true
  const showMaxMarker = config?.showMaxMarker ?? true
  const showNowMarker = config?.showNowMarker ?? true

  const defaultYAxisLabel = language === 'th' ? 'จำนวนราย' : 'Cases'
  const yAxisLabel = config?.yAxisLabel ?? defaultYAxisLabel
  const xAxisLabel = config?.xAxisLabel ?? ''
  const chartType = config?.chartType ?? 'bar'
  const axisFontSize = config?.fontSize ?? 9

  const {
    periods,
    dictionary,
    groupingMode,
    selectedPeriods,
    togglePeriodSelection,
    clearPeriodSelection,
    setSelectedPeriods,
    scope,
    geoMode,
    rawRows,
    dataKeys,
    currentStep,
    adminLevel,
    canvasSettings,
    isCumulative,
    timelineStartKey,
    timelineEndKey,
    cropChartToRange,
    setCropChartToRange
  } = useAppStore()

  const startIdx = useMemo(() => {
    const idx = timelineStartKey ? periods.findIndex(p => p.key === timelineStartKey) : 0
    return idx === -1 ? 0 : idx
  }, [periods, timelineStartKey])

  const endIdx = useMemo(() => {
    const idx = timelineEndKey ? periods.findIndex(p => p.key === timelineEndKey) : periods.length - 1
    return idx === -1 ? periods.length - 1 : idx
  }, [periods, timelineEndKey])

  const isDark = canvasSettings.theme === 'dark'
  const textColor = config?.textColor ?? (isDark ? '#cbd5e1' : '#334155')
  const mutedColor = isDark ? '#94a3b8' : '#64748b'
  const gridColor = config?.gridColor ?? (isDark ? '#334155' : '#e2e8f0')

  const hexToRgba = (hex: string, alpha: number) => {
    if (!hex || hex === 'transparent') return 'transparent'
    hex = hex.replace('#', '')
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  const [zoom, setZoom] = useState<number>(1.0)
  const [containerWidth, setContainerWidth] = useState<number>(600)
  const [containerHeight, setContainerHeight] = useState<number>(260)
  const [tooltip, setTooltip] = useState<{ label: string; val: number; x: number; y: number } | null>(null)

  // Drag Selection States
  const [dragStart, setDragStart] = useState<number | null>(null)
  const [dragCurrent, setDragCurrent] = useState<number | null>(null)
  const justDragged = useRef(false)

  const scrollWrapperRef = useRef<HTMLDivElement>(null)

  // Ref to track current zoom value inside wheel listener
  const zoomRef = useRef(zoom)
  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  // Track scrollable container width dynamically
  useEffect(() => {
    const el = scrollWrapperRef.current
    if (!el) return

    // Set initial width
    setContainerWidth(el.clientWidth)
    setContainerHeight(el.clientHeight)

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
        setContainerHeight(entry.contentRect.height)
      }
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
    }
  }, [])

  // 1. Zoom Anchor calculation in Wheel Event (Fully Synchronous using flushSync)
  useEffect(() => {
    const el = scrollWrapperRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      // If Ctrl key is pressed (matches trackpad pinch-to-zoom or Ctrl+Wheel)
      if (e.ctrlKey) {
        e.preventDefault()

        const canvasEl = el.firstElementChild as HTMLElement
        if (!canvasEl) return

        const canvasRect = canvasEl.getBoundingClientRect()

        // Exact horizontal position of the mouse relative to the start of the scrollable content canvas
        const mouseXInContent = e.clientX - canvasRect.left

        const oldZoom = zoomRef.current
        const scaleFactor = e.deltaY < 0 ? 0.08 : -0.08
        const newZoom = Math.max(0.5, Math.min(10.0, oldZoom + scaleFactor))

        // Force synchronous DOM render so that clientWidth and scrollable area update immediately
        flushSync(() => {
          setZoom(newZoom)
        })

        // Calculate the expanded target coordinate of the point under the mouse
        const paddingLeft = 50
        const oldChartX = mouseXInContent - paddingLeft
        const newChartX = oldChartX * (newZoom / oldZoom)
        const newContentX = newChartX + paddingLeft

        // Adjust scroll position synchronously to freeze the point under the mouse
        const scrollDiff = newContentX - mouseXInContent
        el.scrollLeft += scrollDiff
      }
    }

    // Must be passive: false to allow e.preventDefault() to block browser-level page zoom
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  // 1.5 Pre-compute scope membership per row (once per scope/dataset/lat/lng change)
  const rowInScope = useMemo(() => {
    if (geoMode !== 'coordinate' || rawRows.length === 0 || !dataKeys.lat || !dataKeys.lng) {
      return []
    }
    return rawRows.map((row) => {
      const lat = parseFloat(String(row[dataKeys.lat] || '').trim())
      const lng = parseFloat(String(row[dataKeys.lng] || '').trim())
      if (isNaN(lat) || isNaN(lng)) return false
      return isPointInScope(lat, lng, scope)
    })
  }, [rawRows, scope, dataKeys.lat, dataKeys.lng, geoMode])

  // 2. Prepare data
  const chartData = useMemo(() => {
    const labels: string[] = []
    const values: number[] = []
    const keys: string[] = []

    if (geoMode === 'coordinate' && rawRows.length > 0 && dataKeys.lat && dataKeys.lng) {
      // ── โหมดพิกัดคู่ขนาน: นับจำนวนพิกัดใน Scope จริง (Bounding Box) แยกรายช่วงเวลา ──
      const hasDateCol = !!dataKeys.date
      const hasValCol = !!dataKeys.value

      const periodCounts = new Map<string, number>()
      periods.forEach(p => {
        labels.push(p.label)
        keys.push(p.key)
        periodCounts.set(p.key, 0)
      })

      rawRows.forEach((row: any, idx: number) => {
        const lat = parseFloat(String(row[dataKeys.lat] || '').trim())
        const lng = parseFloat(String(row[dataKeys.lng] || '').trim())
        if (isNaN(lat) || isNaN(lng)) return

        // 1. กรองตามขอบเขตพื้นที่จริง (Scope Bounding Box Check)
        if (!rowInScope[idx]) return

        // 2. แกะวันหาช่วงเวลา
        let periodKey = '__static__'
        if (hasDateCol) {
          const parsedDate = parseDate(row[dataKeys.date])
          if (!parsedDate || isNaN(parsedDate.getTime())) return
          periodKey = toDateKey(parsedDate, groupingMode)
        }

        const val = hasValCol ? parseFloat(String(row[dataKeys.value] || '').replace(/,/g, '').trim()) : 1
        const weight = isNaN(val) ? 1 : val

        periodCounts.set(periodKey, (periodCounts.get(periodKey) || 0) + weight)
      })

      periods.forEach(p => {
        values.push(periodCounts.get(p.key) || 0)
      })
    } else {
      // ── โหมดพื้นที่ปกติ: ใช้ Dictionary-based Approach ──
      const { scopePCodes, scopeACode } = getScopeFilters(scope)

      periods.forEach(p => {
        labels.push(p.label)
        const slice = dictionary[p.key] ?? {}
        let periodTotal = 0

        // Helper: sum a single province according to the current adminLevel
        const sumProvince = (provData: any): number => {
          if (adminLevel === 'province') {
            return provData._total || 0
          } else if (adminLevel === 'district') {
            // Sum all district _totals within this province
            return Object.values(provData.districts ?? {}).reduce<number>(
              (s, d: any) => s + (d._total || 0), 0
            )
          } else {
            // subdistrict: sum all leaf subdistrict values
            return Object.values(provData.districts ?? {}).reduce<number>(
              (s, d: any) =>
                s + Object.values(d.subdistricts ?? {}).reduce<number>(
                  (ss, v: any) => ss + (typeof v === 'number' ? v : 0), 0
                ),
              0
            )
          }
        }

        if (!scopePCodes) {
          // ทั้งประเทศ
          for (const provData of Object.values(slice) as any[]) {
            periodTotal += sumProvince(provData)
          }
        } else {
          // กรองตามจังหวัด/เขตสุขภาพ
          for (const pCode of scopePCodes) {
            const provData = slice[pCode]
            if (!provData) continue

            if (!scopeACode) {
              // ทั้งจังหวัด/เขตสุขภาพ
              periodTotal += sumProvince(provData)
            } else {
              // เจาะจงอำเภอ (scope ระดับอำเภอ)
              const distData = provData.districts?.[scopeACode]
              if (distData) {
                if (adminLevel === 'subdistrict') {
                  periodTotal += Object.values(distData.subdistricts ?? {}).reduce(
                    (s: number, v: any) => s + (typeof v === 'number' ? v : 0), 0
                  )
                } else {
                  periodTotal += distData._total || 0
                }
              }
            }
          }
        }

        values.push(periodTotal)
        keys.push(p.key)
      })
    }

    const finalValues = isCumulative
      ? values.reduce<number[]>((acc, val, idx) => {
          const prev = idx > 0 ? acc[idx - 1] : 0
          acc.push(prev + val)
          return acc
        }, [])
      : values

    const startIdx = timelineStartKey ? periods.findIndex(p => p.key === timelineStartKey) : 0
    const endIdx = timelineEndKey ? periods.findIndex(p => p.key === timelineEndKey) : periods.length - 1
    const validStartIdx = startIdx === -1 ? 0 : startIdx
    const validEndIdx = endIdx === -1 ? periods.length - 1 : endIdx

    let labelsToUse = labels
    let valuesToUse = finalValues
    let keysToUse = keys

    if (cropChartToRange && (timelineStartKey || timelineEndKey)) {
      labelsToUse = labels.slice(validStartIdx, validEndIdx + 1)
      valuesToUse = finalValues.slice(validStartIdx, validEndIdx + 1)
      keysToUse = keys.slice(validStartIdx, validEndIdx + 1)
    }

    const maxVal = Math.max(1, ...valuesToUse)
    return { labels: labelsToUse, values: valuesToUse, keys: keysToUse, maxVal }
  }, [periods, dictionary, scope, geoMode, rawRows, dataKeys, groupingMode, rowInScope, adminLevel, isCumulative, cropChartToRange, timelineStartKey, timelineEndKey])

  if (periods.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-spatio-muted text-sm">
        {language === 'th' ? 'ไม่มีข้อมูลกราฟ' : 'No chart data'}
      </div>
    )
  }

  // Width and height settings
  const activeZoom = isExportPreview ? 1.0 : zoom

  // Use configured padding from widget settings, with defaults if undefined
  const paddingLeftConfig = config?.paddingLeft ?? 60
  const paddingBottomConfig = config?.paddingBottom ?? 80
  const paddingTopConfig = config?.paddingTop ?? 35

  const paddingLeft = isExportPreview ? Math.max(40, paddingLeftConfig - 10) : paddingLeftConfig
  const paddingBottom = isExportPreview ? Math.max(50, paddingBottomConfig - 15) : paddingBottomConfig
  const paddingTop = isExportPreview ? Math.max(25, paddingTopConfig - 10) : paddingTopConfig
  const paddingRight = isExportPreview ? 20 : 30

  const chartW = Math.max(containerWidth, 100) * activeZoom - paddingLeft - paddingRight
  const height = Math.max(containerHeight, 100)
  const chartH = height - paddingTop - paddingBottom
  const width = chartW + paddingLeft + paddingRight

  const barWidth = (chartW / Math.max(chartData.labels.length, 1)) * 0.8
  const barGap = (chartW / Math.max(chartData.labels.length, 1)) * 0.2
  const barSpace = barWidth + barGap

  // Adaptive labels
  const labelStep = Math.max(1, Math.ceil(80 / barSpace))

  const handleZoom = (delta: number) => {
    if (delta === 0) {
      setZoom(1.0)
    } else {
      const el = scrollWrapperRef.current
      if (el) {
        const canvasEl = el.firstElementChild as HTMLElement
        if (canvasEl) {
          const canvasRect = canvasEl.getBoundingClientRect()
          const containerRect = el.getBoundingClientRect()

          // Center of the visible scroll container relative to screen
          const centerScreenX = containerRect.left + el.clientWidth / 2
          const mouseXInContent = centerScreenX - canvasRect.left

          const oldZoom = zoom
          const newZoom = Math.max(0.5, Math.min(10.0, oldZoom + delta))

          flushSync(() => {
            setZoom(newZoom)
          })

          const paddingLeft = 50
          const oldChartX = mouseXInContent - paddingLeft
          const newChartX = oldChartX * (newZoom / oldZoom)
          const newContentX = newChartX + paddingLeft

          const scrollDiff = newContentX - mouseXInContent
          el.scrollLeft += scrollDiff
          return
        }
      }
      setZoom(z => Math.max(0.5, Math.min(10.0, z + delta)))
    }
  }

  const formatLabel = (l: string) => {
    const monthsFull = language === 'th' ? MONTHS_FULL_TH : MONTHS_FULL_EN
    const monthsShort = language === 'th' ? MONTHS_SHORT_TH : MONTHS_SHORT_EN

    if (groupingMode === 'daily') {
      const parts = l.split(' ')
      const mIdx = monthsFull.indexOf(parts[1])
      const mShort = mIdx !== -1 ? monthsShort[mIdx] : parts[1]
      return parts[0] + ' ' + mShort + (parts[2] ? ' ' + parts[2].substring(2) : '')
    } else if (groupingMode === 'weekly' || groupingMode === 'weekly_epi') {
      return l.split(' ')[0]
    } else if (groupingMode === 'monthly') {
      const parts = l.split(' ')
      const mIdx = monthsFull.indexOf(parts[0])
      const mShort = mIdx !== -1 ? monthsShort[mIdx] : parts[0]
      return mShort + ' ' + (parts[1] ? parts[1].substring(2) : '')
    } else if (groupingMode === 'yearly') {
      return l.replace('ปี พ.ศ. ', '')
    }
    return l
  }

  const hasSelection = selectedPeriods.size > 0

  // ── Drag selection handlers ──
  const getMouseX = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return e.clientX - rect.left
  }

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return // Left click only
    const x = getMouseX(e)
    setDragStart(x)
    setDragCurrent(x)
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (dragStart === null) return
    const x = getMouseX(e)
    setDragCurrent(x)
  }

  const handleMouseUp = () => {
    if (dragStart === null || dragCurrent === null) return

    const minX = Math.min(dragStart, dragCurrent)
    const maxX = Math.max(dragStart, dragCurrent)
    const distance = maxX - minX

    // If dragged at least 5 pixels, run brushing selection
    if (distance >= 5) {
      justDragged.current = true
      const newSelected = new Set<string>(selectedPeriods)
      let addedAny = false

      chartData.keys.forEach((key, idx) => {
        const paddingLeft = 45
        const x_bar = paddingLeft + idx * barSpace
        const x_bar_end = x_bar + barWidth
        // Check if the bar overlaps with the horizontal drag interval [minX, maxX]
        if (x_bar_end >= minX && x_bar <= maxX) {
          newSelected.add(key)
          addedAny = true
        }
      })

      if (addedAny && newSelected.size > 0) {
        setSelectedPeriods(newSelected)
      }
    }

    setDragStart(null)
    setDragCurrent(null)
  }

  const handleMouseLeave = () => {
    setDragStart(null)
    setDragCurrent(null)
  }

  // Handle click on the SVG background (deselect)
  const handleSvgClick = () => {
    // If we just finished a drag selection, don't trigger the click deselect
    if (justDragged.current) {
      justDragged.current = false
      return
    }
    // Only deselect if there is an active selection
    if (hasSelection) {
      clearPeriodSelection()
    }
  }

  return (
    <div className="flex flex-col h-full relative font-sans">
      {/* Chart Controls */}
      {!isExportPreview && (
        <div className="flex items-center justify-between px-1 mb-2">
          <div className="text-xs font-semibold text-spatio-muted select-none">
            {language === 'th' ? 'กราฟระบาดวิทยา' : 'Epidemic Curve'}{' '}
            {hasSelection && (
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                {language === 'th' ? `(${selectedPeriods.size} ช่วงเวลาที่เลือก)` : `(${selectedPeriods.size} periods selected)`}
              </span>
            )}
            <span className="text-[10px] text-spatio-muted/60 font-normal ml-2">
              {language === 'th'
                ? '(ลากเพื่อสะสมพื้นที่ | คลิกพื้นที่ว่างเพื่อล้าง | Pinch หรือ Ctrl + Scroll เพื่อซูม)'
                : '(Drag to select range | Click empty space to clear | Pinch or Ctrl + Scroll to zoom)'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-spatio-surface p-1 rounded-lg border border-spatio-border z-10 font-sans">
            {(timelineStartKey || timelineEndKey) && (
              <button
                onClick={() => setCropChartToRange(!cropChartToRange)}
                className={clsx(
                  "px-2 py-0.5 rounded text-[9.5px] font-bold transition-all cursor-pointer border mr-1",
                  cropChartToRange
                    ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-650 dark:text-emerald-400 shadow-sm"
                    : "text-spatio-muted hover:text-spatio-text hover:bg-spatio-surface-alt border-transparent"
                )}
                title={language === 'th' ? 'ตัดช่วงเวลาที่ไม่เลือกออก' : 'Crop unselected range'}
              >
                {language === 'th' ? 'แสดงเฉพาะช่วงที่เลือก' : 'Show Only Selected'}
              </button>
            )}
            <button onClick={() => handleZoom(0.25)} title="Zoom In" className="p-1 rounded text-spatio-muted hover:text-spatio-text hover:bg-spatio-surface-alt transition-colors cursor-pointer">
              <ZoomIn size={14} />
            </button>
            <button onClick={() => handleZoom(-0.25)} title="Zoom Out" className="p-1 rounded text-spatio-muted hover:text-spatio-text hover:bg-spatio-surface-alt transition-colors cursor-pointer">
              <ZoomOut size={14} />
            </button>
            <button onClick={() => handleZoom(0)} title="Fit Width" className="p-1 rounded text-spatio-muted hover:text-spatio-text hover:bg-spatio-surface-alt transition-colors cursor-pointer">
              <Maximize2 size={13} />
            </button>
            <span className="text-[10px] text-spatio-muted font-mono px-1 select-none">{Math.round(zoom * 100)}%</span>
            {hasSelection && (
              <button onClick={clearPeriodSelection} title={language === 'th' ? 'ล้างตัวเลือก' : 'Clear selection'} className="p-1 rounded text-red-500 hover:text-red-400 hover:bg-red-500/10 border-l border-spatio-border pl-1.5 transition-colors cursor-pointer">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* SVG Chart Scroll Wrapper */}
      <div ref={scrollWrapperRef}
        style={config ? {
          backgroundColor: config.bgColor ? hexToRgba(config.bgColor, config.bgOpacity ?? 1) : undefined,
          borderColor: config.borderColor || undefined,
          borderWidth: config.borderWidth !== undefined ? `${config.borderWidth}px` : undefined,
          borderStyle: config.borderWidth ? 'solid' : undefined,
        } : undefined}
        className={clsx(
          "flex-1 min-h-0 overflow-y-hidden rounded-xl p-2 scrollbar-thin",
          (!config?.bgColor && config?.borderWidth === undefined) && "bg-spatio-surface-alt/40 border border-spatio-border",
          isExportPreview ? "overflow-x-hidden" : "overflow-x-auto"
        )}>
        <div style={{ width: width + 'px', height: height + 'px' }} className="relative">
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onClick={handleSvgClick}
            className="select-none cursor-crosshair font-sans"
            style={{ fontFamily: "'Inter', 'Noto Sans Thai', 'Leelawadee UI', Tahoma, sans-serif" }}
          >
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4f46e5" />
                <stop offset="100%" stopColor="#312e81" />
              </linearGradient>
              <linearGradient id="peakGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
              <linearGradient id="currentGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#7e22ce" />
              </linearGradient>
              <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
              <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
              <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#b91c1c" />
              </linearGradient>
              <linearGradient id="yellowGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
            </defs>

            {/* Chart Title */}
            {config?.chartTitle && (
              <text
                x={width / 2}
                y={(config.paddingTop ?? paddingTop) / 2 + 5}
                fill={config.chartTitleColor ?? textColor}
                fontSize={config.chartTitleFontSize ?? (axisFontSize + 2)}
                textAnchor="middle"
                fontWeight="bold"
              >
                {config.chartTitle}
              </text>
            )}

            {/* Y Axis label & values */}
            {yAxisLabel && (
              <text
                x={12}
                y={paddingTop + chartH / 2}
                fill={textColor}
                fontSize={axisFontSize + 1}
                textAnchor="middle"
                fontWeight="bold"
                transform={`rotate(-90, 12, ${paddingTop + chartH / 2})`}
              >
                {yAxisLabel}
              </text>
            )}
            {[0, 0.25, 0.5, 0.75, 1].map(mult => {
              const val = Math.round(chartData.maxVal * mult)
              const y = height - paddingBottom - (chartH * mult)
              return (
                <text key={mult} x={paddingLeft - 8} y={y + 3} fill={mutedColor} fontSize={axisFontSize - 1} textAnchor="end">
                  {val.toLocaleString()}
                </text>
              )
            })}

            {/* Optional Grid Lines */}
            {showGrid && (
              <g stroke={gridColor} strokeOpacity={0.6} strokeWidth={1} strokeDasharray="3 3">
                <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} strokeDasharray="none" />
                <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={height - paddingBottom} strokeDasharray="none" />
                {[0.25, 0.5, 0.75, 1].map(mult => (
                  <line key={mult} x1={paddingLeft} y1={height - paddingBottom - chartH * mult} x2={width - paddingRight} y2={height - paddingBottom - chartH * mult} />
                ))}
              </g>
            )}

            {/* Range Highlight Background Frame */}
            {!cropChartToRange && (timelineStartKey || timelineEndKey) && (
              <rect
                x={paddingLeft + startIdx * barSpace}
                y={paddingTop}
                width={Math.max(2, (endIdx - startIdx + 1) * barSpace - barGap)}
                height={chartH}
                fill={isDark ? "rgba(16, 185, 129, 0.06)" : "rgba(16, 185, 129, 0.04)"}
                stroke={isDark ? "rgba(16, 185, 129, 0.35)" : "rgba(16, 185, 129, 0.25)"}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                rx={4}
                pointerEvents="none"
              />
            )}

            {/* Render Line / Area if selected */}
            {(chartType === 'line' || chartType === 'area') && (
              <path
                d={chartData.values.map((v, i) => {
                  const x = paddingLeft + i * barSpace + barWidth / 2
                  const y = height - paddingBottom - (v / chartData.maxVal) * chartH
                  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
                }).join(' ')}
                fill="none"
                stroke={barColor}
                strokeWidth={2}
                className="transition-all duration-300"
              />
            )}

            {chartType === 'area' && (
              <path
                d={chartData.values.map((v, i) => {
                  const x = paddingLeft + i * barSpace + barWidth / 2
                  const y = height - paddingBottom - (v / chartData.maxVal) * chartH
                  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
                }).join(' ') + ` L ${paddingLeft + (chartData.values.length - 1) * barSpace + barWidth / 2} ${height - paddingBottom} L ${paddingLeft + barWidth / 2} ${height - paddingBottom} Z`}
                fill={`url(#barGradient)`}
                opacity={0.2}
                stroke="none"
                className="transition-all duration-300"
              />
            )}

            {/* Bars or Markers */}
            {chartData.values.map((v, i) => {
              const h = (v / chartData.maxVal) * chartH
              const x = paddingLeft + i * barSpace
              const y = height - paddingBottom - h
              const cx = x + barWidth / 2
              const key = chartData.keys[i]
              const isSelected = selectedPeriods.has(key)
              const isCurrent = key === periods[currentStep]?.key
              const isMax = v === chartData.maxVal && v > 0

              const origIdx = periods.findIndex(p => p.key === key)
              const isInRange = (timelineStartKey || timelineEndKey)
                ? (origIdx >= startIdx && origIdx <= endIdx)
                : false

              let fill = "url(#blueGradient)"
              if (isCurrent && showNowMarker) {
                fill = "url(#yellowGradient)"
              } else if (isMax && showMaxMarker) {
                fill = "url(#redGradient)"
              } else if (isInRange) {
                fill = "url(#greenGradient)"
              }

              let opacity = isCurrent || isMax ? 1.0 : 0.8
              let stroke = 'none'
              let strokeWidth = 0

              if (isCurrent && showNowMarker) {
                stroke = "#fbbf24"
                strokeWidth = 2
              } else if (hasSelection) {
                if (isSelected) {
                  opacity = 1.0
                  stroke = 'var(--color-spatio-text)'
                  strokeWidth = 1.5
                } else {
                  opacity = 0.25
                }
              }

              return (
                <g key={key}>
                  {isCurrent && showNowMarker && (
                    <line
                      x1={cx}
                      y1={paddingTop}
                      x2={cx}
                      y2={height - paddingBottom}
                      stroke="#fbbf24"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      opacity={0.85}
                      pointerEvents="none"
                    />
                  )}

                  {chartType === 'bar' ? (
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={h}
                      rx={2.5}
                      fill={fill}
                      opacity={opacity}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      className="transition-all duration-200 cursor-pointer hover:brightness-125"
                      onClick={(e) => {
                        e.stopPropagation()
                        togglePeriodSelection(key, e.shiftKey)
                      }}
                      onMouseEnter={() => {
                        setTooltip({ label: chartData.labels[i], val: v, x: cx, y: y - 10 })
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  ) : (
                    /* Circle Markers for Line/Area chart */
                    <circle
                      cx={cx}
                      cy={y}
                      r={isCurrent || isSelected || (isMax && showMaxMarker) ? 4 : 2}
                      fill={fill}
                      opacity={opacity}
                      stroke={stroke !== 'none' ? stroke : 'var(--color-spatio-surface)'}
                      strokeWidth={strokeWidth > 0 ? strokeWidth : 1}
                      className="transition-all duration-200 cursor-pointer hover:r-5 hover:brightness-125"
                      onClick={(e) => {
                        e.stopPropagation()
                        togglePeriodSelection(key, e.shiftKey)
                      }}
                      onMouseEnter={() => {
                        setTooltip({ label: chartData.labels[i], val: v, x: cx, y: y - 10 })
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  )}

                  {isMax && !isCurrent && showMaxMarker && (
                    <text x={cx} y={y - 8} fill="#ef4444" fontSize={10} fontWeight="bold" textAnchor="middle">
                      MAX
                    </text>
                  )}
                  {isCurrent && showNowMarker && (
                    <text x={cx} y={y - 8} fill="#fbbf24" fontSize={10} fontWeight="bold" textAnchor="middle" className="animate-pulse">
                      NOW
                    </text>
                  )}
                </g>
              )
            })}

            {/* Drag Selection Highlight Overlay */}
            {dragStart !== null && dragCurrent !== null && (
              <rect
                x={Math.min(dragStart, dragCurrent)}
                y={paddingTop}
                width={Math.abs(dragStart - dragCurrent)}
                height={chartH}
                fill="rgba(79, 70, 229, 0.15)"
                stroke="var(--color-spatio-primary)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                pointerEvents="none"
              />
            )}

            {/* X Axis label (bottom center) */}
            {xAxisLabel && (
              <text
                x={paddingLeft + chartW / 2}
                y={height - 10}
                fill={textColor}
                fontSize={axisFontSize + 1}
                textAnchor="middle"
                fontWeight="bold"
              >
                {xAxisLabel}
              </text>
            )}

            {/* Labels */}
            {chartData.labels.map((l, i) => {
              if (i % labelStep !== 0) return null
              const x = paddingLeft + i * barSpace + barWidth / 2
              const y = height - paddingBottom + 18
              return (
                <text
                  key={i}
                  x={x}
                  y={y}
                  fill={mutedColor}
                  fontSize={axisFontSize}
                  textAnchor="end"
                  transform={`rotate(-45, ${x}, ${y})`}
                >
                  {formatLabel(l)}
                </text>
              )
            })}
          </svg>

          {/* Floating Tooltip inside container (Absolute coordinates matched with SVG space) */}
          {tooltip && (
            <div
              className="absolute pointer-events-none bg-spatio-surface border border-spatio-border shadow-lg px-2.5 py-1.5 rounded-lg text-[10px] text-spatio-text z-50 transition-all duration-100 backdrop-blur-sm"
              style={{
                left: `${tooltip.x}px`,
                top: `${tooltip.y}px`,
                transform: 'translate(-50%, -100%)'
              }}
            >
              <div className="text-spatio-muted mb-0.5">{language === 'th' ? `ช่วงเวลา: ${tooltip.label}` : `Period: ${tooltip.label}`}</div>
              <div className="font-bold text-indigo-650 dark:text-indigo-400">{language === 'th' ? `จำนวน: ${tooltip.val.toLocaleString()} ราย` : `Cases: ${tooltip.val.toLocaleString()} cases`}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
