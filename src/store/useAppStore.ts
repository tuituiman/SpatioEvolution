import { logger } from '../utils/logger'
import { create } from 'zustand'
import { getPeriodLabel, type DateMode } from '../data/dateParser'
import { calculateGlobalStats, buildDictionary, buildStaticDictionary, buildWideDictionary, clearCumulativeCache } from '../data/aggregator'
import { calcBreaks } from '../map/mapController'
import { clearScopeCheckCache } from '../data/healthZones'
import {
  saveDataset,
  loadAllDatasets,
  loadAllUIState,
  saveUIState,
  clearAllPersistence,
  clearAllDatasets as clearAllDatasetsInDB,
  estimateStorageUsage,
  deleteDataset,
} from '../data/persistence'

// ── Debounce utility (ไม่ต้องพึ่ง lodash) ──
function debounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null
  return ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, delay)
  }) as T
}

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────
export type AdminLevel = 'province' | 'district' | 'subdistrict'
export type DisplayMode = 'choropleth' | 'bubble' | 'heatmap' | 'points'
export type IngestionMode = 'admin_static' | 'admin_dynamic' | 'coord_static' | 'coord_dynamic'
export type ColorPalette = 'YlOrRd' | 'Blues' | 'Greens' | 'Reds' | 'YlGnBu' | 'Spectral' | 'GnYlRd' | 'Spectrum' | 'Custom'
export interface CanvasWidget {
  id: string
  type: 'map' | 'chart' | 'title' | 'legend' | 'logo'
  x: number // percent
  y: number // percent
  w: number // percent
  h: number // percent
  zIndex: number
}

export interface CanvasSettings {
  aspectRatio: '16:9' | '4:3' | 'A4-landscape'
  theme: 'dark' | 'light'
}

// ── Widget-specific visual configs (export-only styling) ──
export interface MapWidgetConfig {
  type: 'map'
  showLabelCallouts: boolean
  labelFontSize: number
  labelColor: string
  bgColor?: string
  bgOpacity?: number
  borderColor?: string
  borderWidth?: number
  borderRadius?: number
  boxShadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  isLocked?: boolean
  lockAspectRatio?: boolean
}

export interface ChartWidgetConfig {
  type: 'chart'
  chartType: 'bar' | 'line' | 'area'
  barColor: string
  barActiveColor: string
  peakColor: string
  showGrid: boolean
  showMaxMarker: boolean
  showNowMarker: boolean
  xAxisLabel: string
  yAxisLabel: string
  fontSize: number
  paddingLeft?: number
  paddingBottom?: number
  paddingTop?: number
  gridColor?: string
  borderColor?: string
  borderWidth?: number
  bgColor?: string
  bgOpacity?: number
  textColor?: string
  chartTitle?: string
  chartTitleColor?: string
  chartTitleFontSize?: number
}

export interface TitleWidgetConfig {
  type: 'title'
  titleFontSize: number
  titleColor: string
  titleFontWeight: 'normal' | 'bold'
  subtitleFontSize: number
  subtitleColor: string
  subtitleFontWeight: 'normal' | 'bold'
  subtitleAlign: 'left' | 'center' | 'right'
  bgColor: string
  bgOpacity: number
  borderColor: string
  borderWidth: number
  borderRadius: number
  showLogo: boolean
  showPeriodMeta: boolean
  align: 'left' | 'center' | 'right'
}

export interface LegendWidgetConfig {
  type: 'legend'
  orientation: 'vertical' | 'horizontal'
  swatch: 'square' | 'circle' | 'line'
  customTitle: string
  titleFontSize?: number
  titleColor?: string
  titleFontWeight?: 'normal' | 'bold'
  labelFontSize: number
  labelColor: string
  customLabels?: Record<number, string>
  customBands?: Array<{ color: string; label: string }>
  bgColor: string
  bgOpacity: number
  borderColor?: string
  borderWidth?: number
  borderRadius?: number
}

export interface LogoWidgetConfig {
  type: 'logo'
  opacity: number
  borderColor?: string
  borderWidth?: number
  borderRadius?: number
}

export type WidgetConfig = MapWidgetConfig | ChartWidgetConfig | TitleWidgetConfig | LegendWidgetConfig | LogoWidgetConfig

export const DEFAULT_WIDGET_CONFIGS: Record<CanvasWidget['type'], WidgetConfig> = {
  map: {
    type: 'map',
    showLabelCallouts: true,
    labelFontSize: 10,
    labelColor: '#ffffff',
    bgColor: '#0f172a',
    bgOpacity: 0,
    borderColor: '#334155',
    borderWidth: 0,
    borderRadius: 12,
    boxShadow: 'none',
    isLocked: true,
    lockAspectRatio: false,
  } as MapWidgetConfig,
  chart: {
    type: 'chart',
    chartType: 'bar',
    barColor: '#3b82f6',
    barActiveColor: '#f59e0b',
    peakColor: '#ef4444',
    showGrid: true,
    showMaxMarker: true,
    showNowMarker: true,
    xAxisLabel: '',
    yAxisLabel: 'จำนวนราย',
    fontSize: 9,
    paddingLeft: 60,
    paddingBottom: 80,
  } as ChartWidgetConfig,
  title: {
    type: 'title',
    titleFontSize: 13,
    titleColor: '#f1f5f9',
    titleFontWeight: 'bold',
    subtitleFontSize: 9,
    subtitleColor: '#94a3b8',
    bgColor: '#0f172a',
    bgOpacity: 0,
    borderColor: '#334155',
    borderWidth: 0,
    borderRadius: 8,
    showLogo: false,
    showPeriodMeta: true,
    align: 'left',
  } as TitleWidgetConfig,
  legend: {
    type: 'legend',
    orientation: 'vertical',
    customTitle: 'คำอธิบายสัญลักษณ์',
    labelFontSize: 10,
    labelColor: '#e2e8f0',
    bgColor: '#0f172a',
    bgOpacity: 0.85,
    swatch: 'square',
  } as LegendWidgetConfig,
  logo: {
    type: 'logo',
    objectFit: 'contain',
    opacity: 1,
    bgColor: 'transparent',
    bgOpacity: 0,
    padding: 8,
    borderRadius: 8,
  } as LogoWidgetConfig,
}

import type {
  DataKeys, Scope, PeriodBucket, SubdistrictCounts, DistrictData, ProvinceData,
  DateDictionary, DatasetMeta, GlobalStats, StatsRecord
} from '../types'

export type {
  DataKeys, Scope, PeriodBucket, SubdistrictCounts, DistrictData, ProvinceData,
  DateDictionary, DatasetMeta, GlobalStats, StatsRecord
}

