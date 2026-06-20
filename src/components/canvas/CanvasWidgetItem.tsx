import React from 'react'
import { clsx } from 'clsx'
import { Settings, Move } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { CanvasWidget, MapWidgetConfig, ChartWidgetConfig, TitleWidgetConfig, LegendWidgetConfig, LogoWidgetConfig } from '../../store/useAppStore'
import { EpiChart } from '../EpiChart'
import { getMap } from '../../map/mapController'

interface Props {
  widget: CanvasWidget
  isSelected: boolean
  onSelect: () => void
  bands: Array<{ color: string; label: string }>
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

export const CanvasWidgetItem: React.FC<Props> = ({ widget, isSelected, onSelect, bands }) => {
  const {
    widgetConfigs,
    canvasSettings,
    exportTitle,
    exportSubtitle,
    logoUrl,
    logoPlacement,
    isCumulative,
    periods,
    currentStep,
    colorMode,
    setIsWidgetInspectorOpen
  } = useAppStore()

  const period = periods[currentStep]
  const isLocked = widget.type === 'map' ? ((widgetConfigs[widget.id] as MapWidgetConfig | undefined)?.isLocked ?? true) : true

  // 1. Dragging via Pointer Capture
  const handlePointerDownDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    // Prevent dragging if click was on a resize handle or other interactive sub-elements
    const isHandle = (e.target as HTMLElement).closest('.resize-handle')
    if (isHandle) return

    const isSettingsBtn = (e.target as HTMLElement).closest('.settings-btn')
    if (isSettingsBtn) return

    if (e.button !== 0) return // Left click only
    e.preventDefault()
    e.stopPropagation()
    onSelect()

    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)

    const captureArea = document.getElementById('spatio-capture-area')
    if (!captureArea) return

    const rect = captureArea.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const originalX = widget.x
    const originalY = widget.y

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = ((moveEvent.clientX - startX) / rect.width) * 100
      const dy = ((moveEvent.clientY - startY) / rect.height) * 100

      // Clamp widget within 0% to (100% - width/height)
      const newX = Math.max(0, Math.min(100 - widget.w, originalX + dx))
      const newY = Math.max(0, Math.min(100 - widget.h, originalY + dy))

