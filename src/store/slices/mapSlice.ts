/**
 * mapSlice.ts — Map display, admin level, palette, scope, style
 */
import type { AdminLevel, DisplayMode, ColorPalette, Scope } from '../useAppStore'

export interface MapSliceState {
  adminLevel: AdminLevel
  scope: Scope
  displayMode: DisplayMode
  palette: ColorPalette
  isCumulative: boolean
  showZeroAreas: boolean
  mapReady: boolean
  baseMapStyle: 'dark' | 'street' | 'satellite'
  showBoundaries: boolean
  showBaseMap: boolean
  showBorders: boolean
  pointStyle: 'cluster' | 'heatmap' | 'proportional'
}

export interface MapSliceActions {
  setAdminLevel: (l: AdminLevel) => void
  setScope: (s: Partial<Scope>) => void
  setDisplayMode: (m: DisplayMode) => void
  setPalette: (p: ColorPalette) => void
  setIsCumulative: (v: boolean) => void
  setMapReady: (v: boolean) => void
  setBaseMapStyle: (style: 'dark' | 'street' | 'satellite') => void
  setShowBoundaries: (show: boolean) => void
  setShowBaseMap: (show: boolean) => void
  setShowBorders: (show: boolean) => void
  setShowZeroAreas: (v: boolean) => void
  setPointStyle: (style: 'cluster' | 'heatmap' | 'proportional') => void
}

export const mapSliceInitialState: MapSliceState = {
  adminLevel: 'province',
  scope: { region: 'all', province: 'all', district: 'all', subdistrict: 'all' },
  displayMode: 'choropleth',
  palette: 'YlOrRd',
  isCumulative: false,
  showZeroAreas: false,
  mapReady: false,
  baseMapStyle: 'dark',
  showBoundaries: false,
  showBaseMap: true,
  showBorders: true,
  pointStyle: 'cluster',
}