// ──────────────────────────────────────────
// Store Definition
// ──────────────────────────────────────────
export interface AppState {
  datasets: DatasetMeta[]
  activeDatasetId: string | null
  rawRows: Record<string, unknown>[]
  dataKeys: DataKeys
  ingestionMode: IngestionMode
  dictionary: DateDictionary
  periods: PeriodBucket[]
  groupingMode: DateMode
  currentStep: number
  timelineStartKey: string | null
  timelineEndKey: string | null
  isPlaying: boolean
  playSpeed: number
  adminLevel: AdminLevel
  scope: Scope
  displayMode: DisplayMode
  palette: ColorPalette
  isCumulative: boolean
  scaleStatsToRange: boolean
  cropChartToRange: boolean
  showZeroAreas: boolean
  mapReady: boolean
  isMappingOpen: boolean
  isWidgetInspectorOpen: boolean
  globalStats: GlobalStats | null
  globalBreaks: number[]
  isBreaksCustomized: boolean
  breaksStart: number
  showLegendZeroRow: boolean
  setGlobalBreaks: (breaks: number[], isCustom?: boolean) => void
  numClasses: number
  customColors: string[]
  setNumClasses: (n: number) => void
  setCustomColors: (colors: string[]) => void
  isLoading: boolean
  loadingMsg: string
  notification: { type: 'info' | 'success' | 'error' | 'warning'; msg: string } | null
  selectedPeriods: Set<string>
  lastClickedPeriod: string | null
  colorMode: 'value' | 'custom'
  mappingModalTab: 'upload' | 'mapping'
  geoMode: 'admin' | 'coordinate'
  pointStyle: 'cluster' | 'heatmap' | 'proportional'
  bubbleScale: number
  pointRadiusBuffer: number
  baseMapStyle: 'dark' | 'street' | 'satellite'
  showBoundaries: boolean
  showBaseMap: boolean
  showBorders: boolean
  isZenMode: boolean
  theme: 'dark' | 'light' | 'system'
  language: 'th' | 'en'
  yearFormat: 'be' | 'ce'
  setYearFormat: (v: 'be' | 'ce') => void
  exportTitle: string
  exportSubtitle: string
  watermarkPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  legendPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  logoUrl: string | null
  logoPlacement: 'watermark' | 'center-bg'
  logoOpacity: number
  annotations: { id: string; text: string; x: number; y: number; color: string; fontSize: number }[]
  arrows: { id: string; x1: number; y1: number; x2: number; y2: number; color: string; strokeWidth: number }[]
  includeEpiCurve: boolean

  // ── Persistence Settings ──
  retentionDays: number | null  // null = ไม่หมดอายุ
  storageUsageBytes: number

  // ── Automatic Label & Callout Customization ──
  mapLabelSource: 'none' | 'name' | 'value' | 'name-value' | 'custom-column'
  mapLabelColumn: string
  mapLabelLimit: 'all' | 'top-5' | 'top-10' | 'top-20' | 'threshold'
  mapLabelThreshold: number
  mapLabelNameLevel: 'default' | 'province' | 'district'
  labelCallouts: Record<string, {
    id: string
    areaName: string
    value: number
    dx: number
    dy: number
    isCustomized: boolean
    style: Partial<{
      fontSize: number
      color: string
      bgColor: string
      bgOpacity: number
      borderColor: string
      borderWidth: number
      borderStyle: 'solid' | 'dashed' | 'dotted'
      borderRadius: number
      lineWidth: number
      lineColor: string
      lineStyle: 'solid' | 'dashed' | 'dotted'
      markerType: 'dot' | 'arrow' | 'none'
      textStrokeColor: string
      textStrokeWidth: number
    }>
  }>
  globalLabelStyle: {
    fontSize: number
    color: string
    bgColor: string
    bgOpacity: number
    borderColor: string
    borderWidth: number
    borderStyle: 'solid' | 'dashed' | 'dotted'
    borderRadius: number
    lineWidth: number
    lineColor: string
    lineStyle: 'solid' | 'dashed' | 'dotted'
    markerType: 'dot' | 'arrow' | 'none'
    textStrokeColor: string
    textStrokeWidth: number
  }
  selectedLabelId: string | null
  showLocationPrefix: boolean

  // ── Canvas Artboard Compositor States ──
  canvasWidgets: CanvasWidget[]
  canvasSettings: CanvasSettings
  selectedWidgetId: string | null
  widgetConfigs: Record<string, WidgetConfig>
  mapVersion: number
}

