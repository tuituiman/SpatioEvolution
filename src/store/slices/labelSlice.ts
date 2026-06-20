/**
 * labelSlice.ts — Map Labels, Callouts, Leader Lines
 */

export interface LabelCallout {
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
}

export interface GlobalLabelStyle {
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

export interface LabelSliceState {
  mapLabelSource: 'none' | 'name' | 'value' | 'name-value' | 'custom-column'
  mapLabelColumn: string
  mapLabelLimit: 'all' | 'top-5' | 'top-10' | 'top-20' | 'threshold'
  mapLabelThreshold: number
  mapLabelNameLevel: 'default' | 'province' | 'district'
  labelCallouts: Record<string, LabelCallout>
  globalLabelStyle: GlobalLabelStyle
  selectedLabelId: string | null
  showLocationPrefix: boolean
}

export interface LabelSliceActions {
  setMapLabelSource: (source: 'none' | 'name' | 'value' | 'name-value' | 'custom-column') => void
  setMapLabelColumn: (col: string) => void
  setMapLabelLimit: (limit: 'all' | 'top-5' | 'top-10' | 'top-20' | 'threshold') => void
  setMapLabelThreshold: (t: number) => void
  setMapLabelNameLevel: (level: 'default' | 'province' | 'district') => void
  setLabelCallouts: (callouts: Record<string, LabelCallout>) => void
  updateLabelCallout: (id: string, patch: Partial<LabelCallout>) => void
  setGlobalLabelStyle: (style: Partial<GlobalLabelStyle>) => void
  setSelectedLabelId: (id: string | null) => void
  setShowLocationPrefix: (show: boolean) => void
}

export const labelSliceInitialState: LabelSliceState = {
  mapLabelSource: 'none',
  mapLabelColumn: '',
  mapLabelLimit: 'all',
  mapLabelThreshold: 0,
  mapLabelNameLevel: 'default',
  labelCallouts: {},
  globalLabelStyle: {
    fontSize: 11,
    color: '#ffffff',
    bgColor: '#1e293b',
    bgOpacity: 0.85,
    borderColor: '#3b82f6',
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: 6,
    lineWidth: 1.5,
    lineColor: '#3b82f6',
    lineStyle: 'solid',
    markerType: 'dot',
    textStrokeColor: '#000000',
    textStrokeWidth: 1.5,
  },
  selectedLabelId: null,
  showLocationPrefix: true,
}
