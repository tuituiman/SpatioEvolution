/**
 * uiSlice.ts — Notifications, Loading, Modal State, Settings
 */

export interface UISliceState {
  isLoading: boolean
  loadingMsg: string
  notification: { type: 'info' | 'success' | 'error' | 'warning'; msg: string } | null
  isMappingOpen: boolean
  mappingModalTab: 'upload' | 'mapping'
  retentionDays: number | null
  storageUsageBytes: number
  theme: 'dark' | 'light' | 'system'
  language: 'th' | 'en'
}

export interface UISliceActions {
  setLoading: (loading: boolean, msg?: string) => void
  notify: (type: 'info' | 'success' | 'error' | 'warning', msg: string) => void
  clearNotification: () => void
  setIsMappingOpen: (v: boolean) => void
  setMappingModalTab: (tab: 'upload' | 'mapping') => void
  setRetentionDays: (days: number | null) => void
  hydrateFromDB: () => Promise<void>
  clearAllData: () => Promise<void>
  refreshStorageUsage: () => Promise<void>
  setTheme: (theme: 'dark' | 'light' | 'system') => void
  setLanguage: (lang: 'th' | 'en') => void
}

export const uiSliceInitialState: UISliceState = {
  isLoading: false,
  loadingMsg: '',
  notification: null,
  isMappingOpen: false,
  mappingModalTab: 'upload',
  retentionDays: null,
  storageUsageBytes: 0,
  theme: 'dark',
  language: 'th',
}
