/**
 * Explorer.tsx — Main Map Explorer Page
 * รวม: Map + File Upload + Timeline Slider + Controls
 * @updated: force-refresh TS language server cache
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useTranslation } from '../hooks/useTranslation'
import { initMap, destroyMap, loadGeoDataFromJSON, getMap, setPanePriority, switchBaseMap, updateBaseMapVisibility, COLOR_PALETTES, getNextStartValue, resetZoom, fitToScope } from '../map/mapController'
import { mountChoropleth, updateChoropleth, clearChoroplethColors, maskChoropleth, destroyChoropleth, forceRedrawChoropleth } from '../map/choroplethLayer'
import { mountBubbles, destroyBubbles } from '../map/bubbleLayer'
import { mountBorders, updateBorderVisibility, applyBorderScope, destroyBorders } from '../map/borderLayer'
import { mountPointLayer, destroyPointLayer } from '../map/pointLayer'
import { MappingModal } from '../components/MappingModal'
import { ScopeFilter } from '../components/ScopeFilter'
import { MapInfoPanel } from '../components/MapInfoPanel'
import { MapComparisonModal } from '../components/MapComparisonModal'
import { AnalysisPanel } from '../components/AnalysisPanel'
import { buildDictionary, buildCumulativeSlice, buildStaticDictionary, STATIC_KEY, clearCumulativeCache, buildSelectionSlice } from '../data/aggregator'
import { registry } from '../data/registry'
import { getWeekRange } from '../data/dateParser'
import { EpiChart } from '../components/EpiChart'
import type { ChartWidgetConfig } from '../store/useAppStore'
import {
  Upload, Play, Pause, ChevronLeft, ChevronRight,
  Layers, SkipBack, SkipForward, Settings2, Plus, Minus,
  Eye, EyeOff, Ghost, RotateCcw, Moon, Map, Satellite, Paintbrush
} from 'lucide-react'
import { clsx } from 'clsx'
import { ExportOverlays } from '../components/ExportOverlays'
import { MapCallouts } from '../components/MapCallouts'
import { CanvasBoard } from '../components/canvas/CanvasBoard'

// ──────────────────────────────────────────
// Types & Labels
// ──────────────────────────────────────────
import type { AdminLevel, DataKeys, CanvasWidget, IngestionMode } from '../store/useAppStore'

function computeAvailableLevels(keys: DataKeys, geoMode?: 'admin' | 'coordinate'): Set<AdminLevel> {
  const levels = new Set<AdminLevel>()
  // ในโหมดพิกัดจริง หรือเมื่อระบุพิกัด Lat/Lng: สามารถวิเคราะห์ขอบเขตพื้นที่ครบทั้ง 3 ระดับเสมอ
  if (geoMode === 'coordinate' || (keys.lat && keys.lng)) {
    levels.add('province')
    levels.add('district')
    levels.add('subdistrict')
    return levels
  }
  const hasSub = !!keys.subdistrict; const hasDist = !!keys.district; const hasProv = !!keys.province
  if (hasProv || hasDist || hasSub) levels.add('province')
  if (hasDist || hasSub) levels.add('district')
  if (hasSub) levels.add('subdistrict')
  return levels
}

const LEVEL_LABELS: Record<AdminLevel, string> = { province: 'จังหวัด', district: 'อำเภอ', subdistrict: 'ตำบล' }

// ──────────────────────────────────────────
// Worker Singleton
// ──────────────────────────────────────────
let _worker: Worker | null = null
function getWorker(): Worker {
  if (!_worker) {
    _worker = new Worker(new URL('../workers/ingestWorker.ts', import.meta.url), { type: 'module' })
  }
  return _worker
}

// ──────────────────────────────────────────
// Explorer Component
// ──────────────────────────────────────────
export function Explorer({ isExportMode = false }: { isExportMode?: boolean }) {
  const { t } = useTranslation()
  const mapRef = useRef<HTMLDivElement>(null)
  const [geoLoaded, setGeoLoaded] = useState(false)
  const [showChart, setShowChart] = useState(false)
  const [isCompareOpen, setIsCompareOpen] = useState(false)
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false)
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isDragging = useRef(false)
  const [layoutTrigger, setLayoutTrigger] = useState(0)
  const lastLayoutTriggerRef = useRef(0)
  const [zoomVal, setZoomVal] = useState(6)

  const handleZoomSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    setZoomVal(val)
    getMap()?.setZoom(val)
  }

  const {
    rawRows, dataKeys, ingestionMode, dictionary, periods, currentStep, isPlaying, groupingMode, adminLevel,
    scope, palette, customColors, isLoading, loadingMsg, displayMode, isCumulative,
    globalStats, globalBreaks, selectedPeriods, togglePeriodSelection, clearPeriodSelection,
    setRawRows, setDataKeys, setDictionary, setPeriods,
    setCurrentStep, setIsPlaying, nextStep, setDisplayMode, setIsCumulative,
    setLoading, notify, mapReady, mapVersion, setAdminLevel, setIsMappingOpen, setMapReady,
    setGroupingMode, colorMode, setColorMode, setMappingModalTab,
    geoMode, setGeoMode, pointStyle, setPointStyle, baseMapStyle, setBaseMapStyle,
    showBoundaries, setShowBoundaries, showBaseMap, setShowBaseMap, showBorders, setShowBorders,
    showZeroAreas, setShowZeroAreas, isZenMode, setIsZenMode, includeEpiCurve,
    canvasWidgets, canvasSettings, selectedWidgetId, setSelectedWidgetId,
    logoUrl, logoPlacement, exportTitle, exportSubtitle, logoOpacity,
    annotations, arrows, setAnnotations, setArrows,
    widgetConfigs,
    breaksStart,
    timelineStartKey,
    timelineEndKey,
    setTimelineStartKey,
    setTimelineEndKey,
  } = useAppStore()

  const startIdx = useMemo(() => {
    return timelineStartKey ? periods.findIndex(p => p.key === timelineStartKey) : 0
  }, [periods, timelineStartKey])

  const endIdx = useMemo(() => {
    return timelineEndKey ? periods.findIndex(p => p.key === timelineEndKey) : periods.length - 1
  }, [periods, timelineEndKey])

  const clampedStart = startIdx === -1 ? 0 : startIdx
  const clampedEnd = endIdx === -1 ? periods.length - 1 : endIdx

  // ── 1. Init Map ──
  useEffect(() => {
    initMap('spatio-map', isExportMode)
    loadGeoDataFromJSON().then(() => {
      setMapReady(true); setGeoLoaded(true)
      mountBorders() // ตรวจสอบว่าวาดเส้นขอบแน่นอน
    }).catch(err => console.error('[Explorer] GeoData load error:', err))
    return () => {
      destroyMap()
      destroyBorders()
      destroyChoropleth()
      destroyBubbles()
      destroyPointLayer()
    }
  }, [setMapReady, isExportMode, canvasWidgets.find(w => w.type === 'map')?.id])

  // Synchronize zoom state from map
  useEffect(() => {
    if (mapReady) {
      const map = getMap()
      if (!map) return
      setZoomVal(map.getZoom())

      const handleZoom = () => {
        setZoomVal(map.getZoom())
      }
      map.on('zoomend', handleZoom)
      map.on('zoom', handleZoom)
      return () => {
        map.off('zoomend', handleZoom)
        map.off('zoom', handleZoom)
      }
    }
  }, [mapReady, mapVersion])

  // ── 1.5 Base Map Sync Effect ──
  useEffect(() => {
    if (mapReady) {
      switchBaseMap(baseMapStyle)
    }
  }, [mapReady, baseMapStyle, mapVersion])

  // ── 1.6 Base Map Visibility Effect ──
  useEffect(() => {
    if (mapReady) {
      updateBaseMapVisibility(showBaseMap)
    }
  }, [mapReady, showBaseMap, mapVersion])

  // ── 1.65 Auto-fit Map to Scope on Change ──
  useEffect(() => {
    if (mapReady) {
      fitToScope(scope.province, scope.district, scope.subdistrict, scope.region)
    }
  }, [mapReady, scope.province, scope.district, scope.subdistrict, scope.region, mapVersion])

  // ── 1.7 Refresh map size on layout change & container resizing (EpiChart toggle, Export Mode) ──
  useEffect(() => {
    if (mapReady) {
      const map = getMap()
      if (!map) return

      // Run invalidateSize at multiple intervals to capture transitions and rendering delays
      const timeouts = [50, 200, 500, 1000].map(delay =>
        setTimeout(() => {
          map.invalidateSize()
          if (delay === 200 || delay === 500) {
            setLayoutTrigger(prev => prev + 1)
          }
          if (isExportMode && delay === 500) {
            const currentScope = useAppStore.getState().scope
            fitToScope(currentScope.province, currentScope.district, currentScope.subdistrict, currentScope.region)
          }
        }, delay)
      )

      return () => timeouts.forEach(clearTimeout)
    }
  }, [mapReady, isExportMode, includeEpiCurve, mapVersion])  // ── 2. Unified Map Update (The Source of Truth) ──
  useEffect(() => {
    if (!mapReady || !geoLoaded) return

    const forceBypass = layoutTrigger !== lastLayoutTriggerRef.current
    lastLayoutTriggerRef.current = layoutTrigger

    // 1. จัดการการเปิด-ปิดชั้นเส้นแบ่งเขตปกครอง (Borders)
    if (showBorders) {
      mountBorders()
      updateBorderVisibility(adminLevel)

      import('../data/healthZones').then(({ getProvincesInZone }) => {
        let sp: Set<string> | null = null
        if (scope.province !== 'all') sp = new Set([scope.province])
        else if (scope.region !== 'all') sp = new Set(getProvincesInZone(Number(scope.region)))
        applyBorderScope(sp, adminLevel)
      })
    } else {
      destroyBorders()
    }

    // 2. จัดการการเปิด-ปิดพิกัดเคสผู้ป่วยจริง (Point Layer / Coordinate Mode)
    if (geoMode === 'coordinate') {
      setPanePriority('bubble')
      destroyBubbles()
      if (showBoundaries) {
        mountChoropleth(adminLevel)
        maskChoropleth(scope, adminLevel)
      } else {
        destroyChoropleth()
      }
      mountPointLayer()
    } else {
      if ((window as any).driftRes) {
        mountPointLayer()
      } else {
        destroyPointLayer()
      }

      // 3. จัดการการเปิด-ปิดสีระบายพื้นหลัง/แคนวาสแผนที่ (Choropleth Fill Background)
      if (showBoundaries) {
        mountChoropleth(adminLevel)

        if (periods.length > 0 && dictionary) {
          const period = periods[currentStep]
          if (!period) return

          let dictToUse = dictionary
          let keyToUse = period.key

          if (selectedPeriods.size > 1) {
            dictToUse = buildSelectionSlice(dictionary, periods, selectedPeriods)
            keyToUse = '__selection__'
          } else if (isCumulative) {
            dictToUse = buildCumulativeSlice(dictionary, periods, currentStep)
            keyToUse = '__cumulative__'
          }

          if (displayMode === 'choropleth') {
            setPanePriority('choropleth')
            destroyBubbles()
            if (forceBypass) {
              forceRedrawChoropleth()
            }
            updateChoropleth(dictToUse, keyToUse, adminLevel, palette, scope, false, globalBreaks)
          } else {
            setPanePriority('bubble')
            clearChoroplethColors(scope, adminLevel)
            mountBubbles(dictToUse, keyToUse, adminLevel, palette, scope, globalBreaks, customColors)
          }
        } else {
          maskChoropleth(scope, adminLevel)
        }
      } else {
        destroyChoropleth()
        destroyBubbles()
      }
    }
  }, [mapReady, geoLoaded, adminLevel, displayMode, scope, dictionary, periods, currentStep, isCumulative, globalBreaks, palette, customColors, selectedPeriods, colorMode, geoMode, pointStyle, baseMapStyle, showBaseMap, showBoundaries, showBorders, showZeroAreas, layoutTrigger, mapVersion])
  // ── 2.5 Auto-sync Single Period Selection to Map Timeline ──
  useEffect(() => {
    if (selectedPeriods.size === 1) {
      const key = Array.from(selectedPeriods)[0]
      const idx = periods.findIndex(p => p.key === key)
      if (idx !== -1 && idx !== currentStep) {
        setIsPlaying(false)
        setCurrentStep(idx)
      }
    }
  }, [selectedPeriods, periods, currentStep, setCurrentStep, setIsPlaying])

  // ── 2.6 Guard: Force Choropleth view when Custom Color mode is selected ──
  useEffect(() => {
    if (colorMode === 'custom' && displayMode === 'bubble') {
      setDisplayMode('choropleth')
    }
  }, [colorMode, displayMode, setDisplayMode])

  // ── Auto-play ──
  useEffect(() => {
    if (isPlaying) playTimerRef.current = setInterval(() => nextStep(), 800)
    else if (playTimerRef.current) clearInterval(playTimerRef.current)
    return () => { if (playTimerRef.current) clearInterval(playTimerRef.current) }
  }, [isPlaying, nextStep])

  // ── File Upload ──
  const handleFile = useCallback((file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) { notify('error', t('exp_file_type_err')); return }
    setLoading(true, t('exp_reading_file', { name: file.name }))
    const reader = new FileReader()
    reader.onload = async (e) => {
      const buf = e.target?.result as ArrayBuffer
      const worker = getWorker()
      worker.onmessage = async (msg) => {
        const { type, rows, guessedMapping, rowCount, message } = msg.data
        if (type === 'PROGRESS') setLoading(true, `${msg.data.msg} (${msg.data.percent}%)`)
        else if (type === 'DONE') {
          const mergedKeys = { ...useAppStore.getState().dataKeys, ...guessedMapping }
          const isCoord = !!(mergedKeys.lat && mergedKeys.lng)
          const hasDate = !!mergedKeys.date
          const calculatedMode: IngestionMode = isCoord
            ? (hasDate ? 'coord_dynamic' : 'coord_static')
            : (hasDate ? 'admin_dynamic' : 'admin_static')

          setDataKeys(guessedMapping)
          setRawRows(rows, {
            fileName: file.name,
            rowCount,
            keys: mergedKeys,
            loadedAt: new Date(),
            ingestionMode: calculatedMode
          })

          clearCumulativeCache()
          const result = hasDate
            ? await buildDictionary(rows, mergedKeys, useAppStore.getState().groupingMode)
            : await buildStaticDictionary(rows, mergedKeys)

          setDictionary(result.dictionary); setPeriods(result.periods); setLoading(false)
          notify('success', t('exp_load_success', { count: rowCount.toLocaleString(), periods: result.periods.length }))
          if (!guessedMapping.value && !(guessedMapping.province || guessedMapping.district)) setTimeout(() => setIsMappingOpen(true), 150)
        } else if (type === 'ERROR') { setLoading(false); notify('error', t('exp_load_failed', { msg: message })) }
      }
      worker.postMessage({ type: 'LOAD', fileData: buf, fileName: file.name })
    }
    reader.readAsArrayBuffer(file)
  }, [setLoading, setRawRows, setDataKeys, setDictionary, setPeriods, notify, setIsMappingOpen, t])

  const period = periods[currentStep]
  const isStatic = periods.length === 1 && periods[0]?.key === STATIC_KEY
  const availableLevels = useMemo(() => computeAvailableLevels(dataKeys, geoMode), [dataKeys, geoMode])
  const selectedPeriodObjects = useMemo(() => {
    if (selectedPeriods.size <= 1) return []
    return periods.filter(p => selectedPeriods.has(p.key))
  }, [periods, selectedPeriods])

  const mapWidget = canvasWidgets.find(w => w.type === 'map')
  const chartWidget = canvasWidgets.find(w => w.type === 'chart')
  const titleWidget = canvasWidgets.find(w => w.type === 'title')
  const legendWidget = canvasWidgets.find(w => w.type === 'legend')

  const getAspectStyle = () => {
    if (canvasSettings.aspectRatio === '16:9') {
      return { width: '100%', aspectRatio: '16/9' }
    } else if (canvasSettings.aspectRatio === '4:3') {
      return { width: '100%', aspectRatio: '4/3' }
    } else {
      return { width: '100%', aspectRatio: '1.414/1' }
    }
  }

  // Pre-calculate colors for Legend
  const colors = COLOR_PALETTES[palette] ?? COLOR_PALETTES.YlOrRd
  const bands = globalBreaks.map((b, i) => {
    const startVal = i === 0 ? breaksStart : getNextStartValue(globalBreaks[i - 1])
    return {
      color: colors[i] ?? colors[colors.length - 1],
      label: `${startVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 10 })} – ${b.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 10 })}`
    }
  })
  if (globalBreaks.length > 0) {
    bands.push({
      color: colors[globalBreaks.length] ?? colors[colors.length - 1],
      label: `> ${globalBreaks[globalBreaks.length - 1].toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 10 })}`
    })
  }

  return (
    <div className="relative w-full h-full overflow-hidden"
      onDragOver={(e) => { e.preventDefault(); isDragging.current = true }}
      onDrop={(e) => { e.preventDefault(); isDragging.current = false; const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}>

      {isExportMode ? (
        <div className="absolute inset-0 bg-spatio-bg flex items-center justify-center p-8 overflow-auto z-0 animate-fade-in">
          <CanvasBoard mapRef={mapRef} />
        </div>
      ) : (
        <div
          id="spatio-capture-area"
          className="absolute inset-0 z-0 font-sans"
          style={{ fontFamily: "'Inter', 'Noto Sans Thai', 'Leelawadee UI', Tahoma, sans-serif" }}
        >
          <div
            ref={mapRef}
            id="spatio-map"
            className="absolute inset-0"
          />
          {/* No MapCallouts rendered in Live Map Explorer mode to separate live map from canvas label settings */}
        </div>
      )}


      {isLoading && (
        <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center bg-spatio-bg/80 backdrop-blur-sm animate-fade-in">
          <div className="w-10 h-10 border-2 border-spatio-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm text-spatio-text">{loadingMsg}</p>
        </div>
      )}

      {/* Control Panels */}
      <div className={clsx(
        "absolute top-4 left-4 z-[1000] flex flex-col gap-2 w-[168px] transition-all duration-300",
        isExportMode && "opacity-0 pointer-events-none -translate-x-12 scale-90"
      )}>
        {/* Collapsible Surrounding Control Panels */}
        <div className={clsx(
          "flex flex-col gap-2 transition-all duration-350 ease-out origin-top-left",
          isZenMode ? "opacity-0 -translate-x-12 scale-90 pointer-events-none max-h-0 overflow-hidden" : "opacity-100 translate-x-0 scale-100 max-h-[80vh] overflow-y-auto"
        )}>
          {/* Header Buttons (Import / Manage Data) */}
          <div className="flex items-stretch shadow-md rounded-xl overflow-hidden border border-spatio-border/30 spatio-glass w-full shrink-0">
            <button
              onClick={() => {
                setMappingModalTab('upload')
                setIsMappingOpen(true)
              }}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-spatio-primary hover:opacity-90 text-white text-[10.5px] font-semibold cursor-pointer transition-all active:scale-95"
            >
              <Upload size={12} /> <span>{t('exp_import_btn')}</span>
            </button>
            <button
              onClick={() => {
                setMappingModalTab('mapping')
                setIsMappingOpen(true)
              }}
              className="flex items-center justify-center w-8 bg-spatio-surface text-spatio-text border-l border-spatio-border/30 hover:bg-black/5 dark:hover:bg-white/5 transition-colors active:scale-95 transition-all cursor-pointer shrink-0"
              title={t('nav_settings')}
            >
              <Settings2 size={13} />
            </button>
          </div>

          {/* Base Map Switcher Control */}
          <div className="spatio-glass flex flex-col gap-1 p-1.5 w-full border border-spatio-border/30">
            <span className="block text-[9px] text-spatio-muted font-bold uppercase mb-0.5 px-1 tracking-tight select-none">
              {t('exp_base_map')}
            </span>
            <div className="flex gap-1 items-center">
              <div className="flex gap-0.5 flex-1 min-w-0">
                {(['dark', 'street', 'satellite'] as const).map(style => {
                  const IconComponent = style === 'dark' ? Moon : style === 'street' ? Map : Satellite
                  const label = style === 'dark' ? t('exp_map_dark') : style === 'street' ? t('exp_map_street') : t('exp_map_satellite')
                  return (
                    <button
                      key={style}
                      onClick={() => setBaseMapStyle(style)}
                      title={label}
                      className={clsx(
                        'flex-1 py-1 px-0.5 rounded transition-all cursor-pointer text-center flex items-center justify-center',
                        baseMapStyle === style
                          ? 'bg-spatio-primary text-white shadow'
                          : 'text-spatio-muted hover:text-spatio-text hover:bg-black/5 dark:hover:bg-white/10'
                      )}
                    >
                      <IconComponent size={13} />
                    </button>
                  )
                })}
              </div>

              {/* Eye Icon button inside Base Map switcher row */}
              <button
                onClick={() => setShowBaseMap(!showBaseMap)}
                className={clsx(
                  'p-1 rounded text-xs font-semibold transition-all flex items-center justify-center active:scale-95 border-l border-spatio-border/50 pl-1 ml-0.5 cursor-pointer shrink-0',
                  showBaseMap
                    ? 'text-spatio-primary hover:opacity-85'
                    : 'text-spatio-muted hover:text-spatio-text hover:bg-black/5 dark:hover:bg-white/5'
                )}
                title={showBaseMap ? t('exp_hide_base') : t('exp_show_base')}
              >
                {showBaseMap ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
            </div>
          </div>

          {/* Administrative Level selection row */}
          <div className="spatio-glass flex flex-col gap-1.5 p-1.5 border border-spatio-border/30 w-full">
            <div className="flex gap-0.5 w-full">
              {(['province', 'district', 'subdistrict'] as const).map(lvl => {
                const isAvail = availableLevels.size === 0 || availableLevels.has(lvl)
                return (
                  <button key={lvl} onClick={() => isAvail && setAdminLevel(lvl)} disabled={!isAvail}
                    className={clsx('flex-1 py-1 px-0.5 rounded text-[9px] font-medium transition-all text-center cursor-pointer truncate', adminLevel === lvl ? 'bg-spatio-primary text-white font-semibold' : isAvail ? 'text-spatio-muted hover:text-spatio-text hover:bg-black/5 dark:hover:bg-white/10' : 'text-spatio-muted opacity-40 cursor-not-allowed')}>
                    {lvl === 'province' ? t('level_province') : lvl === 'district' ? t('level_district') : t('level_subdistrict')}
                  </button>
                )
              })}
            </div>

            <div className="flex gap-1 justify-between items-center border-t border-spatio-border/20 pt-1.5">
              <span className="text-[9px] text-spatio-muted font-bold pl-1 uppercase tracking-tight">พื้นหลังขาว</span>
              <button
                onClick={() => setShowZeroAreas(!showZeroAreas)}
                className={clsx(
                  'p-1 rounded transition-all flex items-center justify-center cursor-pointer',
                  showZeroAreas
                    ? 'text-spatio-primary bg-spatio-primary/10'
                    : 'text-spatio-muted hover:text-spatio-text hover:bg-black/5 dark:hover:bg-white/5'
                )}
                title={showZeroAreas ? t('exp_hide_ghost') : t('exp_show_ghost')}
              >
                <Paintbrush size={13} />
              </button>
            </div>
          </div>

          {/* รูปแบบการแสดงผล (Visualization Mode) */}
          <div className="spatio-glass flex gap-0.5 p-1 border border-spatio-border/30 w-full">
            <button
              onClick={() => {
                setGeoMode('admin')
                setDisplayMode('choropleth')
              }}
              className={clsx(
                'flex-1 py-1 px-0.5 rounded text-[9px] font-medium transition-all cursor-pointer text-center truncate',
                geoMode === 'admin' && displayMode === 'choropleth'
                  ? 'bg-spatio-primary text-white font-semibold shadow'
                  : 'text-spatio-muted hover:text-spatio-text hover:bg-black/5 dark:hover:bg-white/10'
              )}
              title={t('exp_vis_area')}
            >
              {t('exp_vis_area')}
            </button>

            <button
              disabled={colorMode === 'custom'}
              onClick={() => {
                setGeoMode('admin')
                setDisplayMode('bubble')
              }}
              className={clsx(
                'flex-1 py-1 px-0.5 rounded text-[9px] font-medium transition-all cursor-pointer text-center truncate',
                geoMode === 'admin' && displayMode === 'bubble'
                  ? 'bg-spatio-primary text-white font-semibold shadow'
                  : colorMode === 'custom'
                    ? 'text-spatio-muted opacity-40 cursor-not-allowed bg-spatio-bg/50'
                    : 'text-spatio-muted hover:text-spatio-text hover:bg-black/5 dark:hover:bg-white/10'
              )}
              title={colorMode === 'custom' ? t('exp_vis_bubble_disabled') : t('exp_vis_bubble')}
            >
              {t('exp_vis_bubble')}
            </button>

            {dataKeys.lat && dataKeys.lng && (
              <button
                onClick={() => {
                  setGeoMode('coordinate')
                }}
                className={clsx(
                  'flex-1 py-1 px-0.5 rounded text-[9px] font-medium transition-all cursor-pointer text-center truncate',
                  geoMode === 'coordinate'
                    ? 'bg-spatio-primary text-white font-semibold shadow'
                    : 'text-spatio-muted hover:text-spatio-text hover:bg-black/5 dark:hover:bg-white/10'
                )}
                title={t('exp_vis_coords')}
              >
                {t('exp_vis_coords')}
              </button>
            )}
          </div>

          {dataKeys.color && dataKeys.value && (
            <div className="spatio-glass flex flex-col gap-1 p-1.5 w-full border border-spatio-border/30">
              <span className="block text-[9px] text-spatio-muted font-bold uppercase mb-0.5 px-1 tracking-tight select-none">
                {t('exp_color_mode')}
              </span>
              <div className="flex gap-0.5 w-full">
                <button
                  onClick={() => setColorMode('value')}
                  className={clsx(
                    'flex-1 py-1 px-0.5 rounded text-[9px] font-bold transition-all text-center cursor-pointer truncate',
                    colorMode === 'value'
                      ? 'bg-spatio-primary text-white shadow'
                      : 'text-spatio-muted hover:text-spatio-text hover:bg-black/5 dark:hover:bg-white/10'
                  )}
                  title={t('exp_color_stats')}
                >
                  {t('exp_color_stats')}
                </button>
                <button
                  onClick={() => setColorMode('custom')}
                  className={clsx(
                    'flex-1 py-1 px-0.5 rounded text-[9px] font-bold transition-all text-center cursor-pointer truncate',
                    colorMode === 'custom'
                      ? 'bg-spatio-primary text-white shadow'
                      : 'text-spatio-muted hover:text-spatio-text hover:bg-black/5 dark:hover:bg-white/10'
                  )}
                  title={t('exp_color_custom')}
                >
                  {t('exp_color_custom')}
                </button>
              </div>
            </div>
          )}

          <ScopeFilter />

          {(ingestionMode === 'admin_dynamic' || ingestionMode === 'coord_dynamic') && periods.length > 0 && (
            <div className="spatio-glass p-1.5 border border-spatio-border/30 w-full">
              <div className="flex gap-1">
                <select value={groupingMode} onChange={async (e) => {
                  const newMode = e.target.value as any
                  setGroupingMode(newMode)
                  if (rawRows.length > 0) {
                    setLoading(true, t('ana_running', { defaultValue: 'กำลังคำนวณใหม่...' }))
                    const res = await buildDictionary(rawRows, dataKeys, newMode)
                    setDictionary(res.dictionary); setPeriods(res.periods)
                    setLoading(false)
                  }
                }} className="flex-1 appearance-none rounded-md px-1.5 py-1 bg-spatio-surface border border-spatio-border text-[10px] text-spatio-text focus:outline-none cursor-pointer">
                  <option value="daily">{t('exp_time_daily')}</option>
                  <option value="weekly_epi">{t('exp_time_weekly_epi')}</option>
                  <option value="weekly">{t('exp_time_weekly_iso')}</option>
                  <option value="monthly">{t('exp_time_monthly')}</option>
                  <option value="yearly">{t('exp_time_yearly')}</option>
                </select>
                <button onClick={() => setIsCumulative(!isCumulative)}
                  className={clsx('px-1.5 py-1 rounded-md text-[9px] font-bold border transition-all shrink-0 cursor-pointer text-center', isCumulative ? 'bg-spatio-primary border-spatio-primary text-white' : 'bg-spatio-surface border-spatio-border text-spatio-muted')}>
                  Σ {t('exp_cumulative') === 'สะสม' ? 'สะสม' : 'Cum.'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Zoom Controls with Vertical Slider */}
      <div className={clsx(
        "absolute top-4 right-0 z-[1000] flex flex-col items-center rounded-l-xl overflow-hidden shadow-lg border border-r-0 border-spatio-border/35 spatio-glass py-3 transition-all duration-350 ease-out origin-top-right",
        (isZenMode || isExportMode) ? "opacity-0 translate-x-12 scale-95 pointer-events-none" : "opacity-100 translate-x-0 scale-100",
        periods.length > 0 ? (showChart ? 'bottom-[384px]' : 'bottom-[84px]') : 'bottom-4'
      )}>
        <button
          onClick={() => fitToScope(scope.province, scope.district, scope.subdistrict, scope.region)}
          className="w-9 h-8 flex items-center justify-center text-spatio-text hover:bg-black/5 dark:hover:bg-white/10 border-b border-spatio-border/20 transition-colors shrink-0 cursor-pointer"
          title={t('exp_zoom_reset')}
        >
          <RotateCcw size={13} />
        </button>

        <button
          onClick={() => {
            const map = getMap()
            if (map) {
              const newZoom = Math.min(map.getMaxZoom(), map.getZoom() + 0.2)
              map.setZoom(newZoom, { animate: true })
            }
          }}
          className="w-9 h-8 flex items-center justify-center text-spatio-text hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
          title={t('exp_zoom_in')}
        >
          <Plus size={15} />
        </button>

        <div className="flex-1 w-full flex items-center justify-center px-2 py-3 border-t border-b border-spatio-border/20 min-h-[80px]">
          <input
            type="range"
            min={1}
            max={20}
            step={0.1}
            value={zoomVal}
            onChange={handleZoomSliderChange}
            style={{
              writingMode: 'vertical-lr',
              WebkitAppearance: 'slider-vertical',
              height: '100%',
              width: '12px',
              transform: 'rotate(180deg)',
            }}
            className="accent-slate-500 dark:accent-slate-400 cursor-pointer h-full"
          />
        </div>

        <button
          onClick={() => {
            const map = getMap()
            if (map) {
              const newZoom = Math.max(map.getMinZoom(), map.getZoom() - 0.2)
              map.setZoom(newZoom, { animate: true })
            }
          }}
          className="w-9 h-8 flex items-center justify-center text-spatio-text hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
          title={t('exp_zoom_out')}
        >
          <Minus size={15} />
        </button>
      </div>

      {/* Map Info Panel - shifted slightly inwards to avoid overlapping zoom control */}
      <div className={clsx(
        'absolute right-12 z-[1000] transition-all duration-350 ease-out origin-bottom-right',
        (isZenMode || isExportMode) ? 'opacity-0 translate-x-12 scale-95 pointer-events-none' : 'opacity-100 translate-x-0 scale-100',
        periods.length > 0 ? (showChart ? 'bottom-[384px]' : 'bottom-[84px]') : 'bottom-4'
      )}>
        <MapInfoPanel periodsReady={periods.length > 0} />
      </div>

      <MappingModal />
      <MapComparisonModal isOpen={isCompareOpen} onClose={() => setIsCompareOpen(false)} />
      <AnalysisPanel isOpen={showAnalysisPanel} onClose={() => setShowAnalysisPanel(false)} />
      <NotificationBar />

      {/* Timeline Control */}
      {periods.length > 0 && !isStatic && (
        <div className={clsx(
          "absolute bottom-0 left-0 right-0 z-[1000] spatio-glass border-t border-spatio-border/50 p-3 flex flex-col gap-3 transition-all duration-350 ease-out origin-bottom",
          (isZenMode || isExportMode) ? "opacity-0 translate-y-24 scale-95 pointer-events-none" : "opacity-100 translate-y-0 scale-100"
        )}>
          {/* Collapsible Epidemic Curve Chart */}
          {showChart && (
            <div className="w-full border-b border-spatio-border/50 pb-3 animate-fade-in">
              <EpiChart />
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="min-w-[135px] shrink-0">
              {selectedPeriodObjects.length > 1 ? (
                <>
                  <div className="text-xs font-bold text-blue-500 dark:text-blue-400 leading-tight">
                    {t('exp_cumulative_periods', { count: selectedPeriods.size })}
                  </div>
                  <div className="text-[10px] text-slate-700 dark:text-slate-200 font-medium leading-tight mt-0.5 truncate max-w-[130px]" title={`${selectedPeriodObjects[0].label} — ${selectedPeriodObjects[selectedPeriodObjects.length - 1].label}`}>
                    {selectedPeriodObjects[0].label.replace('สัปดาห์ที่ ', 'W').split(' ')[0]} — {selectedPeriodObjects[selectedPeriodObjects.length - 1].label.replace('สัปดาห์ที่ ', 'W').split(' ')[0]}
                  </div>
                  <div className="text-[9px] text-spatio-muted mt-0.5">{t('exp_custom_selection')}</div>
                </>
              ) : (
                <div className="flex flex-col gap-0.5">
                  <select
                    value={currentStep}
                    onChange={(e) => {
                      setIsPlaying(false)
                      clearPeriodSelection()
                      setCurrentStep(Number(e.target.value))
                    }}
                    className="w-full bg-spatio-surface border-none text-sm font-semibold text-spatio-text focus:outline-none cursor-pointer hover:text-spatio-primary transition-colors pr-1 truncate font-sans"
                  >
                    {periods.map((p, idx) => {
                      const isDisabled = idx < clampedStart || idx > clampedEnd
                      return (
                        <option key={p.key} value={idx} disabled={isDisabled} className="bg-white dark:bg-slate-900 text-black dark:text-white">
                          {isCumulative ? '∑ ' : ''}{p.label}
                        </option>
                      )
                    })}
                  </select>
                  {(groupingMode === 'weekly' || groupingMode === 'weekly_epi') && period && (
                    <div className="text-[10px] text-blue-500 dark:text-blue-400 leading-none pl-1">
                      {getWeekRange(period.date, groupingMode === 'weekly_epi' ? 'epi' : 'iso')}
                    </div>
                  )}
                  <div className="text-[9px] text-spatio-muted pl-1">
                    {currentStep + 1} / {periods.length}
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => { clearPeriodSelection(); setCurrentStep(clampedStart); }} className="text-spatio-muted hover:text-spatio-text" title={t('exp_zoom_reset')}><SkipBack size={14} /></button>
            <button onClick={() => { clearPeriodSelection(); useAppStore.getState().prevStep(); }} className="text-spatio-muted hover:text-spatio-text"><ChevronLeft size={16} /></button>
            <button onClick={() => {
              if (!isPlaying) clearPeriodSelection();
              setIsPlaying(!isPlaying);
            }} className="w-8 h-8 rounded-full bg-spatio-primary hover:bg-blue-500 dark:hover:bg-blue-400 flex items-center justify-center animate-pulse-subtle">
              {isPlaying ? <Pause size={14} className="text-white" /> : <Play size={14} className="text-white ml-0.5" />}
            </button>
            <button onClick={() => { clearPeriodSelection(); useAppStore.getState().nextStep(); }} className="text-spatio-muted hover:text-spatio-text"><ChevronRight size={16} /></button>
            <button onClick={() => { clearPeriodSelection(); setCurrentStep(clampedEnd); }} className="text-spatio-muted hover:text-spatio-text"><SkipForward size={14} /></button>

            {/* Start Limit Dropdown */}
            <select
              value={timelineStartKey || 'all'}
              onChange={(e) => {
                const val = e.target.value
                setTimelineStartKey(val === 'all' ? null : val)
              }}
              className="rounded px-2 py-0.5 bg-spatio-surface border border-spatio-border text-[11px] text-spatio-text focus:outline-none cursor-pointer max-w-[100px] text-ellipsis whitespace-nowrap overflow-hidden"
              title={t('exp_time_range_start')}
            >
              <option value="all">— {t('exp_time_start_all')} —</option>
              {periods.map((p, idx) => {
                const isDisabled = clampedEnd !== -1 && idx > clampedEnd
                return (
                  <option key={p.key} value={p.key} disabled={isDisabled}>
                    {p.label}
                  </option>
                )
              })}
            </select>

            <input type="range" min={clampedStart} max={clampedEnd} value={currentStep} onChange={e => { setIsPlaying(false); clearPeriodSelection(); setCurrentStep(Number(e.target.value)) }} className="flex-1 accent-spatio-primary cursor-pointer" />

            {/* End Limit Dropdown */}
            <select
              value={timelineEndKey || 'all'}
              onChange={(e) => {
                const val = e.target.value
                setTimelineEndKey(val === 'all' ? null : val)
              }}
              className="rounded px-2 py-0.5 bg-spatio-surface border border-spatio-border text-[11px] text-spatio-text focus:outline-none cursor-pointer max-w-[100px] text-ellipsis whitespace-nowrap overflow-hidden"
              title={t('exp_time_range_end')}
            >
              <option value="all">— {t('exp_time_end_all')} —</option>
              {periods.map((p, idx) => {
                const isDisabled = clampedStart !== -1 && idx < clampedStart
                return (
                  <option key={p.key} value={p.key} disabled={isDisabled}>
                    {p.label}
                  </option>
                )
              })}
            </select>

            {/* Reset Range Button */}
            {(timelineStartKey || timelineEndKey) && (
              <button
                onClick={() => {
                  setTimelineStartKey(null)
                  setTimelineEndKey(null)
                }}
                className="text-xs text-red-500 hover:text-red-400 font-bold cursor-pointer whitespace-nowrap p-1 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors"
                title={t('exp_time_range_reset')}
              >
                ✕
              </button>
            )}

            {/* Deselect Button */}
            {selectedPeriods.size > 0 && (
              <button
                onClick={clearPeriodSelection}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-500/30 bg-red-100 dark:bg-red-950/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 transition-all flex items-center gap-1 shrink-0 active:scale-95 animate-fade-in"
              >
                <span>✕</span>
                <span>{t('exp_cancel_selection', { count: selectedPeriods.size })}</span>
              </button>
            )}

            {/* Toggle Graph Button */}
            <button
              onClick={() => setShowChart(!showChart)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shrink-0",
                showChart
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-spatio-surface border-spatio-border text-spatio-text hover:bg-black/5 dark:hover:bg-white/10"
              )}
            >
              <span>📊</span>
              <span>{t('exp_epi_curve')}</span>
            </button>

            {/* Compare Map Button */}
            <button
              onClick={() => setIsCompareOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-spatio-surface border-spatio-border text-spatio-text hover:bg-black/5 dark:hover:bg-white/10 transition-all flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer"
            >
              <span>🗺️</span>
              <span>{t('exp_compare_map')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function NotificationBar() {
  const { notification, clearNotification } = useAppStore()
  if (!notification) return null
  // Only show critical error popups to avoid blocking the map view as requested
  if (notification.type !== 'error') return null
  const colors: any = {
    error: 'bg-red-50 dark:bg-red-500/20 border-red-200 dark:border-red-500/40 text-red-800 dark:text-red-300',
  }
  return (
    <div className={clsx('absolute top-16 left-1/2 -translate-x-1/2 z-[1500] border rounded-xl px-4 py-2.5 text-sm flex items-center gap-3 shadow-xl cursor-pointer animate-slide-up', colors.error)} onClick={clearNotification}>
      {notification.msg} <span className="text-xs opacity-60">✕</span>
    </div>
  )
}