      useAppStore.getState().updateWidgetGeometry(widget.id, newX, newY, widget.w, widget.h)
    }

    const handlePointerUp = (upEvent: PointerEvent) => {
      target.releasePointerCapture(upEvent.pointerId)
      target.removeEventListener('pointermove', handlePointerMove)
      target.removeEventListener('pointerup', handlePointerUp)
      if (widget.type === 'map') {
        setTimeout(() => getMap()?.invalidateSize(), 50)
      }
    }

    target.addEventListener('pointermove', handlePointerMove)
    target.addEventListener('pointerup', handlePointerUp)
  }

  // 2. Resizing via Pointer Capture
  const handlePointerDownResize = (e: React.PointerEvent<HTMLDivElement>, direction: string) => {
    if (e.button !== 0) return // Left click only
    e.preventDefault()
    e.stopPropagation()

    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)

    const captureArea = document.getElementById('spatio-capture-area')
    if (!captureArea) return

    const rect = captureArea.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const originalX = widget.x
    const originalY = widget.y
    const originalW = widget.w
    const originalH = widget.h

    const minSize = 5 // Minimum 5% boundary size

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = ((moveEvent.clientX - startX) / rect.width) * 100
      const dy = ((moveEvent.clientY - startY) / rect.height) * 100

      let newX = originalX
      let newY = originalY
      let newW = originalW
      let newH = originalH

      // Resize Horizontally
      if (direction.includes('e')) {
        newW = Math.max(minSize, Math.min(100 - originalX, originalW + dx))
      } else if (direction.includes('w')) {
        const targetW = originalW - dx
        if (targetW >= minSize && originalX + dx >= 0) {
          newX = originalX + dx
          newW = targetW
        }
      }

      // Resize Vertically
      if (direction.includes('s')) {
        newH = Math.max(minSize, Math.min(100 - originalY, originalH + dy))
      } else if (direction.includes('n')) {
        const targetH = originalH - dy
        if (targetH >= minSize && originalY + dy >= 0) {
          newY = originalY + dy
          newH = targetH
        }
      }

      // Logo Aspect Ratio Lock
      if (widget.type === 'logo') {
        const img = document.getElementById(`logo-img-${widget.id}`) as HTMLImageElement
        if (img && img.naturalWidth && img.naturalHeight) {
          const imgAspect = img.naturalWidth / img.naturalHeight
          const canvasAspect = useAppStore.getState().canvasSettings.aspectRatio === '16:9' ? 16 / 9 :
            useAppStore.getState().canvasSettings.aspectRatio === '4:3' ? 4 / 3 : 1.414

          if (direction === 'n' || direction === 's') {
            newW = newH / (canvasAspect / imgAspect)
          } else {
            newH = newW * (canvasAspect / imgAspect)
            if (direction.includes('n')) {
              newY = originalY + originalH - newH
            }
          }
        }
      }

      // Map Aspect Ratio Lock
      if (widget.type === 'map' && (widgetConfigs[widget.id] as MapWidgetConfig | undefined)?.lockAspectRatio) {
        const aspect = originalW / originalH
        if (direction === 'n' || direction === 's') {
          newW = newH * aspect
        } else {
          newH = newW / aspect
          if (direction.includes('n')) {
            newY = originalY + originalH - newH
          }
        }
      }

      useAppStore.getState().updateWidgetGeometry(widget.id, newX, newY, newW, newH)
    }

    const handlePointerUp = (upEvent: PointerEvent) => {
      target.releasePointerCapture(upEvent.pointerId)
      target.removeEventListener('pointermove', handlePointerMove)
      target.removeEventListener('pointerup', handlePointerUp)
      if (widget.type === 'map') {
        setTimeout(() => getMap()?.invalidateSize(), 50)
      }
    }

    target.addEventListener('pointermove', handlePointerMove)
    target.addEventListener('pointerup', handlePointerUp)
  }

  // 3. Swatch helper for Legend widget
  const renderSwatch = (color: string, swatchType: LegendWidgetConfig['swatch']) => {
    const baseClass = 'shrink-0 border border-slate-950/20'
    if (swatchType === 'circle') {
      return <div className={clsx(baseClass, 'w-3 h-3 rounded-full')} style={{ background: color }} />
    }
    if (swatchType === 'line') {
      return <div className={clsx(baseClass, 'w-4.5 h-1 rounded-sm')} style={{ background: color }} />
    }
    return <div className={clsx(baseClass, 'w-3.5 h-2.5 rounded-sm')} style={{ background: color }} /> // default square
  }

  // Render content based on type
  const renderWidgetContent = () => {
    switch (widget.type) {
      case 'map':
        return (
          <div className="absolute inset-0 flex items-start justify-start select-none pointer-events-none p-2 gap-1.5">
            {/* Drag Handle Button */}
            <div
              className="pointer-events-auto bg-blue-600/90 hover:bg-blue-500 text-white font-bold px-2 py-1 rounded shadow-md cursor-move z-[600] no-export text-[9px] flex items-center gap-1 transition-colors active:scale-95"
              onPointerDown={handlePointerDownDrag}
              onClick={(e) => { e.stopPropagation(); onSelect(); }}
              title="คลิกค้างเพื่อลากย้ายวัตถุแผนที่"
            >
              <Move size={10} />
              <span>ย้าย</span>
            </div>

            {/* Settings Button Next to Drag Handle */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSelect()
                setIsWidgetInspectorOpen(true)
              }}
              onPointerDown={(e) => e.stopPropagation()} // Prevent drag on pointer down
              className="settings-btn pointer-events-auto bg-slate-900 hover:bg-slate-800 text-white p-1 rounded shadow-md z-[600] no-export flex items-center justify-center transition-colors active:scale-95 cursor-pointer"
              title="ตั้งค่าวัตถุแผนที่ (Settings)"
            >
              <Settings size={10} />
            </button>
          </div>
        )



      case 'chart':
        return (
          <div className="flex-1 min-h-0 pointer-events-none relative flex flex-col justify-stretch">
            <EpiChart isExportPreview={true} config={widgetConfigs[widget.id] as ChartWidgetConfig | undefined} />
          </div>
        )

      case 'title': {
        const config = (widgetConfigs[widget.id] || {}) as TitleWidgetConfig
        return (
          <div
            className="flex-1 min-h-0 pointer-events-none flex gap-2.5 p-2.5"
            style={{
              backgroundColor: hexToRgba(config.bgColor || '#0f172a', config.bgOpacity ?? 0),
              borderWidth: `${config.borderWidth ?? 0}px`,
              borderColor: config.borderColor || '#334155',
              borderStyle: (config.borderWidth ?? 0) > 0 ? 'solid' : 'none',
              borderRadius: `${config.borderRadius ?? 8}px`,
            }}
          >
            {logoUrl && config.showLogo && (
              <div className="w-10 h-10 rounded bg-slate-950/45 p-1 flex items-center justify-center shrink-0 border border-slate-700/30">
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
              </div>
            )}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <h2
                style={{
                  fontSize: `${config.titleFontSize ?? 13}px`,
                  color: config.titleColor || '#f1f5f9',
                  fontWeight: config.titleFontWeight || 'bold',
                  textAlign: config.align || 'left',
                  fontFamily: "'Inter', 'Noto Sans Thai', 'Leelawadee UI', Tahoma, sans-serif",
                }}
                className="leading-snug font-sans"
              >
                {exportTitle}
              </h2>
              {exportSubtitle && (
                <p
                  style={{
                    fontSize: `${config.subtitleFontSize ?? 9}px`,
                    color: config.subtitleColor || '#94a3b8',
                    textAlign: config.subtitleAlign || config.align || 'left',
                    fontWeight: config.subtitleFontWeight || 'normal',
                    fontFamily: "'Inter', 'Noto Sans Thai', 'Leelawadee UI', Tahoma, sans-serif",
                  }}
                  className="leading-normal mt-0.5 font-sans"
                >
                  {exportSubtitle}
                </p>
              )}
            </div>
          </div>
        )
      }

      case 'legend': {
        const config = (widgetConfigs[widget.id] || {}) as LegendWidgetConfig
        const isHorizontal = config.orientation === 'horizontal'
        return (
          <div
            className="flex-1 min-h-0 pointer-events-none p-3 shadow-md flex flex-col justify-start"
            style={{
              backgroundColor: hexToRgba(config.bgColor || '#0f172a', config.bgOpacity ?? 0.85),
              borderRadius: `${config.borderRadius ?? 12}px`,
              borderWidth: `${config.borderWidth ?? 1}px`,
              borderColor: config.borderColor || (canvasSettings.theme === 'dark' ? '#334155' : '#e2e8f0'),
              borderStyle: (config.borderWidth ?? 1) > 0 ? 'solid' : 'none',
            }}
          >
            <span
              style={{
                fontSize: `${config.titleFontSize ?? 11}px`,
                color: config.titleColor || (canvasSettings.theme === 'dark' ? '#f1f5f9' : '#0f172a'),
                fontWeight: config.titleFontWeight || 'bold',
                fontFamily: "'Inter', 'Noto Sans Thai', 'Leelawadee UI', Tahoma, sans-serif",
              }}
              className="block uppercase mb-2.5 border-b border-slate-800/50 pb-1 font-sans"
            >
              {config.customTitle || 'คำอธิบายสีสัญลักษณ์'}
            </span>

            {config.customBands ? (
              <div className={clsx('overflow-hidden', isHorizontal ? 'flex flex-row flex-wrap gap-x-3.5 gap-y-1.5' : 'flex flex-col gap-1')}>
                {config.customBands.map((b, i) => (
                  <div key={i} className="flex items-center gap-1.5 py-0.5 font-sans">
                    {renderSwatch(b.color, config.swatch)}
                    <span
                      style={{
                        fontSize: `${config.labelFontSize ?? 10}px`,
                        color: config.labelColor || (canvasSettings.theme === 'dark' ? '#cbd5e1' : '#1e293b'),
                        fontFamily: "'Inter', 'Noto Sans Thai', 'Leelawadee UI', Tahoma, sans-serif",
                      }}
                      className="font-medium whitespace-nowrap"
                    >
                      {b.label}
                    </span>
                  </div>
                ))}
              </div>
            ) : colorMode === 'custom' ? (
              <div className="flex items-center gap-1.5 py-0.5">
                <div className="w-3.5 h-2.5 rounded bg-gradient-to-r from-red-500 via-emerald-400 to-blue-500 shrink-0 border border-slate-700/40" />
                <span
                  style={{
                    fontSize: `${config.labelFontSize ?? 10}px`,
                    color: config.labelColor || (canvasSettings.theme === 'dark' ? '#cbd5e1' : '#1e293b'),
                    fontFamily: "'Inter', 'Noto Sans Thai', 'Leelawadee UI', Tahoma, sans-serif",
                  }}
                  className="font-medium font-sans"
                >
                  สีกำหนดเองตามคอลัมน์สี
                </span>
              </div>
            ) : (
              <div className={clsx('overflow-hidden', isHorizontal ? 'flex flex-row flex-wrap gap-x-3.5 gap-y-1.5' : 'flex flex-col gap-1')}>
                {bands.map((b, i) => {
                  const labelText = config.customLabels?.[i] || b.label
                  return (
                    <div key={i} className="flex items-center gap-1.5 py-0.5 font-sans">
                      {renderSwatch(b.color, config.swatch)}
                      <span
                        style={{
                          fontSize: `${config.labelFontSize ?? 10}px`,
                          color: config.labelColor || (canvasSettings.theme === 'dark' ? '#cbd5e1' : '#1e293b'),
                          fontFamily: "'Inter', 'Noto Sans Thai', 'Leelawadee UI', Tahoma, sans-serif",
                        }}
                        className="font-medium whitespace-nowrap"
                      >
                        {labelText}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      }

      case 'logo': {
        const config = (widgetConfigs[widget.id] || {}) as LogoWidgetConfig
        return (
          <div
            className="flex-1 w-full h-full flex items-center justify-center overflow-hidden"
            style={{
              opacity: config.opacity ?? 1,
            }}
          >
            {logoUrl ? (
              <img
                id={`logo-img-${widget.id}`}
                src={logoUrl}
                alt="Logo Widget"
                style={{
                  borderRadius: `${config.borderRadius ?? 0}px`,
                  borderWidth: `${config.borderWidth ?? 0}px`,
                  borderColor: config.borderColor || '#334155',
                  borderStyle: (config.borderWidth ?? 0) > 0 ? 'solid' : 'none'
                }}
                className="w-full h-full pointer-events-none object-contain"
                draggable={false}
                onLoad={(e) => {
                  const img = e.currentTarget
                  if (img.naturalWidth && img.naturalHeight) {
                    const imgAspect = img.naturalWidth / img.naturalHeight
                    const canvasAspect = useAppStore.getState().canvasSettings.aspectRatio === '16:9' ? 16 / 9 :
                      useAppStore.getState().canvasSettings.aspectRatio === '4:3' ? 4 / 3 : 1.414
                    const expectedH = widget.w * (canvasAspect / imgAspect)
                    if (Math.abs(widget.h - expectedH) > 0.2) {
                      useAppStore.getState().updateWidgetGeometry(widget.id, widget.x, widget.y, widget.w, expectedH)
                    }
                  }
                }}
              />
            ) : (
              <span className="text-[8px] text-slate-500 uppercase font-bold">🚫 ไม่มีโลโก้</span>
            )}
          </div>
        )
      }

      default:
        return null
    }
  }

  // 8 handles direction classes and cursor mapping
  const handles = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se']
  const getPositionClass = (h: string) => {
    switch (h) {
      case 'n': return 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize'
      case 's': return 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize'
      case 'e': return 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize'
      case 'w': return 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize'
      case 'nw': return 'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize'
      case 'ne': return 'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize'
      case 'sw': return 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize'
      case 'se': return 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize'
      default: return ''
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: `${widget.x}%`,
        top: `${widget.y}%`,
        width: `${widget.w}%`,
        height: `${widget.h}%`,
        zIndex: widget.zIndex,
        borderRadius: widget.type === 'map'
          ? `${(widgetConfigs[widget.id] as MapWidgetConfig | undefined)?.borderRadius ?? 12}px`
          : undefined,
      }}
      className={clsx(
        'absolute flex flex-col justify-stretch transition-shadow duration-200 select-none touch-none',
        widget.type === 'map'
          ? (isLocked ? 'pointer-events-none' : 'pointer-events-auto cursor-move')
          : 'pointer-events-auto rounded-xl',
        isSelected
          ? widget.type === 'map'
            ? 'border-2 border-blue-500 z-[500] shadow-[0_0_12px_rgba(59,130,246,0.35)] ring-1 ring-blue-500/20'
            : 'border-2 border-blue-500 bg-blue-500/5 z-[500] shadow-[0_0_12px_rgba(59,130,246,0.35)] ring-1 ring-blue-500/20'
          : widget.type === 'map'
            ? 'border-transparent hover:border-slate-700/60 cursor-pointer'
            : 'border-transparent hover:border-slate-700/60 cursor-pointer',
        canvasSettings.theme === 'dark' ? (widget.type !== 'map' && widget.type !== 'logo' && 'bg-slate-950/70') : (widget.type !== 'map' && widget.type !== 'logo' && 'bg-slate-100/90')
      )}
      onPointerDown={widget.type !== 'map' || !isLocked ? handlePointerDownDrag : undefined}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        setIsWidgetInspectorOpen(true)
      }}
    >
      {renderWidgetContent()}

      {/* Premium Resize Handles */}
      {isSelected && (
        <>
          <div className="absolute inset-0 pointer-events-none z-[100] no-export">
            {handles.map(h => (
              <div
                key={h}
                className={clsx(
                  'resize-handle absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-full pointer-events-auto shadow-md shadow-blue-500/10 active:scale-125 hover:scale-115 hover:bg-blue-50 transition-all',
                  getPositionClass(h)
                )}
                onPointerDown={(e) => handlePointerDownResize(e, h)}
              />
            ))}
          </div>

          {/* Settings Button */}
          {widget.type !== 'map' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsWidgetInspectorOpen(true)
              }}
              onPointerDown={(e) => e.stopPropagation()} // Prevent drag on pointer down
              className="settings-btn absolute -top-10 right-0 p-1.5 bg-slate-900 text-white rounded shadow-lg pointer-events-auto z-[200] hover:bg-slate-700 cursor-pointer no-export"
              title="ตั้งค่า (Settings)"
            >
              <Settings size={14} />
            </button>
          )}
        </>
      )}
    </div>
  )
}
