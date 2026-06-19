/**
 * slices/index.ts — Barrel export for all store slice types
 * Import from here to get all slice state/action interfaces
 */
export type { DataSliceState, DataSliceActions } from './dataSlice'
export { dataSliceInitialState } from './dataSlice'

export type { MapSliceState, MapSliceActions } from './mapSlice'
export { mapSliceInitialState } from './mapSlice'

export type { PlaybackSliceState, PlaybackSliceActions } from './playbackSlice'
export { playbackSliceInitialState } from './playbackSlice'

export type { ExportSliceState, ExportSliceActions } from './exportSlice'
export { exportSliceInitialState } from './exportSlice'

export type { LabelSliceState, LabelSliceActions, LabelCallout, GlobalLabelStyle } from './labelSlice'
export { labelSliceInitialState } from './labelSlice'

export type { UISliceState, UISliceActions } from './uiSlice'
export { uiSliceInitialState } from './uiSlice'
