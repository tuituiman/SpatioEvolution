import React, { useState, useMemo, useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useTranslation } from '../../hooks/useTranslation'
import { mountPointLayer } from '../../map/pointLayer'
import { 
  Sparkles, CheckCircle2, Trash2, X, Lock, Maximize2, Minimize2
} from 'lucide-react'
import { clsx } from 'clsx'

// Submodules
import { InterpolationTab } from './tabs/InterpolationTab'
import { DriftTab } from './tabs/DriftTab'
import { MoransTab } from './tabs/MoransTab'
import { DensityTab } from './tabs/DensityTab'
import { CorrelationTab } from './tabs/CorrelationTab'

export interface AnalysisPanelProps {
  isOpen: boolean
  onClose: () => void
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation()
  const {
    rawRows,
    datasets,
    dataKeys,
    periods,
    currentStep,
    geoMode,
    adminLevel,
    dictionary,
    setDictionary,
    setColorMode,
    setRawRows,
    notify,
    activeDatasetId
  } = useAppStore()

  // Parameter states
  const [isWide, setIsWide] = useState<boolean>(true)
  const [distanceBand, setDistanceBand] = useState<number>(100)
  const [eps, setEps] = useState<number>(30)
  const [minPts, setMinPts] = useState<number>(4)
  const [idwPower, setIdwPower] = useState<number>(2)
  const [idwRadius, setIdwRadius] = useState<number>(150)
  const [xCol, setXCol] = useState<string>('')
  const [yCol, setYCol] = useState<string>('')

  // Overlay backup states
  const [activeOverlayType, setActiveOverlayType] = useState<'moran' | 'dbscan' | 'drift' | null>(null)
  const [originalDictionary, setOriginalDictionary] = useState<any | null>(null)
  const [originalColorKey, setOriginalColorKey] = useState<string | null>(null)

