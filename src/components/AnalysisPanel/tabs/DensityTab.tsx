import React from 'react'
import type { DataKeys } from '../../../store/useAppStore'
import { getActiveCoordinatesSlice, mountPointLayer } from '../../../map/pointLayer'
import { runDBSCAN } from '../../../data/spatialStats'
import { parseDate, toDateKey } from '../../../data/dateParser'
import { useTranslation } from '../../../hooks/useTranslation'
import { Sliders, AlertCircle, Play } from 'lucide-react'

interface DensityTabProps {
  eps: number
  setEps: (v: number) => void
  minPts: number
  setMinPts: (v: number) => void
  dataKeys: DataKeys
  rawRows: any[]
  originalColorKey: string | null
  setOriginalColorKey: (v: string | null) => void
  setRawRows: (rows: any[], meta: any) => void
  setColorMode: (v: 'value' | 'custom') => void
  setActiveOverlayType: (v: 'moran' | 'dbscan' | 'drift' | null) => void
  onClose: () => void
  notify: (type: 'info' | 'success' | 'error' | 'warning', msg: string) => void
}

function hslToHex(h: number, s: number, l: number): string {
  l /= 100
  const a = (s * Math.min(l, 1 - l)) / 100
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function getClusterHex(index: number, total: number): string {
  if (index < 0) return '#475569' // Noise (neutral gray)
  const hue = (index * 360) / Math.max(1, total)
  return hslToHex(hue, 85, 55)
}

export const DensityTab: React.FC<DensityTabProps> = ({
  eps,
  setEps,
  minPts,
  setMinPts,
  dataKeys,
  rawRows,
  originalColorKey,
  setOriginalColorKey,
  setRawRows,
  setColorMode,
  setActiveOverlayType,
  onClose,
  notify
}) => {
  const { t, language } = useTranslation()

  const handleDBSCANAnalysisAndPlot = () => {
    if (rawRows.length === 0) {
      notify('error', t('ana_dbscan_no_coords'))
      return
    }

    notify('info', t('ana_dbscan_running'))

    if (!originalColorKey) {
      setOriginalColorKey(dataKeys.color || '')
    }

    const rowsCopy = JSON.parse(JSON.stringify(rawRows))
    
    // Retrieve global states
    const globalState = (window as any).__zustand_store__?.getState()
    const periods = globalState?.periods || []
    const groupingMode = globalState?.groupingMode || 'weekly'
    
    let lastResult: any = null

    // Loop through all periods in the timeline to run calculations for each step
    for (const p of periods) {
      const periodKey = p.key
      const slice = getActiveCoordinatesSlice([periodKey])
      if (slice.length === 0) continue

      const res = runDBSCAN(slice, eps, minPts)
      lastResult = res

      res.labels.forEach((label: number, idx: number) => {
        const pt = slice[idx]
        if (!pt) return

        const rowIdx = rowsCopy.findIndex((row: any) => {
          const lat = parseFloat(String(row[dataKeys.lat] || '').trim())
          const lng = parseFloat(String(row[dataKeys.lng] || '').trim())
          if (isNaN(lat) || isNaN(lng)) return false

          const dateVal = row[dataKeys.date]
          if (periods.length > 1 && dateVal) {
            const parsedDate = parseDate(dateVal)
            if (parsedDate && !isNaN(parsedDate.getTime())) {
              const rKey = toDateKey(parsedDate, groupingMode)
              return Math.abs(lat - pt.lat) < 0.0001 && Math.abs(lng - pt.lng) < 0.0001 && rKey === periodKey
            }
          }
          return Math.abs(lat - pt.lat) < 0.0001 && Math.abs(lng - pt.lng) < 0.0001
        })

        if (rowIdx !== -1) {
          rowsCopy[rowIdx]._dbscan_color = getClusterHex(label, res.numClusters)
        }
      })
    }

    if (!lastResult) {
      notify('error', t('ana_dbscan_no_coords'))
      return
    }

    // Retain datasets metadata
    const meta = globalState
      ? (globalState.datasets.find((d: any) => d.id === globalState.activeDatasetId) || globalState.datasets[globalState.datasets.length - 1])
      : { fileName: 'dataset.csv', rowCount: rawRows.length }
    
    setRawRows(rowsCopy, {
      ...meta,
      keys: { ...dataKeys, color: '_dbscan_color' }
    })
    setColorMode('custom')
    setActiveOverlayType('dbscan')

    onClose()

    setTimeout(() => mountPointLayer(), 100)
    notify('success', t('ana_dbscan_success', { count: lastResult.numClusters }))
  }

  return (
    <div className="space-y-5 animate-fade-in text-spatio-text">
      <div className="space-y-1">
        <span className="text-[10px] font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
          <Sliders size={12} className="animate-bounce" />
          <span>{t('ana_dbscan_title')}</span>
        </span>
        <p className="text-[10px] text-spatio-muted leading-relaxed">
          {t('ana_dbscan_info')}
        </p>
      </div>

      {(!dataKeys.lat || !dataKeys.lng) ? (
        <div className="p-4 rounded-xl border border-amber-550/20 bg-amber-50 dark:bg-amber-950/10 text-amber-800 dark:text-amber-300 text-xs flex gap-2 leading-relaxed">
          <AlertCircle className="shrink-0 mt-0.5 text-amber-605 dark:text-amber-400" size={16} />
          <span>{t('ana_dbscan_no_coords')}</span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-spatio-surface/40 border border-spatio-border p-4 rounded-xl space-y-4 shadow-inner">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-spatio-text block">{t('ana_dbscan_eps')}</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={eps}
                  onChange={e => setEps(Number(e.target.value))}
                  className="flex-1 accent-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-mono font-bold bg-spatio-bg text-emerald-600 dark:text-emerald-450 border border-spatio-border px-2.5 py-0.5 rounded shrink-0">
                  {eps}km
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-spatio-text block">{t('ana_dbscan_minpts')}</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={2}
                  max={20}
                  value={minPts}
                  onChange={e => setMinPts(Number(e.target.value))}
                  className="flex-1 accent-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-mono font-bold bg-spatio-bg text-emerald-600 dark:text-emerald-450 border border-spatio-border px-2.5 py-0.5 rounded shrink-0">
                  {minPts} {language === 'th' ? 'เคส' : 'cases'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleDBSCANAnalysisAndPlot}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:opacity-95 text-white text-xs font-bold transition-all shadow-md active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer shadow-emerald-950/20"
          >
            <Play size={12} />
            <span>{t('ana_run_btn')}</span>
          </button>
        </div>
      )}
    </div>
  )
}