export interface AppActions {
  setRawRows: (rows: Record<string, unknown>[], meta: Omit<DatasetMeta, 'id'> & { id?: string; ingestionMode?: IngestionMode }) => void
  setDataKeys: (keys: Partial<DataKeys>) => void
  setDictionary: (dict: DateDictionary) => void
  setPeriods: (p: PeriodBucket[]) => void
  clearStats: () => void
  setGroupingMode: (m: DateMode) => void
  setCurrentStep: (s: number) => void
  setIsPlaying: (v: boolean) => void
  setTimelineStartKey: (key: string | null) => void
  setTimelineEndKey: (key: string | null) => void
  nextStep: () => void
  prevStep: () => void
  setAdminLevel: (l: AdminLevel) => void
  setScope: (s: Partial<Scope>) => void
  setDisplayMode: (m: DisplayMode) => void
  setPalette: (p: ColorPalette) => void
  setIsCumulative: (v: boolean) => void
  setScaleStatsToRange: (v: boolean) => void
  setCropChartToRange: (v: boolean) => void
  setIngestionMode: (m: IngestionMode) => void
  setIsMappingOpen: (v: boolean) => void
  setMapReady: (v: boolean) => void
  setLoading: (loading: boolean, msg?: string) => void
  notify: (type: 'info' | 'success' | 'error' | 'warning', msg: string) => void
  clearNotification: () => void
  syncStats: () => void
  resetBreaks: () => void
  setBreaksStart: (val: number) => void
  setShowLegendZeroRow: (show: boolean) => void
  getCurrentPeriodData: () => Record<string, ProvinceData> | null
  togglePeriodSelection: (key: string, isShift: boolean) => void
  clearPeriodSelection: () => void
  setSelectedPeriods: (keys: Set<string>) => void
  setColorMode: (mode: 'value' | 'custom') => void
  setMappingModalTab: (tab: 'upload' | 'mapping') => void
  setGeoMode: (mode: 'admin' | 'coordinate') => void
  setPointStyle: (style: 'cluster' | 'heatmap' | 'proportional') => void
  setBubbleScale: (scale: number) => void
  setPointRadiusBuffer: (radius: number) => void
  setBaseMapStyle: (style: 'dark' | 'street' | 'satellite') => void
  setShowBoundaries: (show: boolean) => void
  setShowBaseMap: (show: boolean) => void
  setShowBorders: (show: boolean) => void
  setShowZeroAreas: (show: boolean) => void
  setIsZenMode: (v: boolean) => void
  setExportTitle: (t: string) => void
  setExportSubtitle: (s: string) => void
  setWatermarkPosition: (pos: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => void
  setLegendPosition: (pos: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => void
  setLogoUrl: (url: string | null) => void
  setLogoPlacement: (placement: 'watermark' | 'center-bg') => void
  setLogoOpacity: (opacity: number) => void
  setAnnotations: (ann: { id: string; text: string; x: number; y: number; color: string; fontSize: number }[]) => void
  setArrows: (arr: { id: string; x1: number; y1: number; x2: number; y2: number; color: string; strokeWidth: number }[]) => void
  setIncludeEpiCurve: (v: boolean) => void
  setRetentionDays: (days: number | null) => void
  setTheme: (theme: 'dark' | 'light' | 'system') => void
  setLanguage: (lang: 'th' | 'en') => void
  setYearFormat: (v: 'be' | 'ce') => void
  hydrateFromDB: () => Promise<void>
  clearAllData: () => Promise<void>
  clearAllDatasets: () => Promise<void>
  refreshStorageUsage: () => Promise<void>
  loadDatasetById: (id: string) => Promise<void>
  deleteDatasetById: (id: string) => Promise<void>
  setMapLabelSource: (source: 'none' | 'name' | 'value' | 'name-value' | 'custom-column') => void
  setMapLabelColumn: (col: string) => void
  setMapLabelLimit: (limit: 'all' | 'top-5' | 'top-10' | 'top-20' | 'threshold') => void
  setMapLabelThreshold: (val: number) => void
  setMapLabelNameLevel: (level: 'default' | 'province' | 'district') => void
  updateLabelOffset: (id: string, dx: number, dy: number) => void
  updateLabelStyle: (id: string, style: Partial<{
    fontSize: number
    color: string
    bgColor: string
    bgOpacity: number
    borderColor: string
    borderWidth: number
    borderStyle: 'solid' | 'dashed' | 'dotted'
    borderRadius: number
    lineWidth: number
    lineColor: string
    lineStyle: 'solid' | 'dashed' | 'dotted'
    markerType: 'dot' | 'arrow' | 'none'
    textStrokeColor: string
    textStrokeWidth: number
  }>) => void
  updateGlobalLabelStyle: (style: Partial<{
    fontSize: number
    color: string
    bgColor: string
    bgOpacity: number
    borderColor: string
    borderWidth: number
    borderStyle: 'solid' | 'dashed' | 'dotted'
    borderRadius: number
    lineWidth: number
    lineColor: string
    lineStyle: 'solid' | 'dashed' | 'dotted'
    markerType: 'dot' | 'arrow' | 'none'
    textStrokeColor: string
    textStrokeWidth: number
  }>) => void
  resetLabelOffset: (id: string) => void
  setSelectedLabelId: (id: string | null) => void
  setShowLocationPrefix: (show: boolean) => void
  addCanvasWidget: (type: 'map' | 'chart' | 'title' | 'legend' | 'logo') => void
  deleteCanvasWidget: (id: string) => void
  updateWidgetGeometry: (id: string, x: number, y: number, w: number, h: number) => void
  setSelectedWidgetId: (id: string | null) => void
  setIsWidgetInspectorOpen: (isOpen: boolean) => void
  setCanvasSettings: (settings: Partial<{ aspectRatio: '16:9' | '4:3' | 'A4-landscape'; theme: 'dark' | 'light' }>) => void
  loadCanvasTemplate: (template: 'blank' | 'standard' | 'split') => void
  bringWidgetToFront: (id: string) => void
  sendWidgetToBack: (id: string) => void
  bringWidgetForward: (id: string) => void
  sendWidgetBackward: (id: string) => void
  setWidgetConfig: (id: string, patch: Partial<WidgetConfig>) => void
  getWidgetConfig: <T extends WidgetConfig>(id: string) => T | null
  incrementMapVersion: () => void
}

const reorderWidgets = (widgets: CanvasWidget[], id: string, action: 'front' | 'back' | 'forward' | 'backward'): CanvasWidget[] => {
  const sorted = [...widgets].sort((a, b) => a.zIndex - b.zIndex)
  const idx = sorted.findIndex(w => w.id === id)
  if (idx === -1) return widgets

  if (action === 'front') {
    const [target] = sorted.splice(idx, 1)
    sorted.push(target)
  } else if (action === 'back') {
    const [target] = sorted.splice(idx, 1)
    sorted.unshift(target)
  } else if (action === 'forward') {
    if (idx < sorted.length - 1) {
      const temp = sorted[idx]
      sorted[idx] = sorted[idx + 1]
      sorted[idx + 1] = temp
    }
  } else if (action === 'backward') {
    if (idx > 0) {
      const temp = sorted[idx]
      sorted[idx] = sorted[idx - 1]
      sorted[idx - 1] = temp
    }
  }

  return sorted.map((w, index) => ({ ...w, zIndex: index + 1 }))
}

const DEFAULT_KEYS: DataKeys = {
  date: '', province: '', district: '', subdistrict: '',
  lat: '', lng: '', value: '', color: ''
}

const DEFAULT_SCOPE: Scope = {
  region: 'all', province: 'all', district: 'all', subdistrict: 'all'
}

// Debounced syncStats — created once at module level (shared across all store calls)
// ป้องกัน calculateGlobalStats() ถูกเรียกซ้ำเมื่อ user เปลี่ยน setting หลายอย่างติดต่อกัน
let _debouncedSyncStats: (() => void) | null = null
function getDebouncedSyncStats(syncFn: () => void) {
  if (!_debouncedSyncStats) {
    _debouncedSyncStats = debounce(syncFn, 120)
  }
  return _debouncedSyncStats
}

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  datasets: [],
  activeDatasetId: null,
  rawRows: [],
  dataKeys: DEFAULT_KEYS,
  ingestionMode: 'admin_dynamic',
  dictionary: {},
  periods: [],
  groupingMode: 'weekly',
  currentStep: 0,
  timelineStartKey: null,
  timelineEndKey: null,
  isPlaying: false,
  playSpeed: 800,
  adminLevel: 'district',
  scope: DEFAULT_SCOPE,
  displayMode: 'choropleth',
  palette: 'YlOrRd',
  numClasses: 5,
  customColors: ['#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026'],
  isCumulative: false,
  scaleStatsToRange: false,
  cropChartToRange: false,
  showZeroAreas: true,
  mapReady: false,
  mapVersion: 0,
  isMappingOpen: false,
  isWidgetInspectorOpen: false,
  theme: 'dark',
  language: 'th',
  yearFormat: 'ce',
  globalStats: null,
  globalBreaks: [],
  isBreaksCustomized: false,
  breaksStart: 1,
  showLegendZeroRow: false,
  isLoading: false,
  loadingMsg: '',
  notification: null,
  selectedPeriods: new Set<string>(),
  lastClickedPeriod: null,
  colorMode: 'value',
  mappingModalTab: 'upload',
  geoMode: 'admin',
  pointStyle: 'cluster',
  bubbleScale: 1.0,
  pointRadiusBuffer: 0,
  baseMapStyle: 'dark',
  showBoundaries: true,
  showBaseMap: true,
  showBorders: true,
  isZenMode: false,
  exportTitle: 'สรุปสถานการณ์การระบาดสะสม',
  exportSubtitle: '',
  watermarkPosition: 'top-left',
  legendPosition: 'bottom-right',
  logoUrl: null,
  logoPlacement: 'watermark',
  logoOpacity: 0.15,
  annotations: [],
  arrows: [],
  includeEpiCurve: false,
  retentionDays: null,
  storageUsageBytes: 0,
  mapLabelSource: 'none',
  mapLabelColumn: '',
  mapLabelLimit: 'all',
  mapLabelThreshold: 1,
  mapLabelNameLevel: 'default',
  labelCallouts: {},
  globalLabelStyle: {
    fontSize: 10,
    color: '#ffffff',
    bgColor: '#0f172a',
    bgOpacity: 0.85,
    borderColor: '#475569',
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: 4,
    lineWidth: 1.5,
    lineColor: '#f1f5f9',
    lineStyle: 'dashed',
    markerType: 'dot',
    textStrokeColor: '#000000',
    textStrokeWidth: 1.5
  },
  selectedLabelId: null,
  showLocationPrefix: true,
  canvasWidgets: [],
  canvasSettings: {
    aspectRatio: '16:9',
    theme: 'dark'
  },
  selectedWidgetId: null,
  widgetConfigs: {},


  syncStats: () => {
    const {
      dictionary, periods, adminLevel, scope, isCumulative, selectedPeriods, geoMode, rawRows, dataKeys, groupingMode,
      scaleStatsToRange, timelineStartKey, timelineEndKey
    } = get()
    if (!periods.length || Object.keys(dictionary).length === 0) return

    let periodsToCalculate = periods
    if (selectedPeriods && selectedPeriods.size > 0) {
      periodsToCalculate = periods.filter(p => selectedPeriods.has(p.key))
    } else if (scaleStatsToRange) {
      const startIdx = timelineStartKey ? periods.findIndex(p => p.key === timelineStartKey) : 0
      const endIdx = timelineEndKey ? periods.findIndex(p => p.key === timelineEndKey) : periods.length - 1
      const clampedStart = startIdx === -1 ? 0 : startIdx
      const clampedEnd = endIdx === -1 ? periods.length - 1 : endIdx
      periodsToCalculate = periods.slice(clampedStart, clampedEnd + 1)
    }

    if (periodsToCalculate.length === 0) {
      set({ globalStats: null, globalBreaks: [] })
      return
    }

    const results = calculateGlobalStats(
      dictionary,
      periodsToCalculate,
      adminLevel,
      scope,
      isCumulative,
      geoMode,
      rawRows,
      dataKeys,
      groupingMode
    )

    if (results) {
      const nextState: Partial<AppState> = {
        globalStats: {
          max: results.max,
          min: results.min,
          mean: results.mean,
          median: results.median,
          p25: results.p25,
          p75: results.p75,
          count: results.count,
          sum: results.sum,
          peak: results.peak
        }
      }
      if (!get().isBreaksCustomized) {
        nextState.globalBreaks = calcBreaks(results.allValues, get().numClasses)
      }
      set(nextState)
    } else {
      set(s => ({
        globalStats: null,
        globalBreaks: s.isBreaksCustomized ? s.globalBreaks : []
      }))
    }
  },

  setRawRows: (rows, meta) => {
    clearScopeCheckCache()
    const id = meta.id || crypto.randomUUID()
    const loadedAt = new Date()
    const currentIngestionMode = meta.ingestionMode || get().ingestionMode
    const newMeta: DatasetMeta = {
      id,
      fileName: meta.fileName,
      rowCount: meta.rowCount,
      keys: meta.keys,
      loadedAt,
      fileBytes: (meta as any).fileBytes,
      sheetNames: (meta as any).sheetNames,
      selectedSheet: (meta as any).selectedSheet,
    }
    set(s => {
      const idx = s.datasets.findIndex(d => d.id === id)
      let next = [...s.datasets]
      if (idx !== -1) {
        next[idx] = newMeta
      } else {
        next.push(newMeta)
      }
      return {
        rawRows: rows,
        datasets: next,
        activeDatasetId: id,
        ingestionMode: currentIngestionMode,
        isBreaksCustomized: false,
        breaksStart: 1
      }
    })
    // Persist to IndexedDB (fire and forget)
    const { retentionDays } = get()
    saveDataset(id, rows, {
      fileName: meta.fileName,
      rowCount: meta.rowCount,
      keys: meta.keys,
      ingestionMode: currentIngestionMode,
      loadedAt,
      fileBytes: (meta as any).fileBytes,
      sheetNames: (meta as any).sheetNames,
      selectedSheet: (meta as any).selectedSheet,
    }, retentionDays).catch(logger.warn)
    saveUIState('activeDatasetId', id).catch(logger.warn)
    get().refreshStorageUsage()
  },

  setDataKeys: (keys) => set(s => ({ dataKeys: { ...s.dataKeys, ...keys } })),
  setDictionary: (dict) => set({ dictionary: dict }),
  setPeriods: (p) => {
    set({ periods: p, currentStep: 0, timelineStartKey: null, timelineEndKey: null })
    get().syncStats()
  },
  clearStats: () => set({ globalStats: null, globalBreaks: [] }),
  setGlobalBreaks: (breaks, isCustom = true) => set({ globalBreaks: breaks, isBreaksCustomized: isCustom }),
  resetBreaks: () => {
    set({ isBreaksCustomized: false, breaksStart: 1 })
    get().syncStats()
  },
  setBreaksStart: (val) => set({ breaksStart: val, isBreaksCustomized: true }),
  setShowLegendZeroRow: (show) => set({ showLegendZeroRow: show }),
  setNumClasses: (n) => {
    const isCustom = get().isBreaksCustomized
    if (isCustom) {
      const oldBreaks = get().globalBreaks
      const targetLength = n - 1
      let nextBreaks = [...oldBreaks]

      if (targetLength < nextBreaks.length) {
        nextBreaks = nextBreaks.slice(0, targetLength)
      } else if (targetLength > nextBreaks.length) {
        let lastVal = nextBreaks.length > 0 ? nextBreaks[nextBreaks.length - 1] : 10
        let step = 10
        if (oldBreaks.length >= 2) {
          step = oldBreaks[oldBreaks.length - 1] - oldBreaks[oldBreaks.length - 2]
          if (step <= 0) step = 10
        } else if (oldBreaks.length === 1) {
          step = oldBreaks[0] > 0 ? oldBreaks[0] : 10
        }

        let decimalPlaces = 0
        oldBreaks.forEach(v => {
          const str = v.toString()
          const dotIdx = str.indexOf('.')
          if (dotIdx !== -1) {
            const dec = str.length - dotIdx - 1
            if (dec > decimalPlaces) decimalPlaces = dec
          }
        })

        while (nextBreaks.length < targetLength) {
          lastVal = lastVal + step
          const rounded = parseFloat(lastVal.toFixed(decimalPlaces))
          nextBreaks.push(rounded)
        }
      }

      set({ numClasses: n, globalBreaks: nextBreaks })
      get().syncStats()
    } else {
      set({ numClasses: n, isBreaksCustomized: false })
      get().syncStats()
    }
  },
  setCustomColors: (colors) => set({ customColors: colors }),

  setGroupingMode: (m) => { set({ groupingMode: m }); saveUIState('groupingMode', m).catch(() => { }) },
  setCurrentStep: (s) => set({ currentStep: s }),
  setIsPlaying: (v) => set({ isPlaying: v }),

  setTimelineStartKey: (key) => {
    set(s => {
      const startIdx = key ? s.periods.findIndex(p => p.key === key) : 0
      const clampedStart = startIdx === -1 ? 0 : startIdx
      const endIdx = s.timelineEndKey ? s.periods.findIndex(p => p.key === s.timelineEndKey) : s.periods.length - 1
      const clampedEnd = endIdx === -1 ? s.periods.length - 1 : endIdx

      let nextStep = s.currentStep
      if (nextStep < clampedStart) nextStep = clampedStart
      if (nextStep > clampedEnd) nextStep = clampedEnd

      return { timelineStartKey: key, currentStep: nextStep }
    })
    get().syncStats()
  },

  setTimelineEndKey: (key) => {
    set(s => {
      const startIdx = s.timelineStartKey ? s.periods.findIndex(p => p.key === s.timelineStartKey) : 0
      const clampedStart = startIdx === -1 ? 0 : startIdx
      const endIdx = key ? s.periods.findIndex(p => p.key === key) : s.periods.length - 1
      const clampedEnd = endIdx === -1 ? s.periods.length - 1 : endIdx

      let nextStep = s.currentStep
      if (nextStep < clampedStart) nextStep = clampedStart
      if (nextStep > clampedEnd) nextStep = clampedEnd

      return { timelineEndKey: key, currentStep: nextStep }
    })
    get().syncStats()
  },

  nextStep: () => set(s => {
    const startIdx = s.timelineStartKey ? s.periods.findIndex(p => p.key === s.timelineStartKey) : 0
    const clampedStart = startIdx === -1 ? 0 : startIdx
    const endIdx = s.timelineEndKey ? s.periods.findIndex(p => p.key === s.timelineEndKey) : s.periods.length - 1
    const clampedEnd = endIdx === -1 ? s.periods.length - 1 : endIdx

    const next = s.currentStep + 1
    if (next <= clampedEnd && next >= clampedStart) return { currentStep: next }
    return { currentStep: clampedStart }
  }),
  prevStep: () => set(s => {
    const startIdx = s.timelineStartKey ? s.periods.findIndex(p => p.key === s.timelineStartKey) : 0
    const clampedStart = startIdx === -1 ? 0 : startIdx
    return { currentStep: Math.max(clampedStart, s.currentStep - 1) }
  }),

  setAdminLevel: (l) => {
    set({ adminLevel: l, labelCallouts: {} })
    saveUIState('adminLevel', l).catch(() => { })
    getDebouncedSyncStats(get().syncStats)()
  },
  setScope: (sc) => {
    set(s => ({ scope: { ...s.scope, ...sc }, labelCallouts: {} }))
    getDebouncedSyncStats(get().syncStats)()
  },
  setDisplayMode: (m) => { set({ displayMode: m }); saveUIState('displayMode', m).catch(() => { }) },
  setPalette: (p) => { set({ palette: p }); saveUIState('palette', p).catch(() => { }) },
  setIsCumulative: (v) => {
    set({ isCumulative: v })
    saveUIState('isCumulative', v).catch(() => { })
    getDebouncedSyncStats(get().syncStats)()
  },
  setScaleStatsToRange: (v) => {
    set({ scaleStatsToRange: v })
    saveUIState('scaleStatsToRange', v).catch(() => { })
    getDebouncedSyncStats(get().syncStats)()
  },
  setCropChartToRange: (v) => {
    set({ cropChartToRange: v })
    saveUIState('cropChartToRange', v).catch(() => { })
  },
  setIngestionMode: (m) => set({ ingestionMode: m }),
  setIsMappingOpen: (v) => set({ isMappingOpen: v }),
  setMapReady: (v) => set({ mapReady: v }),
  setColorMode: (m) => set({ colorMode: m }),
  setMappingModalTab: (tab) => set({ mappingModalTab: tab }),
  setGeoMode: (mode) => {
    set({ geoMode: mode })
    saveUIState('geoMode', mode).catch(() => { })
    getDebouncedSyncStats(get().syncStats)()
  },
  setPointStyle: (style) => set({ pointStyle: style }),
  setBubbleScale: (scale) => set({ bubbleScale: scale }),
  setPointRadiusBuffer: (radius) => set({ pointRadiusBuffer: radius }),
  setBaseMapStyle: (style) => set({ baseMapStyle: style }),
  setShowBoundaries: (show) => set({ showBoundaries: show }),
  setShowBaseMap: (show) => set({ showBaseMap: show }),
  setShowBorders: (show) => set({ showBorders: show }),
  setShowZeroAreas: (show) => set({ showZeroAreas: show }),
  setIsZenMode: (show) => set({ isZenMode: show }),
  setExportTitle: (exportTitle) => { set({ exportTitle }); saveUIState('exportTitle', exportTitle).catch(() => { }) },
  setExportSubtitle: (exportSubtitle) => { set({ exportSubtitle }); saveUIState('exportSubtitle', exportSubtitle).catch(() => { }) },
  setWatermarkPosition: (watermarkPosition) => set({ watermarkPosition }),
  setLegendPosition: (legendPosition) => set({ legendPosition }),
  setLogoUrl: (logoUrl) => set({ logoUrl }),
  setLogoPlacement: (logoPlacement) => set({ logoPlacement }),
  setLogoOpacity: (logoOpacity) => set({ logoOpacity }),
  setAnnotations: (annotations) => { set({ annotations }); saveUIState('annotations', annotations).catch(() => { }) },
  setArrows: (arrows) => { set({ arrows }); saveUIState('arrows', arrows).catch(() => { }) },
  setIncludeEpiCurve: (includeEpiCurve) => set({ includeEpiCurve }),

  setRetentionDays: (retentionDays) => set({ retentionDays }),
  setTheme: (theme) => {
    set({ theme })
    saveUIState('theme', theme).catch(() => { })

    // Sync export canvas theme when UI theme changes
    const canvasTheme = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme

    set(state => {
      const next = { ...state.canvasSettings, theme: canvasTheme }
      saveUIState('canvasSettings', next).catch(() => { })
      return { canvasSettings: next }
    })
  },
  setLanguage: (language) => {
    set({ language })
    saveUIState('language', language).catch(() => { })
  },

  setYearFormat: (yearFormat) => {
    set({ yearFormat })
    saveUIState('yearFormat', yearFormat).catch(() => { })
    const { periods, groupingMode } = get()
    if (periods.length > 0) {
      const updatedPeriods = periods.map(p => ({
        ...p,
        label: getPeriodLabel(p.date, groupingMode, yearFormat)
      }))
      set({ periods: updatedPeriods })
    }
  },

  refreshStorageUsage: async () => {
    const bytes = await estimateStorageUsage()
    set({ storageUsageBytes: bytes })
  },

  hydrateFromDB: async () => {
    try {
      const datasets = await loadAllDatasets()
      if (datasets.length === 0) return

      // โหลด UI state ก่อน เพื่อให้ใช้ groupingMode และ geoMode ที่ถูกบันทึกไว้ รวมถึง activeDatasetId
      const ui = await loadAllUIState()
      const savedGroupingMode = (ui.groupingMode as DateMode) || get().groupingMode
      const savedGeoMode = (ui.geoMode as 'admin' | 'coordinate') || get().geoMode
      const savedActiveId = ui.activeDatasetId as string | undefined
      const savedYearFormat = (ui.yearFormat as 'be' | 'ce') || get().yearFormat

      set({ yearFormat: savedYearFormat })

      // โหลด dataset ที่ควรจะเป็น Active จริง
      let latest = datasets.find(d => d.id === savedActiveId)
      if (!latest) {
        // ค้นหาตัวที่อัปโหลดล่าสุดเรียงลำดับตามเวลาจริง ป้องกัน UUID sorting random bug
        const sorted = [...datasets].sort((a, b) => new Date(b.loadedAt).getTime() - new Date(a.loadedAt).getTime())
        latest = sorted[0]
      }

      clearScopeCheckCache()
      clearCumulativeCache()

      const hasColorKey = !!latest.keys.color
      const isStatic = latest.ingestionMode === 'admin_static' || latest.ingestionMode === 'coord_static'
      const determinedColorMode = (hasColorKey && isStatic) ? 'custom' : 'value'

      set(s => ({
        rawRows: latest.rows,
        activeDatasetId: latest.id,
        datasets: datasets.map(ds => ({
          id: ds.id,
          fileName: ds.fileName,
          rowCount: ds.rowCount,
          keys: ds.keys,
          loadedAt: new Date(ds.loadedAt),
          fileBytes: ds.fileBytes,
          sheetNames: ds.sheetNames,
          selectedSheet: ds.selectedSheet,
        })),
        dataKeys: latest.keys,
        ingestionMode: latest.ingestionMode,
        retentionDays: latest.retentionDays ?? s.retentionDays,
        colorMode: determinedColorMode,
      }))

      // ── สร้าง dictionary + periods ใหม่จาก rawRows (เหมือนตอน import ครั้งแรก) ──
      const keys = latest.keys
      const mode = latest.ingestionMode
      let result: { dictionary: Record<string, any>; periods: PeriodBucket[] } | null = null

      try {
        if (mode === 'admin_static' || mode === 'coord_static') {
          result = await buildStaticDictionary(latest.rows, keys)
        } else if (keys.date) {
          // Long format dynamic (daily / weekly / monthly / yearly)
          result = await buildDictionary(latest.rows, keys, savedGroupingMode)
        } else {
          // Wide format dynamic — infer time columns from all non-geo columns
          const geoCols = [keys.province, keys.district, keys.subdistrict, keys.lat, keys.lng, keys.color].filter(Boolean)
          const timeCols = latest.rows.length > 0 ? Object.keys(latest.rows[0]).filter(c => !geoCols.includes(c)) : []
          if (timeCols.length > 0) {
            result = await buildWideDictionary(latest.rows, keys, timeCols)
          }
        }
      } catch (buildErr) {
        logger.warn('[Store] hydrateFromDB: rebuild dictionary failed:', buildErr)
      }

      if (result) {
        set({ dictionary: result.dictionary, periods: result.periods, currentStep: 0 })
        get().syncStats()
        logger.log(`[Store] Rebuilt ${result.periods.length} period(s) from hydrated data`)
      }

      // Apply saved UI state
      const patch: Partial<AppState> = {}
      if (ui.annotations) patch.annotations = ui.annotations as AppState['annotations']
      if (ui.arrows) patch.arrows = ui.arrows as AppState['arrows']
      if (ui.theme) patch.theme = ui.theme as AppState['theme']
      if (ui.language) patch.language = ui.language as AppState['language']
      if (ui.canvasWidgets) patch.canvasWidgets = ui.canvasWidgets as AppState['canvasWidgets']
      if (ui.canvasSettings) patch.canvasSettings = ui.canvasSettings as AppState['canvasSettings']
      if (ui.exportTitle) patch.exportTitle = ui.exportTitle as string
      if (ui.exportSubtitle) patch.exportSubtitle = ui.exportSubtitle as string
      if (ui.groupingMode) patch.groupingMode = savedGroupingMode
      if (ui.adminLevel) patch.adminLevel = ui.adminLevel as AppState['adminLevel']
      if (ui.displayMode) patch.displayMode = ui.displayMode as AppState['displayMode']
      if (ui.palette) patch.palette = ui.palette as AppState['palette']
      if (ui.isCumulative !== undefined) patch.isCumulative = ui.isCumulative as boolean
      if (ui.scaleStatsToRange !== undefined) patch.scaleStatsToRange = ui.scaleStatsToRange as boolean
      if (ui.cropChartToRange !== undefined) patch.cropChartToRange = ui.cropChartToRange as boolean
      if (savedGeoMode) patch.geoMode = savedGeoMode
      if (ui.yearFormat) patch.yearFormat = ui.yearFormat as AppState['yearFormat']
      if (Object.keys(patch).length > 0) set(patch)

      get().refreshStorageUsage()
      logger.log(`[Store] Hydrated ${datasets.length} dataset(s) from IndexedDB`)
    } catch (err) {
      logger.warn('[Store] hydrateFromDB failed:', err)
    }
  },

  clearAllData: async () => {
    await clearAllPersistence()
    clearScopeCheckCache()
    set({
      datasets: [],
      activeDatasetId: null,
      rawRows: [],
      dictionary: {},
      periods: [],
      globalStats: null,
      globalBreaks: [],
      annotations: [],
      arrows: [],
      storageUsageBytes: 0,
    })
  },

  loadDatasetById: async (id) => {
    try {
      const datasets = await loadAllDatasets()
      const ds = datasets.find(d => d.id === id)
      if (!ds) return

      clearScopeCheckCache()
      clearCumulativeCache()

      const hasColorKey = !!ds.keys.color
      const isStatic = ds.ingestionMode === 'admin_static' || ds.ingestionMode === 'coord_static'
      const determinedColorMode = (hasColorKey && isStatic) ? 'custom' : 'value'

      set(s => ({
        rawRows: ds.rows,
        dataKeys: ds.keys,
        activeDatasetId: id,
        ingestionMode: ds.ingestionMode,
        retentionDays: ds.retentionDays ?? s.retentionDays,
        isBreaksCustomized: false,
        breaksStart: 1,
        selectedLabelId: null,
        colorMode: determinedColorMode,
        datasets: datasets.map(d => ({
          id: d.id,
          fileName: d.fileName,
          rowCount: d.rowCount,
          keys: d.keys,
          loadedAt: new Date(d.loadedAt),
          fileBytes: d.fileBytes,
          sheetNames: d.sheetNames,
          selectedSheet: d.selectedSheet,
        }))
      }))
      saveUIState('activeDatasetId', id).catch(logger.warn)

      // Rebuild dictionary + periods
      const ui = await loadAllUIState()
      const savedGroupingMode = (ui.groupingMode as DateMode) || get().groupingMode
      const savedGeoMode = (ui.geoMode as 'admin' | 'coordinate') || get().geoMode

      const keys = ds.keys
      const mode = ds.ingestionMode
      let result: { dictionary: Record<string, any>; periods: PeriodBucket[] } | null = null

      try {
        if (mode === 'admin_static' || mode === 'coord_static') {
          result = await buildStaticDictionary(ds.rows, keys)
        } else if (keys.date) {
          result = await buildDictionary(ds.rows, keys, savedGroupingMode)
        } else {
          const geoCols = [keys.province, keys.district, keys.subdistrict, keys.lat, keys.lng, keys.color].filter(Boolean)
          const timeCols = ds.rows.length > 0 ? Object.keys(ds.rows[0]).filter(c => !geoCols.includes(c)) : []
          if (timeCols.length > 0) {
            result = await buildWideDictionary(ds.rows, keys, timeCols)
          }
        }
      } catch (buildErr) {
        logger.warn('[Store] loadDatasetById: rebuild dictionary failed:', buildErr)
      }

      if (result) {
        set({ dictionary: result.dictionary, periods: result.periods, currentStep: 0 })
        get().syncStats()
      }

      set({ geoMode: savedGeoMode })
      get().refreshStorageUsage()
      get().notify('success', `โหลดข้อมูลไฟล์ "${ds.fileName}" เข้าสู่แผนที่เรียบร้อยแล้ว!`)
    } catch (err) {
      logger.warn('[Store] loadDatasetById failed:', err)
      get().notify('error', 'ไม่สามารถโหลดข้อมูลชุดนี้ได้')
    }
  },

  deleteDatasetById: async (id) => {
    try {
      await deleteDataset(id)
      const remaining = get().datasets.filter(d => d.id !== id)

      set({ datasets: remaining })
      get().refreshStorageUsage()

      const currentActiveId = get().activeDatasetId
      if (remaining.length === 0) {
        set({
          rawRows: [],
          dictionary: {},
          periods: [],
          globalStats: null,
          globalBreaks: [],
          activeDatasetId: null,
        })
        saveUIState('activeDatasetId', null).catch(logger.warn)
      } else if (id === currentActiveId || get().rawRows.length === 0) {
        const sortedRemaining = [...remaining].sort((a, b) => new Date(b.loadedAt).getTime() - new Date(a.loadedAt).getTime())
        const newLatest = sortedRemaining[0]
        await get().loadDatasetById(newLatest.id)
      }

      get().notify('success', 'ลบข้อมูลสำเร็จ')
    } catch (err) {
      logger.warn('[Store] deleteDatasetById failed:', err)
      get().notify('error', 'ไม่สามารถลบข้อมูลนี้ได้')
    }
  },

  clearAllDatasets: async () => {
    try {
      await clearAllDatasetsInDB()
      clearScopeCheckCache()
      clearCumulativeCache()
      set({
        datasets: [],
        rawRows: [],
        dictionary: {},
        periods: [],
        globalStats: null,
        globalBreaks: [],
        activeDatasetId: null,
      })
      saveUIState('activeDatasetId', null).catch(logger.warn)
      get().refreshStorageUsage()
      get().notify('success', 'ลบข้อมูลทั้งหมดเรียบร้อยแล้ว')
    } catch (err) {
      logger.warn('[Store] clearAllDatasets failed:', err)
      get().notify('error', 'ไม่สามารถลบข้อมูลทั้งหมดได้')
    }
  },

  setMapLabelSource: (source) => set({ mapLabelSource: source }),
  setMapLabelColumn: (col) => set({ mapLabelColumn: col }),
  setMapLabelLimit: (limit) => set({ mapLabelLimit: limit }),
  setMapLabelThreshold: (val) => set({ mapLabelThreshold: val }),
  setMapLabelNameLevel: (level) => set({ mapLabelNameLevel: level }),
  updateLabelOffset: (id, dx, dy) => set(state => {
    const callout = state.labelCallouts[id] || {
      id,
      areaName: '',
      value: 0,
      dx: 0,
      dy: 0,
      isCustomized: false,
      style: {}
    }
    return {
      labelCallouts: {
        ...state.labelCallouts,
        [id]: {
          ...callout,
          dx,
          dy,
          isCustomized: true
        }
      }
    }
  }),
  updateLabelStyle: (id, style) => set(state => {
    const callout = state.labelCallouts[id] || {
      id,
      areaName: '',
      value: 0,
      dx: 0,
      dy: 0,
      isCustomized: false,
      style: {}
    }
    return {
      labelCallouts: {
        ...state.labelCallouts,
        [id]: {
          ...callout,
          style: {
            ...callout.style,
            ...style
          }
        }
      }
    }
  }),
  updateGlobalLabelStyle: (style) => set(state => ({
    globalLabelStyle: {
      ...state.globalLabelStyle,
      ...style
    }
  })),
  resetLabelOffset: (id) => set(state => {
    if (!state.labelCallouts[id]) return {}
    return {
      labelCallouts: {
        ...state.labelCallouts,
        [id]: {
          ...state.labelCallouts[id],
          dx: 0,
          dy: 0,
          isCustomized: false
        }
      }
    }
  }),
  setSelectedLabelId: (id) => set({ selectedLabelId: id }),
  setShowLocationPrefix: (showLocationPrefix) => set({ showLocationPrefix }),


  setLoading: (loading, msg = '') => set({ isLoading: loading, loadingMsg: msg }),
  notify: (type, msg) => {
    // ผู้ใช้ต้องการให้ซ่อน pop-up success และ info (สีเขียว, ขาว, ฟ้า) เพราะบังแผนที่และเสียเวลาปิด
    if (type === 'success' || type === 'info' || type === ('font' as any)) return
    set({ notification: { type, msg } })
  },
  clearNotification: () => set({ notification: null }),

  togglePeriodSelection: (key, isShift) => {
    const { selectedPeriods, lastClickedPeriod, periods } = get()
    const newSelected = new Set(selectedPeriods)

    if (isShift && lastClickedPeriod && periods.length > 0) {
      const keys = periods.map(p => p.key)
      const startIdx = keys.indexOf(lastClickedPeriod)
      const endIdx = keys.indexOf(key)
      if (startIdx !== -1 && endIdx !== -1) {
        const minIdx = Math.min(startIdx, endIdx)
        const maxIdx = Math.max(startIdx, endIdx)
        for (let i = minIdx; i <= maxIdx; i++) {
          newSelected.add(keys[i])
        }
      }
    } else {
      if (newSelected.has(key)) {
        newSelected.delete(key)
      } else {
        newSelected.add(key)
      }
    }

    set({ selectedPeriods: newSelected, lastClickedPeriod: key })
    get().syncStats()
  },

  clearPeriodSelection: () => {
    set({ selectedPeriods: new Set<string>(), lastClickedPeriod: null })
    get().syncStats()
  },

  setSelectedPeriods: (keys: Set<string>) => {
    set({ selectedPeriods: keys, lastClickedPeriod: Array.from(keys).pop() || null })
    get().syncStats()
  },

  getCurrentPeriodData: () => {
    const { dictionary, periods, currentStep } = get()
    const period = periods[currentStep]
    if (!period) return null
    return dictionary[period.key] ?? null
  },

  addCanvasWidget: (type) => set(state => {
    // Check if widget of this type already exists to prevent duplicates for singletons
    const alreadyExists = state.canvasWidgets.some(w => w.type === type)
    if (alreadyExists && (type === 'map' || type === 'chart' || type === 'legend' || type === 'title')) {
      return {} // Prevent adding duplicate map, chart, title, or legend
    }
    const id = `widget-${type}-${Date.now()}`
    const zIndex = state.canvasWidgets.length + 1
    const newWidget: CanvasWidget = {
      id,
      type,
      x: 15,
      y: 15,
      w: type === 'title' ? 50 : type === 'legend' ? 25 : 40,
      h: type === 'title' ? 10 : type === 'legend' ? 15 : 30,
      zIndex
    }
    return {
      canvasWidgets: [...state.canvasWidgets, newWidget],
      selectedWidgetId: id,
      widgetConfigs: {
        ...state.widgetConfigs,
        [id]: { ...DEFAULT_WIDGET_CONFIGS[type] }
      }
    }
  }),

  deleteCanvasWidget: (id) => set(state => {
    const filtered = state.canvasWidgets.filter(w => w.id !== id)
    const newConfigs = { ...state.widgetConfigs }
    delete newConfigs[id]
    return {
      canvasWidgets: filtered,
      selectedWidgetId: state.selectedWidgetId === id ? null : state.selectedWidgetId,
      widgetConfigs: newConfigs
    }
  }),

  updateWidgetGeometry: (id, x, y, w, h) => set(state => ({
    canvasWidgets: state.canvasWidgets.map(widget =>
      widget.id === id ? { ...widget, x, y, w, h } : widget
    )
  })),

  setSelectedWidgetId: (id) => set({ selectedWidgetId: id }),
  setIsWidgetInspectorOpen: (isOpen) => set({ isWidgetInspectorOpen: isOpen }),
  setCanvasSettings: (settings) => set(state => {
    const next = { ...state.canvasSettings, ...settings }
    saveUIState('canvasSettings', next).catch(() => { })
    return { canvasSettings: next }
  }),

  loadCanvasTemplate: (template) => set(() => {
    const t = Date.now()
    if (template === 'blank') {
      return {
        canvasWidgets: [],
        selectedWidgetId: null,
        widgetConfigs: {}
      }
    }
    if (template === 'standard') {
      const mapId = `widget-map-${t}`, chartId = `widget-chart-${t}`, titleId = `widget-title-${t}`, legendId = `widget-legend-${t}`
      return {
        canvasWidgets: [
          { id: mapId, type: 'map', x: 2, y: 15, w: 96, h: 50, zIndex: 1 },
          { id: chartId, type: 'chart', x: 2, y: 68, w: 96, h: 30, zIndex: 2 },
          { id: titleId, type: 'title', x: 2, y: 2, w: 60, h: 10, zIndex: 3 },
          { id: legendId, type: 'legend', x: 70, y: 2, w: 28, h: 12, zIndex: 4 }
        ],
        selectedWidgetId: null,
        widgetConfigs: {
          [mapId]: { ...DEFAULT_WIDGET_CONFIGS.map },
          [chartId]: { ...DEFAULT_WIDGET_CONFIGS.chart },
          [titleId]: { ...DEFAULT_WIDGET_CONFIGS.title },
          [legendId]: { ...DEFAULT_WIDGET_CONFIGS.legend },
        }
      }
    }
    if (template === 'split') {
      const mapId = `widget-map-${t}`, chartId = `widget-chart-${t}`, titleId = `widget-title-${t}`
      return {
        canvasWidgets: [
          { id: mapId, type: 'map', x: 2, y: 12, w: 60, h: 86, zIndex: 1 },
          { id: chartId, type: 'chart', x: 64, y: 12, w: 34, h: 86, zIndex: 2 },
          { id: titleId, type: 'title', x: 2, y: 2, w: 96, h: 8, zIndex: 3 }
        ],
        selectedWidgetId: null,
        widgetConfigs: {
          [mapId]: { ...DEFAULT_WIDGET_CONFIGS.map },
          [chartId]: { ...DEFAULT_WIDGET_CONFIGS.chart },
          [titleId]: { ...DEFAULT_WIDGET_CONFIGS.title },
        }
      }
    }
    return {}
  }),

  bringWidgetToFront: (id) => set(state => ({
    canvasWidgets: reorderWidgets(state.canvasWidgets, id, 'front')
  })),

  sendWidgetToBack: (id) => set(state => ({
    canvasWidgets: reorderWidgets(state.canvasWidgets, id, 'back')
  })),

  bringWidgetForward: (id) => set(state => ({
    canvasWidgets: reorderWidgets(state.canvasWidgets, id, 'forward')
  })),

  sendWidgetBackward: (id) => set(state => ({
    canvasWidgets: reorderWidgets(state.canvasWidgets, id, 'backward')
  })),

  setWidgetConfig: (id, patch) => set(state => {
    const existing = state.widgetConfigs[id]
    if (!existing) return {}
    return {
      widgetConfigs: {
        ...state.widgetConfigs,
        [id]: { ...existing, ...patch } as WidgetConfig
      }
    }
  }),

  getWidgetConfig: (id) => {
    const { widgetConfigs } = get()
    return (widgetConfigs[id] ?? null) as any
  },
  incrementMapVersion: () => set(state => ({ mapVersion: state.mapVersion + 1 })),
}))