  // Numeric columns for Correlation
  const numericColumns = useMemo(() => {
    if (rawRows.length === 0) return []
    return Object.keys(rawRows[0] || {}).filter(k => {
      const val = (rawRows[0] as Record<string, unknown>)[k]
      return typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val.replace(/,/g, '').trim())))
    })
  }, [rawRows])

  // Render-time state adjustments (replaces useEffect state setters to comply with strict eslint rules)
  const numericColumnsKey = numericColumns.join(',')
  const [prevNumericColumnsKey, setPrevNumericColumnsKey] = useState(numericColumnsKey)
  if (numericColumnsKey !== prevNumericColumnsKey) {
    setPrevNumericColumnsKey(numericColumnsKey)
    if (numericColumns.length >= 2) {
      setXCol(numericColumns[0])
      setYCol(numericColumns[1])
    }
  }

  const currentActiveDatasetId = activeDatasetId || datasets[datasets.length - 1]?.id || ''
  const [prevDatasetId, setPrevDatasetId] = useState(currentActiveDatasetId)
  if (currentActiveDatasetId !== prevDatasetId) {
    setPrevDatasetId(currentActiveDatasetId)
    setActiveOverlayType(null)
    setOriginalDictionary(null)
    setOriginalColorKey(null)
  }

  // Detect which of the 6 data profiles is loaded
  const dataProfile = useMemo(() => {
    if (rawRows.length === 0) return null

    const hasValue = !!dataKeys.value
    const isCoord = geoMode === 'coordinate' || (!!dataKeys.lat && !!dataKeys.lng)
    const isTS = periods.length > 1

    if (!isCoord) {
      // Area-based
      return isTS
        ? { id: 1, title: t('ana_profile1'), type: 'Area' }
        : { id: 2, title: t('ana_profile2'), type: 'Area' }
    } else {
      // Point/Coord-based
      if (!hasValue) {
        return isTS
          ? { id: 3, title: t('ana_profile3'), type: 'Coordinate' }
          : { id: 4, title: t('ana_profile4'), type: 'Coordinate' }
      } else {
        return isTS
          ? { id: 5, title: t('ana_profile5'), type: 'Measurement' }
          : { id: 6, title: t('ana_profile6'), type: 'Measurement' }
      }
    }
  }, [rawRows, dataKeys, geoMode, periods, t])

  // Check compatibility for each of the 5 tabs based on the active data profile
  const tabSuitability = useMemo(() => {
    if (!dataProfile) {
      return {
        interp: false,
        drift: false,
        morans: false,
        hotspot: false,
        overlay: false,
      }
    }

    const hasValue = !!dataKeys.value
    const isCoord = geoMode === 'coordinate' || (!!dataKeys.lat && !!dataKeys.lng)
    const isTS = periods.length > 1

    return {
      interp: isCoord && hasValue, // Profile 5 & 6 only
      drift: isTS,                // Profile 1, 3, 5 only (requires dynamic time)
      morans: !isCoord,            // Profile 1 & 2 only (requires administrative areas)
      hotspot: isCoord,            // Profile 3, 4, 5, 6 only (requires coordinate points)
      overlay: numericColumns.length >= 2,
    }
  }, [dataProfile, dataKeys.value, geoMode, dataKeys.lat, dataKeys.lng, periods.length, numericColumns.length])

  // 5 exact tabs matching the user's image specification
  const [activeTab, setActiveTab] = useState<'interp' | 'drift' | 'morans' | 'hotspot' | 'overlay'>('morans')

  const profileId = dataProfile?.id
  const [prevProfileId, setPrevProfileId] = useState<number | undefined>(profileId)
  if (profileId !== prevProfileId) {
    setPrevProfileId(profileId)
    if (dataProfile) {
      const order: ('interp' | 'drift' | 'morans' | 'hotspot' | 'overlay')[] = ['morans', 'hotspot', 'interp', 'drift', 'overlay']
      const firstCompatible = order.find(tab => tabSuitability[tab])
      if (firstCompatible && !tabSuitability[activeTab]) {
        setActiveTab(firstCompatible)
      }
    }
  }

  if (!isOpen) return null

  // ── Reset Overlay Map ──
  const handleClearOverlay = () => {
    if (activeOverlayType === 'moran' && originalDictionary) {
      setDictionary(originalDictionary)
      setOriginalDictionary(null)
    } else if (activeOverlayType === 'dbscan' && originalColorKey !== null) {
      const globalState = (window as any).__zustand_store__?.getState()
      const meta = globalState
        ? (globalState.datasets.find((d: any) => d.id === globalState.activeDatasetId) || globalState.datasets[globalState.datasets.length - 1])
        : { keys: dataKeys }
      const cleanRows = rawRows.map((r: any) => {
        delete r._dbscan_color
        return r
      })
      setRawRows(cleanRows, {
        ...meta,
        keys: { ...dataKeys, color: originalColorKey }
      })
      setOriginalColorKey(null)
      setTimeout(() => mountPointLayer(), 100)
    } else if (activeOverlayType === 'drift') {
      (window as any).driftRes = null
      setTimeout(() => mountPointLayer(), 100)
    }

    setColorMode('value')
    setActiveOverlayType(null)
    onClose()
    notify('info', 'ล้างสีกราฟวิเคราะห์สถิติและคืนค่าสีกริดแผนที่มาตรฐานแล้ว')
  }

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div 
        className={clsx(
          "bg-spatio-surface border border-spatio-border rounded-2xl shadow-2xl flex flex-col overflow-hidden relative animate-scale-up text-spatio-text transition-all duration-300",
          isWide ? "w-full max-w-5xl h-[85vh]" : "w-full max-w-lg h-auto max-h-[90vh]"
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-spatio-border dark:bg-slate-950/40 bg-spatio-bg/50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="text-spatio-primary animate-pulse animate-spin-slow" size={16} />
            <h3 className="text-sm font-black text-spatio-text uppercase tracking-wider">{t('ana_studio_title')}</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => setIsWide(!isWide)}
              title={isWide ? t('ana_minimize', { defaultValue: 'ลดขนาดหน้าต่างลง' }) : t('ana_maximize', { defaultValue: 'ขยายขนาดหน้าต่างเต็มตา' })}
              className="p-1.5 rounded-lg text-spatio-muted hover:text-spatio-text hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer"
            >
              {isWide ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-spatio-muted hover:text-spatio-text hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Dynamic Ingested Profile */}
        {dataProfile && (
          <div className="px-6 py-2.5 bg-spatio-primary/5 border-b border-spatio-border/50 flex items-center justify-between text-[10px]">
            <span className="text-spatio-muted font-semibold">{t('ana_profile_detect')}</span>
            <span className="px-2 py-0.5 rounded-full bg-spatio-primary/10 border border-spatio-primary/20 text-spatio-primary font-bold font-sans">
              {dataProfile.title}
            </span>
          </div>
        )}

        {/* Tab switcher */}
        <div className="px-4 py-2 border-b border-spatio-border/50 bg-spatio-bg/30 flex gap-1.5 shrink-0 overflow-x-auto select-none no-scrollbar">
          <button
            disabled={!tabSuitability.interp}
            onClick={() => setActiveTab('interp')}
            title={!tabSuitability.interp ? t('ana_idw_suit') : "เครื่องมือประมาณค่าสถิติเชิงพื้นที่"}
            className={clsx(
              "px-3 py-2 rounded-lg text-[10px] font-bold border transition-all shrink-0 text-center flex flex-col items-center justify-center min-w-[110px]",
              !tabSuitability.interp
                ? "bg-spatio-bg/50 dark:bg-slate-950/40 border-spatio-border/50 text-spatio-muted/60 opacity-45 cursor-not-allowed"
                : activeTab === 'interp' 
                  ? "bg-indigo-500/10 dark:bg-indigo-600/10 border-indigo-500/40 text-indigo-655 dark:text-indigo-400 font-black shadow-lg cursor-pointer" 
                  : "bg-transparent border-transparent text-spatio-muted hover:text-spatio-text cursor-pointer"
            )}
          >
            {!tabSuitability.interp ? <Lock size={12} className="text-spatio-muted mb-1 animate-pulse" /> : null}
            <span>Spatial Interpolation</span>
            <span>(IDW/Kriging)</span>
          </button>

          <button
            disabled={!tabSuitability.drift}
            onClick={() => setActiveTab('drift')}
            title={!tabSuitability.drift ? t('ana_drift_suit') : "วิเคราะห์รอยเยื้องตัวของคลัสเตอร์ระบาด"}
            className={clsx(
              "px-3 py-2 rounded-lg text-[10px] font-bold border transition-all shrink-0 text-center flex flex-col items-center justify-center min-w-[110px]",
              !tabSuitability.drift
                ? "bg-spatio-bg/50 dark:bg-slate-950/40 border-spatio-border/50 text-spatio-muted/60 opacity-45 cursor-not-allowed"
                : activeTab === 'drift' 
                  ? "bg-cyan-500/10 dark:bg-cyan-600/10 border-cyan-500/40 text-cyan-600 dark:text-cyan-400 font-black shadow-lg cursor-pointer" 
                  : "bg-transparent border-transparent text-spatio-muted hover:text-spatio-text cursor-pointer"
            )}
          >
            {!tabSuitability.drift ? <Lock size={12} className="text-spatio-muted mb-1 animate-pulse" /> : null}
            <span>Spatiotemporal Drift</span>
            <span>(วงรี SDE / Centroid)</span>
          </button>

          <button
            disabled={!tabSuitability.morans}
            onClick={() => setActiveTab('morans')}
            title={!tabSuitability.morans ? t('ana_moran_suit') : "คำนวณสหสัมพันธ์พื้นที่ความสัมพันธ์ของโรค"}
            className={clsx(
              "px-3 py-2 rounded-lg text-[10px] font-bold border transition-all shrink-0 text-center flex flex-col items-center justify-center min-w-[110px]",
              !tabSuitability.morans
                ? "bg-spatio-bg/50 dark:bg-slate-950/40 border-spatio-border/50 text-spatio-muted/60 opacity-45 cursor-not-allowed"
                : activeTab === 'morans' 
                  ? "bg-rose-500/10 dark:bg-rose-600/10 border-rose-500/40 text-rose-600 dark:text-rose-400 font-black shadow-lg cursor-pointer" 
                  : "bg-transparent border-transparent text-spatio-muted hover:text-spatio-text cursor-pointer"
            )}
          >
            {!tabSuitability.morans ? <Lock size={12} className="text-spatio-muted mb-1 animate-pulse" /> : null}
            <span>Local Autocorrelation</span>
            <span>(LISA / Hotspot)</span>
          </button>

          <button
            disabled={!tabSuitability.hotspot}
            onClick={() => setActiveTab('hotspot')}
            title={!tabSuitability.hotspot ? t('ana_dbscan_suit') : "ระบุความหนาแน่นและจับกลุ่มคลัสเตอร์"}
            className={clsx(
              "px-3 py-2 rounded-lg text-[10px] font-bold border transition-all shrink-0 text-center flex flex-col items-center justify-center min-w-[110px]",
              !tabSuitability.hotspot
                ? "bg-spatio-bg/50 dark:bg-slate-950/40 border-spatio-border/50 text-spatio-muted/60 opacity-45 cursor-not-allowed"
                : activeTab === 'hotspot' 
                  ? "bg-emerald-500/10 dark:bg-emerald-600/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-black shadow-lg cursor-pointer" 
                  : "bg-transparent border-transparent text-spatio-muted hover:text-spatio-text cursor-pointer"
            )}
          >
            {!tabSuitability.hotspot ? <Lock size={12} className="text-spatio-muted mb-1 animate-pulse" /> : null}
            <span>Point Density</span>
            <span>(KDE / DBSCAN)</span>
          </button>

          <button
            disabled={!tabSuitability.overlay}
            onClick={() => setActiveTab('overlay')}
            title={!tabSuitability.overlay ? t('ana_corr_suit') : "เปรียบเทียบสหสัมพันธ์ดัชนีตารางไขว้"}
            className={clsx(
              "px-3 py-2 rounded-lg text-[10px] font-bold border transition-all shrink-0 text-center flex flex-col items-center justify-center min-w-[110px]",
              !tabSuitability.overlay
                ? "bg-spatio-bg/50 dark:bg-slate-950/40 border-spatio-border/50 text-spatio-muted/60 opacity-45 cursor-not-allowed"
                : activeTab === 'overlay' 
                  ? "bg-amber-500/10 dark:bg-amber-600/10 border-amber-500/40 text-amber-600 dark:text-amber-400 font-black shadow-lg cursor-pointer" 
                  : "bg-transparent border-transparent text-spatio-muted hover:text-spatio-text cursor-pointer"
            )}
          >
            {!tabSuitability.overlay ? <Lock size={12} className="text-spatio-muted mb-1 animate-pulse" /> : null}
            <span>Cross-Aggregation</span>
            <span>(Point-in-Polygon Overlay)</span>
          </button>
        </div>

        {/* Modal Body with Parameters Only */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 min-h-0 bg-spatio-bg/10">
          {activeTab === 'interp' && (
            <InterpolationTab
              dataKeys={dataKeys}
              idwPower={idwPower}
              setIdwPower={setIdwPower}
              idwRadius={idwRadius}
              setIdwRadius={setIdwRadius}
              onClose={onClose}
              notify={notify}
            />
          )}

          {activeTab === 'drift' && (
            <DriftTab
              periods={periods}
              geoMode={geoMode}
              adminLevel={adminLevel}
              dictionary={dictionary}
              onClose={onClose}
              notify={notify}
              setActiveOverlayType={setActiveOverlayType}
            />
          )}

          {activeTab === 'morans' && (
            <MoransTab
              periods={periods}
              currentStep={currentStep}
              dictionary={dictionary}
              adminLevel={adminLevel}
              distanceBand={distanceBand}
              setDistanceBand={setDistanceBand}
              originalDictionary={originalDictionary}
              setOriginalDictionary={setOriginalDictionary}
              setDictionary={setDictionary}
              setColorMode={setColorMode}
              setActiveOverlayType={setActiveOverlayType}
              onClose={onClose}
              notify={notify}
              isWide={isWide}
            />
          )}

          {activeTab === 'hotspot' && (
            <DensityTab
              eps={eps}
              setEps={setEps}
              minPts={minPts}
              setMinPts={setMinPts}
              dataKeys={dataKeys}
              rawRows={rawRows}
              originalColorKey={originalColorKey}
              setOriginalColorKey={setOriginalColorKey}
              setRawRows={setRawRows}
              setColorMode={setColorMode}
              setActiveOverlayType={setActiveOverlayType}
              onClose={onClose}
              notify={notify}
            />
          )}

          {activeTab === 'overlay' && (
            <CorrelationTab
              xCol={xCol}
              setXCol={setXCol}
              yCol={yCol}
              setYCol={setYCol}
              numericColumns={numericColumns}
              rawRows={rawRows}
              onClose={onClose}
              notify={notify}
            />
          )}
        </div>

        {/* Modal Footer */}
        {activeOverlayType && (
          <div className="px-6 py-4.5 border-t border-spatio-border bg-spatio-bg/50 dark:bg-slate-950/40 flex justify-between items-center shrink-0">
            <span className="text-[10px] text-spatio-muted font-semibold flex items-center gap-1.5 animate-pulse">
              <CheckCircle2 size={12} className="text-emerald-500" />
              <span>{t('ana_applied')}</span>
            </span>

            <button
              onClick={handleClearOverlay}
              className="px-3.5 py-1.5 rounded-lg border border-red-500/30 bg-red-100 dark:bg-red-950/20 hover:bg-red-200 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
            >
              <Trash2 size={12} />
              <span>{t('ana_clear_map')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
