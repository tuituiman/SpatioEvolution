/**
 * dataSlice.ts — Dataset, Rows, Dictionary, Statistics
 */
import type {
  DataKeys, IngestionMode, DateDictionary, PeriodBucket,
  DatasetMeta, GlobalStats
} from '../useAppStore'
import type { DateMode } from '../../data/dateParser'

export interface DataSliceState {
  datasets: DatasetMeta[]
  rawRows: Record<string, unknown>[]
  dataKeys: DataKeys
  ingestionMode: IngestionMode
  dictionary: DateDictionary
  periods: PeriodBucket[]
  groupingMode: DateMode
  globalStats: GlobalStats | null
  globalBreaks: number[]
  colorMode: 'value' | 'custom'
  geoMode: 'admin' | 'coordinate'
  selectedPeriods: Set<string>
  lastClickedPeriod: string | null
}

export interface DataSliceActions {
  setDataKeys: (keys: Partial<DataKeys>) => void
  setDictionary: (dict: DateDictionary) => void
  setPeriods: (p: PeriodBucket[]) => void
  clearStats: () => void
  setGroupingMode: (m: DateMode) => void
  setIngestionMode: (m: IngestionMode) => void
  setColorMode: (mode: 'value' | 'custom') => void
  setGeoMode: (mode: 'admin' | 'coordinate') => void
  togglePeriodSelection: (key: string, isShift: boolean) => void
  clearPeriodSelection: () => void
  setSelectedPeriods: (keys: Set<string>) => void
}

export const dataSliceInitialState: DataSliceState = {
  datasets: [],
  rawRows: [],
  dataKeys: { date: '', province: '', district: '', subdistrict: '', lat: '', lng: '', value: '', color: '' },
  ingestionMode: 'admin_dynamic',
  dictionary: {},
  periods: [],
  groupingMode: 'weekly',
  globalStats: null,
  globalBreaks: [],
  colorMode: 'value',
  geoMode: 'admin',
  selectedPeriods: new Set(),
  lastClickedPeriod: null,
}
