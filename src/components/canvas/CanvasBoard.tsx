import React, { useMemo, useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { useAppStore, type MapWidgetConfig } from '../../store/useAppStore'
import { COLOR_PALETTES, getNextStartValue, getMap, getDecimalPlaces } from '../../map/mapController'
import { MapCallouts } from '../MapCallouts'
import { CanvasWidgetItem } from './CanvasWidgetItem'
import { CanvasContextMenu } from './CanvasContextMenu'

interface Props {
  mapRef: React.RefObject<HTMLDivElement | null>
}

const hexToRgba = (hex: string, alpha: number) => {
  if (!hex || hex === 'transparent') return 'transparent'
  hex = hex.replace('#', '')
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('')
  }
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const CanvasBoard: React.FC<Props> = ({ mapRef }) => {
  const {
    canvasWidgets,
    canvasSettings,
    selectedWidgetId,
    setSelectedWidgetId,
    logoUrl,
    logoPlacement,
    logoOpacity,
    annotations,
    arrows,
    setAnnotations,
    setArrows,
    palette,
    customColors,
    globalBreaks,
    breaksStart,
    widgetConfigs,
    mapVersion
  } = useAppStore()

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null)

  const mapWidget = canvasWidgets.find(w => w.type === 'map')

  // Invalidate map size when widgets geometry or configs change, to make sure Leaflet resizes correctly
  const mapWidth = mapWidget?.w
  const mapHeight = mapWidget?.h
  const mapX = mapWidget?.x
  const mapY = mapWidget?.y

  useEffect(() => {
    const map = getMap()
    if (map) {
      // Small delay to let DOM styles apply
      const timer = setTimeout(() => {
        map.invalidateSize()
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [mapWidth, mapHeight, mapX, mapY, canvasSettings.aspectRatio, canvasWidgets.length, mapVersion])

  // Calculate aspect ratio styling
  const getAspectStyle = () => {
    if (canvasSettings.aspectRatio === '16:9') {
      return { width: '100%', aspectRatio: '16/9' }
    } else if (canvasSettings.aspectRatio === '4:3') {
      return { width: '100%', aspectRatio: '4/3' }
    } else {
      return { width: '100%', aspectRatio: '1.414/1' } // A4 landscape
    }
  }

  // Pre-calculate colors and bands for Legend widget
  const colors = (palette === 'Custom' && customColors && customColors.length > 0)
    ? customColors
    : (COLOR_PALETTES[palette] ?? COLOR_PALETTES.YlOrRd)
  const bands = useMemo(() => {
    const allValues: number[] = [breaksStart]
    globalBreaks.forEach((b, i) => {
      allValues.push(b)
      if (i > 0) {
        allValues.push(getNextStartValue(globalBreaks[i - 1]))
      }
    })
    const maxDec = allValues.length > 0 ? Math.max(...allValues.map(getDecimalPlaces), 0) : 0

    const list = globalBreaks.map((b, i) => {
      const startVal = i === 0 ? breaksStart : getNextStartValue(globalBreaks[i - 1])
      return {
        color: colors[i] ?? colors[colors.length - 1],
        label: `${startVal.toLocaleString(undefined, { minimumFractionDigits: maxDec, maximumFractionDigits: maxDec })} – ${b.toLocaleString(undefined, { minimumFractionDigits: maxDec, maximumFractionDigits: maxDec })}`
      }
    })
    if (globalBreaks.length > 0) {
      list.push({
        color: colors[globalBreaks.length] ?? colors[colors.length - 1],
        label: `> ${globalBreaks[globalBreaks.length - 1].toLocaleString(undefined, { minimumFractionDigits: maxDec, maximumFractionDigits: maxDec })}`
      })
    }
    return list
  }, [globalBreaks, colors, breaksStart])

  // Dragging annotations (labels and arrows) with Pointer Capture
  const handleAnnotationPointerDown = (
    e: React.PointerEvent,
    type: 'text' | 'arrow-tail' | 'arrow-head',
    id: string
  ) => {
    if (e.button !== 0) return // Left click only
    e.preventDefault()
    e.stopPropagation()

    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    const captureArea = document.getElementById('spatio-capture-area')
    if (!captureArea) return

    const rect = captureArea.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY

    const originalAnn = annotations.find(a => a.id === id)
    const originalArrow = arrows.find(a => a.id === id)

    const handlePointerMove = (moveEvent: PointerEvent) => {
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

    const handlePointerUp = (upEvent: PointerEvent) => {
      target.releasePointerCapture(upEvent.pointerId)
      target.removeEventListener('pointermove', handlePointerMove)
      target.removeEventListener('pointerup', handlePointerUp)
    }

    target.addEventListener('pointermove', handlePointerMove)
    target.addEventListener('pointerup', handlePointerUp)
  }

  // Handle Delete Key for selected widget
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't delete if user is typing in an input or textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWidgetId) {
        useAppStore.getState().deleteCanvasWidget(selectedWidgetId)
        setSelectedWidgetId(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedWidgetId, setSelectedWidgetId])
  // Handle Custom Event for opening context menu from external buttons
  useEffect(() => {
    const handleContextMenuEvent = (e: CustomEvent<{x: number, y: number}>) => {
      setContextMenu({ x: e.detail.x, y: e.detail.y })
    }
    window.addEventListener('open-canvas-context-menu', handleContextMenuEvent as EventListener)
    return () => window.removeEventListener('open-canvas-context-menu', handleContextMenuEvent as EventListener)
  }, [])

  return (
    <div
      id="spatio-capture-area"
      style={{
        maxWidth: canvasSettings.aspectRatio === 'A4-landscape' ? '1120px' : '1200px',
        ...getAspectStyle(),
        backgroundColor: canvasSettings.theme === 'dark' ? '#0f172a' : '#ffffff',
        position: 'relative',
        fontFamily: "'Inter', 'Noto Sans Thai', 'Leelawadee UI', Tahoma, sans-serif",
      }}
      className={clsx(
        'shadow-2xl overflow-hidden border transition-colors duration-300 relative select-none font-sans',
        canvasSettings.theme === 'dark' ? 'border-slate-800' : 'border-slate-200'
      )}
      onClick={() => setSelectedWidgetId(null)}
      onContextMenu={(e) => {
        e.preventDefault()
        setContextMenu({ x: e.clientX, y: e.clientY })
      }}
    >
      {contextMenu && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Render Leaflet Map dynamically overlaying the Map Widget geometry inside a wrapper */}
      {mapWidget && (
        <div
          id="spatio-map-export-wrapper"
          style={{
            position: 'absolute',
            left: `${mapWidget.x}%`,
            top: `${mapWidget.y}%`,
            width: `${mapWidget.w}%`,
            height: `${mapWidget.h}%`,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        >
          {(() => {
            const mapConfig = widgetConfigs[mapWidget.id] as MapWidgetConfig | undefined
            const shadowValue = (() => {
              switch (mapConfig?.boxShadow) {
                case 'sm': return '0 1px 2px 0 rgba(0,0,0,0.15)'
                case 'md': return '0 4px 6px -1px rgba(0,0,0,0.2), 0 2px 4px -2px rgba(0,0,0,0.15)'
                case 'lg': return '0 10px 15px -3px rgba(0,0,0,0.25), 0 4px 6px -4px rgba(0,0,0,0.2)'
                case 'xl': return '0 20px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.25)'
                default: return 'none'
              }
            })()

            const mapStyle = {
              position: 'absolute' as const,
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              zIndex: 0,
              backgroundColor: mapConfig?.bgColor && mapConfig?.bgOpacity !== undefined ? hexToRgba(mapConfig.bgColor, mapConfig.bgOpacity) : 'transparent',
              borderWidth: `${mapConfig?.borderWidth ?? 0}px`,
              borderColor: mapConfig?.borderColor || '#334155',
              borderStyle: (mapConfig?.borderWidth ?? 0) > 0 ? 'solid' : 'none',
              borderRadius: `${mapConfig?.borderRadius ?? 0}px`,
              boxShadow: shadowValue,
              overflow: 'hidden',
              pointerEvents: (mapConfig?.isLocked ?? true) ? ('auto' as const) : ('none' as const),
            }

            return (
              <div
                ref={mapRef}
                id="spatio-map"
                style={mapStyle}
              />
            )
          })()}

          {/* Dynamic Map Callouts Overlay inside the wrapper */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              zIndex: 10,
              pointerEvents: 'none',
            }}
          >
            <MapCallouts isExportMode={true} />
          </div>
        </div>
      )}

      {/* Render other widgets inside the artboard */}
      {canvasWidgets.map((w) => (
        <CanvasWidgetItem
          key={w.id}
          widget={w}
          isSelected={selectedWidgetId === w.id}
          onSelect={() => setSelectedWidgetId(w.id)}
          bands={bands}
        />
      ))}

      {/* 1. Center Background Watermark Logo */}
      {logoUrl && logoPlacement === 'center-bg' && (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-[5]"
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

      {/* 2. Text Annotations Layer */}
      {annotations.map((ann) => (
        <div
          key={ann.id}
          className="absolute group pointer-events-auto cursor-move select-none z-[200] flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950/30 hover:bg-slate-950/60 hover:ring-1 hover:ring-blue-500/55 transition-all touch-none"
          style={{
            left: `${ann.x}%`,
            top: `${ann.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
          onPointerDown={(e) => handleAnnotationPointerDown(e, 'text', ann.id)}
          onClick={(e) => e.stopPropagation()}
        >
          <span
            className="font-bold select-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)] font-sans"
            style={{
              color: ann.color || '#ffffff',
              fontSize: `${ann.fontSize || 14}px`,
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.85)',
              fontFamily: "'Inter', 'Noto Sans Thai', 'Leelawadee UI', Tahoma, sans-serif",
            }}
          >
            {ann.text}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation()
              setAnnotations(annotations.filter((a) => a.id !== ann.id))
            }}
            className="no-export opacity-0 group-hover:opacity-100 p-0.5 bg-red-600 hover:bg-red-500 text-white rounded text-[8px] leading-none transition-opacity cursor-pointer shadow border border-red-700/30 font-bold"
            title="ลบข้อความ"
          >
            ✕
          </button>
        </div>
      ))}

      {/* 3. Draggable Arrows Vector Overlay */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-[190]">
        <defs>
          {arrows.map((arr) => (
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

        {arrows.map((arr) => {
          const x1 = `${arr.x1}%`
          const y1 = `${arr.y1}%`
          const x2 = `${arr.x2}%`
          const y2 = `${arr.y2}%`

          const midX = (arr.x1 + arr.x2) / 2
          const midY = (arr.y1 + arr.y2) / 2

          return (
            <g key={arr.id} className="pointer-events-auto">
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

              {/* Edit Handles (Tail / Head) */}
              <circle
                cx={x1}
                cy={y1}
                r="6"
                fill="#3b82f6"
                stroke="#ffffff"
                strokeWidth="1.5"
                className="cursor-move no-export pointer-events-auto drop-shadow-md active:scale-125 transition-transform touch-none"
                onPointerDown={(e) => handleAnnotationPointerDown(e, 'arrow-tail', arr.id)}
              >
                <title>ลากหางลูกศร</title>
              </circle>
              <circle
                cx={x2}
                cy={y2}
                r="6"
                fill="#ef4444"
                stroke="#ffffff"
                strokeWidth="1.5"
                className="cursor-move no-export pointer-events-auto drop-shadow-md active:scale-125 transition-transform touch-none"
                onPointerDown={(e) => handleAnnotationPointerDown(e, 'arrow-head', arr.id)}
              >
                <title>ลากหัวลูกศรชี้เป้า</title>
              </circle>

              {/* Midpoint Delete Handle */}
              <foreignObject
                x={`${midX}%`}
                y={`${midY}%`}
                width="16"
                height="16"
                transform="translate(-8, -8)"
                className="no-export pointer-events-auto"
              >
                <button
                  onClick={() => setArrows(arrows.filter((a) => a.id !== arr.id))}
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
    </div>
  )
}
