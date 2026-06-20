import React from 'react'
import { useAppStore } from '../store/useAppStore'
import type { ChartWidgetConfig } from '../store/useAppStore'
import { COLOR_PALETTES, getNextStartValue, getDecimalPlaces } from '../map/mapController'
import { clsx } from 'clsx'
import { EpiChart } from './EpiChart'


export function ExportOverlays() {
  const store = useAppStore()
  const {
    exportTitle,
    exportSubtitle,
    watermarkPosition,
    logoUrl,
    logoPlacement,
    logoOpacity,
    annotations,
    arrows,
    periods,
    currentStep,
    adminLevel,
    isCumulative,
    palette,
    colorMode,
    setAnnotations,
    setArrows,
    canvasWidgets,
    widgetConfigs,
  } = store

  // Get the chart widget's config (first chart widget found)
  const chartWidget = canvasWidgets.find(w => w.type === 'chart')
  const chartConfig = chartWidget ? (widgetConfigs[chartWidget.id] as ChartWidgetConfig | undefined) : undefined

  const breaks = store.globalBreaks
  const activePeriod = periods.length > 0 ? periods[currentStep] : null
  const isCustomColor = colorMode === 'custom'

  // Position classes helper for watermark and legend corners
  const getPositionClasses = (pos: typeof watermarkPosition, shiftUp: boolean = false) => {
    switch (pos) {
      case 'top-left':
        return 'left-4 top-4'
      case 'top-right':
        return 'right-4 top-4'
      case 'bottom-left':
        return shiftUp ? 'left-4 bottom-[205px]' : 'left-4 bottom-4'
      case 'bottom-right':
      default:
        return shiftUp ? 'right-4 bottom-[205px]' : 'right-4 bottom-4'
    }
  }

  // Draggable handle function for both text and arrows
  const handleMouseDown = (e: React.MouseEvent, type: 'text' | 'arrow-tail' | 'arrow-head', id: string) => {
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const captureArea = document.getElementById('spatio-capture-area')
    if (!captureArea) return

    const rect = captureArea.getBoundingClientRect()
    const originalAnn = annotations.find(a => a.id === id)
    const originalArrow = arrows.find(a => a.id === id)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX
      const dy = moveEvent.clientY - startY

      const dxPercent = (dx / rect.width) * 100
      const dyPercent = (dy / rect.height) * 100

      if (type === 'text' && originalAnn) {
        const newAnnotations = annotations.map(a =>
          a.id === id
            ? {
                ...a,
                x: Math.max(0, Math.min(100, originalAnn.x + dxPercent)),
                y: Math.max(0, Math.min(100, originalAnn.y + dyPercent))
              }
            : a
        )
        setAnnotations(newAnnotations)
      } else if (type === 'arrow-tail' && originalArrow) {
        const newArrows = arrows.map(a =>
          a.id === id
            ? {
                ...a,
                x1: Math.max(0, Math.min(100, originalArrow.x1 + dxPercent)),
                y1: Math.max(0, Math.min(100, originalArrow.y1 + dyPercent))
              }
            : a
        )
        setArrows(newArrows)
      } else if (type === 'arrow-head' && originalArrow) {
        const newArrows = arrows.map(a =>
          a.id === id
            ? {
                ...a,
                x2: Math.max(0, Math.min(100, originalArrow.x2 + dxPercent)),
                y2: Math.max(0, Math.min(100, originalArrow.y2 + dyPercent))
              }
            : a
        )
        setArrows(newArrows)
      }
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // Delete handlers
  const deleteAnnotation = (id: string) => {
    setAnnotations(annotations.filter(a => a.id !== id))
  }

  const deleteArrow = (id: string) => {
    setArrows(arrows.filter(a => a.id !== id))
  }

  // Pre-calculate colors for Legend
  const colors = COLOR_PALETTES[palette] ?? COLOR_PALETTES.YlOrRd
  const breaksStart = store.breaksStart
  const allValues: number[] = [breaksStart]
  breaks.forEach((b, i) => {
    allValues.push(b)
    if (i > 0) {
      allValues.push(getNextStartValue(breaks[i - 1]))
    }
  })
  const maxDec = allValues.length > 0 ? Math.max(...allValues.map(getDecimalPlaces), 0) : 0

  const bands = breaks.map((b, i) => {
    const startVal = i === 0 ? breaksStart : getNextStartValue(breaks[i - 1])
    return {
      color: colors[i] ?? colors[colors.length - 1],
      label: `${startVal.toLocaleString(undefined, { minimumFractionDigits: maxDec, maximumFractionDigits: maxDec })} – ${b.toLocaleString(undefined, { minimumFractionDigits: maxDec, maximumFractionDigits: maxDec })}`
    }
  })
  if (breaks.length > 0) {
    bands.push({
      color: colors[breaks.length] ?? colors[colors.length - 1],
      label: `> ${breaks[breaks.length - 1].toLocaleString(undefined, { minimumFractionDigits: maxDec, maximumFractionDigits: maxDec })}`
    })
  }

  return (
    <div className="absolute inset-0 z-[1100] pointer-events-none w-full h-full select-none">
      
      {/* 1. Center Background Watermark Logo */}
      {logoUrl && logoPlacement === 'center-bg' && (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none"
          style={{ opacity: logoOpacity }}
        >
          <img
            src={logoUrl}
            alt="Watermark Logo"
            className="max-w-[30vw] max-h-[30vh] object-contain"
            draggable={false}
          />
        </div>
      )}

      {/* 2. Custom Title Watermark Box */}
      <div className={clsx('absolute spatio-glass p-3.5 flex gap-3.5 max-w-[360px] pointer-events-auto border border-blue-500/20 shadow-2xl z-[10] transition-all duration-300', getPositionClasses(watermarkPosition, store.includeEpiCurve))}>
        {logoUrl && logoPlacement === 'watermark' && (
          <div className="w-12 h-12 rounded-lg bg-slate-950/45 p-1 flex items-center justify-center shrink-0 border border-slate-700/30">
            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-xs font-bold text-slate-100 leading-snug tracking-wide">{exportTitle}</h2>
          {exportSubtitle && (
            <p className="text-[10px] text-slate-300 font-medium leading-normal mt-0.5">{exportSubtitle}</p>
          )}
          
          <div className="flex flex-col gap-0.5 mt-2 pt-1.5 border-t border-slate-700/40 text-[9px] text-slate-400 font-medium">
            {activePeriod && (
              <div>ช่วงเวลา: <span className="text-blue-400 font-bold">{activePeriod.label}</span></div>
            )}
            <div>
              โหมด: <span className="text-slate-300">{isCumulative ? 'การระบาดสะสม (Cumulative)' : 'การระบาดรายช่วง'}</span>
            </div>
            <div>
              ขอบเขตปกครอง: <span className="text-slate-300">ระดับ{adminLevel === 'province' ? 'จังหวัด' : adminLevel === 'district' ? 'อำเภอ' : 'ตำบล'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Custom Color Legend Box */}
      {((breaks.length > 0 && !isCustomColor) || isCustomColor) && (
        <div className={clsx('absolute spatio-glass p-3 min-w-[170px] pointer-events-auto border border-slate-700/50 shadow-xl z-[10] transition-all duration-300', getPositionClasses(store.legendPosition, store.includeEpiCurve))}>
          <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 border-b border-slate-800 pb-1">
            คำอธิบายสีสัญลักษณ์
          </span>
          {isCustomColor ? (
            <div className="flex items-center gap-2 py-0.5">
              <div className="w-4 h-3 rounded bg-gradient-to-r from-red-500 via-emerald-400 to-blue-500 shrink-0 border border-slate-700/40" />
              <span className="text-[10px] text-slate-200">สีกำหนดเองตามคอลัมน์สี</span>
            </div>
          ) : (
            <>
              {bands.map((b, i) => (
                <div key={i} className="flex items-center gap-2 mb-0.5 last:mb-0">
                  <div className="w-4 h-2.5 rounded-sm shrink-0 border border-slate-950/20" style={{ background: b.color }} />
                  <span className="text-[10px] text-slate-200 font-medium">{b.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-1 pt-1.5 border-t border-slate-850/60">
                <div className="w-4 h-2.5 rounded-sm shrink-0 bg-slate-900 border border-slate-700/30" />
                <span className="text-[10px] text-slate-400">ไม่มีข้อมูล / 0</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* 4. Text Annotations Layer */}
      {annotations.map(ann => (
        <div
          key={ann.id}
          className="absolute group pointer-events-auto cursor-move select-none z-[20] flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950/30 hover:bg-slate-950/60 hover:ring-1 hover:ring-blue-500/55 transition-all"
          style={{
            left: `${ann.x}%`,
            top: `${ann.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
          onMouseDown={(e) => handleMouseDown(e, 'text', ann.id)}
        >
          {/* Label Text with outlines for heavy contrast readability */}
          <span
            className="font-bold tracking-wide select-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)]"
            style={{
              color: ann.color || '#ffffff',
              fontSize: `${ann.fontSize || 14}px`,
              textShadow: '0 0 4px #000, 0 0 4px #000, 0 0 4px #000',
            }}
          >
            {ann.text}
          </span>

          {/* Delete label button (Excluded from screenshot) */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              deleteAnnotation(ann.id)
            }}
            className="no-export opacity-0 group-hover:opacity-100 p-0.5 bg-red-600 hover:bg-red-500 text-white rounded text-[8px] leading-none transition-opacity cursor-pointer shadow border border-red-700/30 font-bold"
            title="ลบข้อความ"
          >
            ✕
          </button>
        </div>
      ))}

      {/* 5. Draggable Arrows Vector Overlay */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-[15]">
        <defs>
          {arrows.map(arr => (
            <marker
              key={`marker-${arr.id}`}
              id={`arrow-head-${arr.id}`}
              markerWidth="8"
              markerHeight="6"
              refX="7.5"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill={arr.color} />
            </marker>
          ))}
        </defs>

        {arrows.map(arr => {
          // Calculate percentage coordinates
          const x1 = `${arr.x1}%`
          const y1 = `${arr.y1}%`
          const x2 = `${arr.x2}%`
          const y2 = `${arr.y2}%`

          // Midpoint calculation for the delete button
          const midX = (arr.x1 + arr.x2) / 2
          const midY = (arr.y1 + arr.y2) / 2

          return (
            <g key={arr.id} className="pointer-events-auto">
              {/* The Line Arrow */}
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={arr.color}
                strokeWidth={arr.strokeWidth}
                markerEnd={`url(#arrow-head-${arr.id})`}
                className="drop-shadow-[0_2px_3px_rgba(0,0,0,0.85)]"
              />

              {/* Edit Handles (Tail / Head) — Excluded from screenshots */}
              <circle
                cx={x1}
                cy={y1}
                r="7"
                fill="#3b82f6"
                stroke="#ffffff"
                strokeWidth="1.5"
                className="cursor-move no-export pointer-events-auto drop-shadow-md active:scale-125 transition-transform"
                onMouseDown={(e) => handleMouseDown(e, 'arrow-tail', arr.id)}
              >
                <title>ลากหางลูกศร</title>
              </circle>
              <circle
                cx={x2}
                cy={y2}
                r="7"
                fill="#ef4444"
                stroke="#ffffff"
                strokeWidth="1.5"
                className="cursor-move no-export pointer-events-auto drop-shadow-md active:scale-125 transition-transform"
                onMouseDown={(e) => handleMouseDown(e, 'arrow-head', arr.id)}
              >
                <title>ลากหัวลูกศรชี้เป้า</title>
              </circle>

              {/* Midpoint Delete Handle (Excluded from screenshot) */}
              <foreignObject
                x={`${midX}%`}
                y={`${midY}%`}
                width="16"
                height="16"
                transform="translate(-8, -8)"
                className="no-export pointer-events-auto"
              >
                <button
                  onClick={() => deleteArrow(arr.id)}
                  className="w-4 h-4 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center text-[8px] leading-none transition-all cursor-pointer font-bold shadow border border-red-700/30"
                  title="ลบลูกศร"
                >
                  ✕
                </button>
              </foreignObject>
            </g>
          )
        })}
      </svg>

      {/* 6. Epidemic Curve Chart Overlay inside Capture Area */}
      {store.includeEpiCurve && (
        <div className="absolute bottom-4 left-4 right-4 z-[10] bg-[#0f172a]/90 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-2xl pointer-events-auto animate-fade-in">
          <EpiChart isExportPreview={true} config={chartConfig} />
        </div>
      )}

    </div>
  )
}
