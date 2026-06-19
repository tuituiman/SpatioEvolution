/**
 * exportSlice.ts — Export, Annotations, Canvas Artboard, Logo
 */
import type { CanvasWidget, CanvasSettings } from '../useAppStore'

export interface ExportSliceState {
  isZenMode: boolean
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
  canvasWidgets: CanvasWidget[]
  canvasSettings: CanvasSettings
  selectedWidgetId: string | null
}

export interface ExportSliceActions {
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
}

export const exportSliceInitialState: ExportSliceState = {
  isZenMode: false,
  exportTitle: '',
  exportSubtitle: '',
  watermarkPosition: 'bottom-right',
  legendPosition: 'bottom-left',
  logoUrl: null,
  logoPlacement: 'watermark',
  logoOpacity: 0.5,
  annotations: [],
  arrows: [],
  includeEpiCurve: false,
  canvasWidgets: [],
  canvasSettings: { aspectRatio: '16:9', theme: 'dark' },
  selectedWidgetId: null,
}
