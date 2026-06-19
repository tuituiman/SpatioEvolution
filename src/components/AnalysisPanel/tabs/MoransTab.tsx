import React, { useState, useEffect, useMemo, useRef } from 'react'
import type { PeriodBucket, DateDictionary, AdminLevel } from '../../../store/useAppStore'
import { useTranslation } from '../../../hooks/useTranslation'
import { locationResolver } from '../../../data/locationResolver'
import { registry } from '../../../data/registry'
import { extractCentroid, getContiguityNeighbors } from '../../../data/spatialStats'
import { Flame, Settings2, AlertTriangle, BarChart2 } from 'lucide-react'

interface MoransTabProps {
  periods: PeriodBucket[]
  currentStep: number
  dictionary: DateDictionary
  adminLevel: AdminLevel
  distanceBand: number
  setDistanceBand: (v: number) => void
  originalDictionary: any | null
  setOriginalDictionary: (v: any) => void
  setDictionary: (v: DateDictionary) => void
  setColorMode: (v: 'value' | 'custom') => void
  setActiveOverlayType: (v: 'moran' | 'dbscan' | 'drift' | null) => void
  onClose: () => void
  notify: (type: 'info' | 'success' | 'error' | 'warning', msg: string) => void
  isWide?: boolean // Added for stretchy UX
}

export const MoransTab: React.FC<MoransTabProps> = ({
  periods,
  currentStep,
  dictionary,
  adminLevel,
  distanceBand,
  setDistanceBand,
  originalDictionary,
  setOriginalDictionary,
  setDictionary,
  setColorMode,
  setActiveOverlayType,
  onClose,
  notify,
  isWide = false // Destructured with default
}) => {
  const { t } = useTranslation()
  // Advanced parameters local state
  const [weightType, setWeightType] = useState<'inverse_distance' | 'queen' | 'rook'>('inverse_distance')
  const [rowStandardized, setRowStandardized] = useState<boolean>(true)
  const [numPermutations, setNumPermutations] = useState<number>(999)
  const [lisaThreshold, setLisaThreshold] = useState<number>(0.05)

  // Web Worker progress state
  const [isCalculating, setIsCalculating] = useState<boolean>(false)
  const [progressPercent, setProgressPercent] = useState<number>(0)
  const [progressMsg, setProgressMsg] = useState<string>('')

  // Storage of results by period
  const [resultsByPeriod, setResultsByPeriod] = useState<Record<string, any>>({})
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null)

  // Current active period key
  const currentPeriod = periods[currentStep]
  const currentPeriodKey = currentPeriod?.key
  const currentResult = resultsByPeriod[currentPeriodKey]

  const workerRef = useRef<Worker | null>(null)

  // Pre-calculate adjacency map in main thread for contiguity weights
  const getAdjacencyDict = (): Record<string, string[]> | null => {
    if (weightType === 'inverse_distance') return null
    try {
      const features = registry.getFeatures(adminLevel)
      const areasData = features.map(f => {
        const props = f.properties
        let code = ''
        if (adminLevel === 'subdistrict') {
          const c = String(props.Admin_code ?? props.T_code ?? '')
          code = c.replace(/\D/g, '').padStart(6, '0')
        } else if (adminLevel === 'district') {
          const adminCode = String(props.Admin_code ?? props.A_code_full ?? '')
          if (adminCode) {
            code = adminCode.replace(/\D/g, '').padStart(4, '0')
          } else {
            const p = String(props.P_code ?? '').replace(/\D/g, '').padStart(2, '0')
            const a = String(props.A_code ?? '').replace(/\D/g, '').padStart(2, '0')
            code = p && a ? p + a : ''
          }
        } else {
          code = String(props.P_code ?? '').replace(/\D/g, '').padStart(2, '0')
        }
        return { code }
      }).filter(a => a.code !== '')
      
      const adjacencyMap = getContiguityNeighbors(areasData, adminLevel, weightType)
      const adjacencyDict: Record<string, string[]> = {}
      adjacencyMap.forEach((neighborsSet, code) => {
        adjacencyDict[code] = Array.from(neighborsSet)
      })
      return adjacencyDict
    } catch (e) {
      console.error('[MoransTab] Adjacency error:', e)
      return null
    }
  }

  // Reactive Debounced calculations using Web Worker
  useEffect(() => {
    if (!periods || periods.length === 0) return

    // Clean previous worker if running
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }

    const runAnalysis = async () => {
      setIsCalculating(true)
      setProgressPercent(0)
      setProgressMsg(t('ana_moran_progress_geo'))

      try {
        await locationResolver.init()
        
        // Backup original dictionary if not done
        if (!originalDictionary) {
          setOriginalDictionary(JSON.parse(JSON.stringify(dictionary)))
        }

        const features = registry.getFeatures(adminLevel)
        const areasByPeriod: Record<string, any[]> = {}

        // Construct dataset for all periods in the timeline
        for (const p of periods) {
          const slice = dictionary[p.key] || {}
          const areasData: any[] = []

          features.forEach(f => {
            const props = f.properties
            const resolved = locationResolver.resolve(
              String(props.P_Name_T ?? props.PV_TN ?? ''),
              adminLevel === 'province' ? '' : String(props.A_Name_T ?? props.AM_TN ?? ''),
              adminLevel === 'subdistrict' ? String(props.T_Name_T ?? props.TB_TN ?? '') : ''
            )
            if (!resolved) return

            let val = 0
            const pCode = resolved.pCode
            const aCode = resolved.aCode
            const tCode = resolved.tCode

            const pData = slice[pCode]
            if (pData) {
              if (adminLevel === 'province') val = pData._total || 0
              else if (adminLevel === 'district' && aCode) val = pData.districts[aCode]?._total || 0
              else if (adminLevel === 'subdistrict' && tCode) val = pData.districts[aCode]?.subdistricts[tCode] || 0
            }

            areasData.push({
              code: adminLevel === 'subdistrict' ? tCode : (adminLevel === 'district' ? aCode : pCode),
              name: adminLevel === 'subdistrict' ? resolved.tName : (adminLevel === 'district' ? resolved.aName : resolved.pName),
              value: val,
              centroid: extractCentroid(f.geometry)
            })
          })

          areasByPeriod[p.key] = areasData
        }

        const adjacency = getAdjacencyDict()

        // Spawn background worker using Vite-standard URL constructor
        const worker = new Worker(
          new URL('../../../workers/moranWorker.ts', import.meta.url),
          { type: 'module' }
        )
        workerRef.current = worker

        worker.onmessage = (e: MessageEvent) => {
          const { type, percent, periodKey, results, message } = e.data

          if (type === 'PROGRESS') {
            setProgressPercent(percent)
            setProgressMsg(periodKey === 'DONE' ? t('ana_moran_progress_color') : t('ana_moran_progress_run', { key: periodKey, percent }))
          } else if (type === 'DONE') {
            setResultsByPeriod(results)
            setIsCalculating(false)

            // Inject custom LISA colors
            const baseDict = originalDictionary || dictionary
            const dictCopy = JSON.parse(JSON.stringify(baseDict))

            const colors: Record<string, string> = {
              HH: '#ef4444', // Hotspot
              LL: '#3b82f6', // Coldspot
              HL: '#ec4899', // High-Low Outlier
              LH: '#6366f1', // Low-High Outlier
              NS: '#cbd5e1'  // Not Significant
            }

            Object.entries(results).forEach(([pKey, resObj]: [string, any]) => {
              const slice = dictCopy[pKey]
              if (!slice) return

              resObj.details.forEach((item: any) => {
                const code = item.areaCode
                const color = colors[item.type] || '#cbd5e1'

                if (adminLevel === 'province') {
                  if (slice[code]) slice[code].color = color
                } else if (adminLevel === 'district') {
                  const pCode = code.slice(0, 2)
                  if (slice[pCode] && slice[pCode].districts[code]) {
                    slice[pCode].districts[code].color = color
                  }
                } else if (adminLevel === 'subdistrict') {
                  const pCode = code.slice(0, 2)
                  const aCode = code.slice(0, 4)
                  if (slice[pCode] && slice[pCode].districts[aCode]) {
                    const distData = slice[pCode].districts[aCode]
                    if (!distData.subdistrictColors) distData.subdistrictColors = {}
                    distData.subdistrictColors[code] = color
                  }
                }
              })
            })

            setDictionary(dictCopy)
            setColorMode('custom')
            setActiveOverlayType('moran')
          } else if (type === 'ERROR') {
            notify('error', t('ana_moran_err', { msg: message }))
            setIsCalculating(false)
          }
        }

        worker.postMessage({
          type: 'RUN',
          periods,
          areasByPeriod,
          adjacency,
          options: {
            weightType,
            distanceBandKm: distanceBand,
            rowStandardized,
            numPermutations,
            lisaThreshold
          },
          adminLevel
        })

      } catch (err: any) {
        notify('error', t('ana_moran_err', { msg: err.message }))
        setIsCalculating(false)
      }
    }

    // Debounce the calculation by 250ms
    const timer = setTimeout(() => {
      runAnalysis()
    }, 250)

    return () => {
      clearTimeout(timer)
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [
    weightType,
    distanceBand,
    rowStandardized,
    numPermutations,
    lisaThreshold,
    adminLevel
  ])

  // Clean worker on component unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
      }
    }
  }, [])

  // Filter significant areas (p-value < lisaThreshold & type !== 'NS')
  const significantAreas = useMemo(() => {
    if (!currentResult || !currentResult.details) return []
    return currentResult.details
      .filter((d: any) => d.type !== 'NS')
      .sort((a: any, b: any) => a.pValue - b.pValue)
  }, [currentResult])

  // ──────────────────────────────────────────
  // Moran Scatter Plot Generator (SVG)
  // ──────────────────────────────────────────
  const scatterPlotSvg = useMemo(() => {
    if (!currentResult || !currentResult.details || currentResult.details.length === 0) {
      return (
        <div className="h-[180px] bg-spatio-bg/50 border border-spatio-border flex flex-col items-center justify-center rounded-xl text-[11px] text-spatio-muted font-bold select-none">
          <BarChart2 size={24} className="mb-2 text-spatio-muted animate-pulse" />
          <span>{t('ana_moran_scatter_err')}</span>
        </div>
      )
    }

    const margin = { top: 15, right: 15, bottom: 25, left: 30 }
    const width = isWide ? 420 : 290
    const height = 180

    // Centered domain calculations
    let maxAbs = 2.5
    currentResult.details.forEach((d: any) => {
      maxAbs = Math.max(maxAbs, Math.abs(d.stdValue), Math.abs(d.stdSpatialLag))
    })
    maxAbs = Math.ceil(maxAbs * 2) / 2 // round to nearest 0.5

    const xScale = (val: number) =>
      margin.left + ((val + maxAbs) / (2 * maxAbs)) * (width - margin.left - margin.right)
    const yScale = (val: number) =>
      margin.top + (1 - (val + maxAbs) / (2 * maxAbs)) * (height - margin.top - margin.bottom)

    // Quadrant bounds for styling
    const wQuad = (width - margin.left - margin.right) / 2
    const hQuad = (height - margin.top - margin.bottom) / 2

    // Regression Line
    const slope = currentResult.moranIndex
    const x1 = -maxAbs
    const y1 = -maxAbs * slope
    const x2 = maxAbs
    const y2 = maxAbs * slope

    const colors: Record<string, string> = {
      HH: '#ef4444',
      LL: '#3b82f6',
      HL: '#ec4899',
      LH: '#6366f1',
      NS: '#64748b'
    }

    return (
      <div className="relative bg-spatio-surface/40 border border-spatio-border p-2.5 rounded-xl">
        <div className="absolute top-2 right-3 text-[9px] font-sans font-black text-rose-550 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 shadow z-10">
          Global Moran's I = {slope.toFixed(4)}
        </div>

        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible select-none">
          {/* Quadrant Background Tints */}
          {/* I: HH (Top-Right) */}
          <rect x={margin.left + wQuad} y={margin.top} width={wQuad} height={hQuad} fill="#ef4444" fillOpacity={0.03} />
          {/* II: LH (Top-Left) */}
          <rect x={margin.left} y={margin.top} width={wQuad} height={hQuad} fill="#6366f1" fillOpacity={0.03} />
          {/* III: LL (Bottom-Left) */}
          <rect x={margin.left} y={margin.top + hQuad} width={wQuad} height={hQuad} fill="#3b82f6" fillOpacity={0.03} />
          {/* IV: HL (Bottom-Right) */}
          <rect x={margin.left + wQuad} y={margin.top + hQuad} width={wQuad} height={hQuad} fill="#ec4899" fillOpacity={0.03} />

          {/* Axes */}
          <line
            x1={margin.left}
            y1={yScale(0)}
            x2={width - margin.right}
            y2={yScale(0)}
            stroke="var(--color-border)"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
          <line
            x1={xScale(0)}
            y1={margin.top}
            x2={xScale(0)}
            y2={height - margin.bottom}
            stroke="var(--color-border)"
            strokeWidth={1}
            strokeDasharray="2 2"
          />

          {/* Borders */}
          <rect
            x={margin.left}
            y={margin.top}
            width={width - margin.left - margin.right}
            height={height - margin.top - margin.bottom}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={1}
          />

          {/* Axis Labels */}
          <text
            x={width - margin.right}
            y={yScale(0) + 12}
            fill="var(--color-muted)"
            fontSize={8}
            fontWeight="bold"
            textAnchor="end"
          >
            z (Std Value)
          </text>
          <text
            x={xScale(0) + 5}
            y={margin.top + 8}
            fill="var(--color-muted)"
            fontSize={8}
            fontWeight="bold"
            textAnchor="start"
          >
            Wz (Spatial Lag)
          </text>

          {/* Regression Line */}
          <line
            x1={xScale(x1)}
            y1={yScale(y1)}
            x2={xScale(x2)}
            y2={yScale(y2)}
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeLinecap="round"
          />

          {/* Data Points */}
          {currentResult.details.map((d: any, idx: number) => {
            const cx = xScale(d.stdValue)
            const cy = yScale(d.stdSpatialLag)
            const isHovered = hoveredPoint?.areaCode === d.areaCode
            const color = colors[d.type] || '#64748b'

            return (
              <circle
                key={idx}
                cx={cx}
                cy={cy}
                r={isHovered ? 6 : 3}
                fill={color}
                stroke={isHovered ? 'var(--color-text)' : 'var(--color-surface)'}
                strokeWidth={isHovered ? 1.5 : 0.5}
                opacity={isHovered ? 1.0 : 0.75}
                className="cursor-pointer transition-all duration-75"
                onMouseEnter={() => setHoveredPoint(d)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            )
          })}
        </svg>

        {/* Hovered Point info details overlay */}
        {hoveredPoint ? (
          <div className="mt-2 text-[10px] bg-spatio-surface border border-spatio-border p-2 rounded-lg flex items-center justify-between shadow-lg animate-scale-up text-spatio-text">
            <div>
              <span className="font-bold block text-spatio-text">{hoveredPoint.areaName}</span>
              <span className="text-spatio-muted">{t('ana_moran_scatter_value', { val: hoveredPoint.value, lag: hoveredPoint.spatialLag.toFixed(1) })}</span>
            </div>
            <div className="text-right">
              <span
                className="px-2 py-0.5 rounded font-black text-[9px] block text-center mb-1"
                style={{
                  backgroundColor: hoveredPoint.type === 'HH' ? '#ef444422' : hoveredPoint.type === 'LL' ? '#3b82f622' : hoveredPoint.type === 'HL' ? '#ec489922' : hoveredPoint.type === 'LH' ? '#6366f122' : '#64748b22',
                  color: hoveredPoint.type === 'HH' ? '#f87171' : hoveredPoint.type === 'LL' ? '#60a5fa' : hoveredPoint.type === 'HL' ? '#f472b6' : hoveredPoint.type === 'LH' ? '#818cf8' : '#94a3b8',
                  border: `1px solid ${colors[hoveredPoint.type]}33`
                }}
              >
                {hoveredPoint.type === 'NS' ? t('ana_moran_scatter_not_sig') : hoveredPoint.type}
              </span>
              <span className="text-[9px] text-spatio-muted font-semibold block">p-value: {hoveredPoint.pValue.toFixed(4)}</span>
            </div>
          </div>
        ) : (
          <div className="mt-2 text-[9px] text-spatio-muted font-bold text-center italic">
            {t('ana_moran_scatter_hover')}
          </div>
        )}
      </div>
    )
  }, [currentResult, hoveredPoint, currentStep, periods, isWide, t])

  // ──────────────────────────────────────────
  // Subcomponents: Renders settings panel
  // ──────────────────────────────────────────
  const renderSettingsPanel = () => {
    return (
      <div className="bg-spatio-surface/80 border border-spatio-border p-4 rounded-xl space-y-4 shadow-inner">
        <div className="flex items-center gap-1.5 border-b border-spatio-border pb-2">
          <Settings2 size={13} className="text-rose-500 dark:text-rose-400" />
          <span className="text-[11px] font-black text-spatio-text uppercase tracking-wider">{t('ana_param_panel')}</span>
        </div>

        {/* Adjacency Type selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-spatio-text flex items-center gap-1">
            <span>{t('ana_neighbor_def')}</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'inverse_distance', label: 'Inverse Dist' },
              { id: 'queen', label: 'Queen Contig' },
              { id: 'rook', label: 'Rook Contig' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setWeightType(item.id as any)}
                className={`py-1.5 px-2 rounded-lg border text-[10px] font-bold transition-all active:scale-95 cursor-pointer ${
                  weightType === item.id
                    ? 'bg-rose-500/10 border-rose-500/50 text-rose-650 dark:text-rose-300 font-black'
                    : 'bg-spatio-bg/50 border-spatio-border/50 text-spatio-muted hover:text-spatio-text'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Distance Band (Only visible when Inverse Distance) */}
        {weightType === 'inverse_distance' && (
          <div className="space-y-1.5 bg-spatio-bg/30 p-2.5 rounded-lg border border-spatio-border">
            <label className="text-[10px] font-bold text-spatio-text block">{t('ana_neighbor_radius')}</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={20}
                max={300}
                value={distanceBand}
                onChange={e => setDistanceBand(Number(e.target.value))}
                className="flex-1 accent-rose-500 cursor-pointer"
              />
              <span className="text-[10px] font-mono font-bold bg-spatio-bg text-rose-500 dark:text-rose-400 border border-spatio-border px-2 py-0.5 rounded shrink-0">
                {distanceBand}km
              </span>
            </div>
          </div>
        )}

        {/* Grid settings */}
        <div className="grid grid-cols-2 gap-3 text-[10px]">
          {/* Row standardization switch */}
          <div className="space-y-1.5">
            <label className="font-bold text-spatio-text">{t('ana_row_std')}</label>
            <button
              onClick={() => setRowStandardized(!rowStandardized)}
              className={`w-full py-1.5 rounded-lg border font-bold transition-all text-center cursor-pointer ${
                rowStandardized
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-black'
                  : 'bg-spatio-bg/30 border border-spatio-border text-spatio-muted'
              }`}
            >
              {rowStandardized ? t('ana_std_rec') : t('ana_std_disable')}
            </button>
          </div>

          {/* LISA Threshold selector */}
          <div className="space-y-1.5">
            <label className="font-bold text-spatio-text">{t('ana_p_val')}</label>
            <select
              value={lisaThreshold}
              onChange={e => setLisaThreshold(Number(e.target.value))}
              className="w-full py-1.5 px-2 bg-spatio-bg border border-spatio-border rounded-lg font-bold text-spatio-text focus:outline-none focus:border-rose-500 cursor-pointer text-[10px]"
            >
              <option value={0.05}>p &lt; 0.05 (มาตรฐาน)</option>
              <option value={0.01}>p &lt; 0.01 (เข้มงวด)</option>
              <option value={0.001}>p &lt; 0.001 (สูงมาก)</option>
            </select>
          </div>
        </div>

        {/* Permutation count selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-spatio-text block">{t('ana_permutations')}</label>
          <select
            value={numPermutations}
            onChange={e => setNumPermutations(Number(e.target.value))}
            className="w-full py-1.5 px-2 bg-spatio-bg border border-spatio-border rounded-lg font-bold text-spatio-text focus:outline-none focus:border-rose-500 text-[10px] cursor-pointer"
          >
            <option value={0}>{t('ana_moran_perm_none')}</option>
            <option value={99}>{t('ana_moran_perm_99')}</option>
            <option value={999}>{t('ana_moran_perm_999')}</option>
          </select>
        </div>
      </div>
    )
  }

  // ──────────────────────────────────────────
  // Subcomponents: Renders settings panel horizontally (Wide View)
  // ──────────────────────────────────────────
  const renderSettingsRowHorizontal = () => {
    return (
      <div className="bg-spatio-surface border border-spatio-border p-2.5 rounded-xl flex flex-wrap gap-4 items-center justify-between shadow-inner text-xs shrink-0 select-none">
        {/* Weight Type */}
        <div className="flex flex-col gap-1 min-w-[150px]">
          <span className="text-[9px] font-bold text-spatio-muted uppercase tracking-wider">{t('ana_neighbor_def')}</span>
          <div className="flex gap-1 bg-spatio-bg/50 p-0.5 rounded-lg border border-spatio-border/50">
            {[
              { id: 'inverse_distance', label: 'Inverse' },
              { id: 'queen', label: 'Queen' },
              { id: 'rook', label: 'Rook' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setWeightType(item.id as any)}
                className={`py-1 px-2 rounded border text-[9px] font-black transition-all active:scale-95 cursor-pointer ${
                  weightType === item.id
                    ? 'bg-rose-500/10 border-rose-500/40 text-rose-650 dark:text-rose-350 font-black'
                    : 'bg-transparent border-transparent text-spatio-muted hover:text-spatio-text'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Distance Band (Only when Inverse Distance) */}
        {weightType === 'inverse_distance' && (
          <div className="flex flex-col gap-1 flex-1 min-w-[170px] max-w-[220px]">
            <div className="flex justify-between items-center text-[9px] px-0.5">
              <span className="font-bold text-spatio-muted uppercase tracking-wider">{t('ana_neighbor_radius')}</span>
              <span className="font-mono font-black text-rose-500 dark:text-rose-400">{distanceBand}km</span>
            </div>
            <div className="flex items-center">
              <input
                type="range"
                min={20}
                max={300}
                value={distanceBand}
                onChange={e => setDistanceBand(Number(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer h-1 bg-spatio-bg rounded-lg appearance-none"
              />
            </div>
          </div>
        )}

        {/* Row Standardization */}
        <div className="flex flex-col gap-1 min-w-[90px]">
          <span className="text-[9px] font-bold text-spatio-muted uppercase tracking-wider">{t('ana_row_std')}</span>
          <button
            onClick={() => setRowStandardized(!rowStandardized)}
            className={`py-1 px-2 rounded-lg border font-bold text-[9.5px] transition-all text-center cursor-pointer ${
              rowStandardized
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-black'
                : 'bg-spatio-bg/30 border border-spatio-border text-spatio-muted hover:text-spatio-text'
            }`}
          >
            {rowStandardized ? t('ana_std_enable_short') : t('ana_std_disable_short')}
          </button>
        </div>

        {/* LISA Threshold */}
        <div className="flex flex-col gap-1 min-w-[110px]">
          <span className="text-[9px] font-bold text-spatio-muted uppercase tracking-wider">{t('ana_p_val')}</span>
          <select
            value={lisaThreshold}
            onChange={e => setLisaThreshold(Number(e.target.value))}
            className="py-1 px-2 bg-spatio-bg border border-spatio-border rounded-lg font-bold text-spatio-text focus:outline-none focus:border-rose-500 cursor-pointer text-[10px]"
          >
            <option value={0.05}>p &lt; 0.05</option>
            <option value={0.01}>p &lt; 0.01</option>
            <option value={0.001}>p &lt; 0.001</option>
          </select>
        </div>

        {/* Permutations */}
        <div className="flex flex-col gap-1 min-w-[150px]">
          <span className="text-[9px] font-bold text-spatio-muted uppercase tracking-wider">{t('ana_permutations')}</span>
          <select
            value={numPermutations}
            onChange={e => setNumPermutations(Number(e.target.value))}
            className="py-1 px-2 bg-spatio-bg border border-spatio-border rounded-lg font-bold text-spatio-text focus:outline-none focus:border-rose-500 text-[10px] cursor-pointer"
          >
            <option value={0}>{t('ana_moran_perm_none_short')}</option>
            <option value={99}>{t('ana_moran_perm_99_short')}</option>
            <option value={999}>{t('ana_moran_perm_999_short')}</option>
          </select>
        </div>

        {/* Close Studio Button inside Top Row settings */}
        <button
          onClick={onClose}
          className="self-end py-1.5 px-3 rounded-lg border border-spatio-border bg-spatio-bg/50 hover:bg-black/5 dark:hover:bg-white/10 text-[10px] font-black text-rose-505 dark:text-rose-400 hover:text-rose-600 transition-all shadow active:scale-95 flex items-center justify-center gap-1 cursor-pointer shrink-0"
        >
          ✕ {t('ana_moran_close_map')}
        </button>
      </div>
    )
  }

  // ──────────────────────────────────────────
  // Main Return Layout (Stretches dynamically based on isWide)
  // ──────────────────────────────────────────
  return (
    <div className="space-y-4 animate-fade-in text-spatio-text h-full flex flex-col min-h-0">
      {/* 1. Header Info section */}
      <div className="space-y-1 shrink-0">
        <span className="text-[10px] font-black text-rose-500 dark:text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
          <Flame size={12} className="animate-bounce" />
          <span>Local Autocorrelation (LISA & Scatter Plot Studio)</span>
        </span>
        <p className="text-[10px] text-spatio-muted leading-relaxed">
          {t('ana_moran_info')}
        </p>
      </div>

      {/* Performance Warning level-subdistrict */}
      {adminLevel === 'subdistrict' && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20 p-2.5 rounded-xl flex gap-2 items-start text-[10px] leading-relaxed text-amber-800 dark:text-amber-400 shrink-0">
          <AlertTriangle size={14} className="shrink-0 mt-0.5 animate-pulse text-amber-600 dark:text-amber-450" />
          <div>
            <strong className="block text-amber-700 dark:text-amber-300 font-bold">{t('ana_moran_warn_title')}</strong>
            {t('ana_moran_warn_desc')}
          </div>
        </div>
      )}

      {/* Calculate Progress Bar (Only standard layout handles it this way, Wide layout renders below settings) */}
      {!isWide && isCalculating && (
        <div className="bg-spatio-bg/50 border border-spatio-border p-4 rounded-xl space-y-2 shrink-0 animate-pulse">
          <div className="flex justify-between items-center text-[10px] font-bold">
            <span className="text-rose-500 dark:text-rose-400">{progressMsg}</span>
            <span className="font-mono text-spatio-muted">{progressPercent}%</span>
          </div>
          <div className="w-full bg-spatio-bg rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-rose-500 to-orange-500 h-1.5 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* 2. Grid split layout (if isWide is true) */}
      <div className="flex-1 min-h-0 flex flex-col">
        {isWide ? (
          <div className="flex-1 flex flex-col gap-4 min-h-0 h-full pb-1">
            {/* Horizontal Settings Row at the top */}
            {renderSettingsRowHorizontal()}

            {/* Calculate Progress Bar inside Wide Layout */}
            {isCalculating && (
              <div className="bg-spatio-bg/50 border border-spatio-border p-4 rounded-xl space-y-2 shrink-0 animate-pulse">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-rose-550 dark:text-rose-400">{progressMsg}</span>
                  <span className="font-mono text-spatio-muted">{progressPercent}%</span>
                </div>
                <div className="w-full bg-spatio-bg rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-rose-500 to-orange-500 h-1.5 transition-all duration-300 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Calculations and tables below */}
            {!isCalculating && currentResult && (
              <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto no-scrollbar pb-2">
                {/* Results metrics Grid */}
                <div className="bg-spatio-bg/30 border border-spatio-border p-3 rounded-xl text-[10px] grid grid-cols-4 gap-4 shadow-sm shrink-0">
                  <div className="border-r border-spatio-border pr-2">
                    <span className="text-spatio-muted font-bold block mb-1">{t('ana_moran_week_curr')}</span>
                    <strong className="text-rose-550 dark:text-rose-400 text-[11px] font-black">{currentPeriod?.label}</strong>
                  </div>
                  <div className="border-r border-spatio-border pr-2">
                    <span className="text-spatio-muted font-bold block mb-1">Global Moran's I:</span>
                    <strong className="text-spatio-text text-[11px] font-mono font-black">{currentResult.moranIndex.toFixed(4)}</strong>
                  </div>
                  <div className="border-r border-spatio-border pr-2">
                    <span className="text-spatio-muted font-bold block mb-1">Z-Score | p-value:</span>
                    <strong className="text-spatio-text text-[11px] font-mono font-bold block">
                      {currentResult.zScore.toFixed(3)} | <span className="text-emerald-500">{currentResult.pValue.toFixed(4)}</span>
                    </strong>
                  </div>
                  <div>
                    <span className="text-spatio-muted font-bold block mb-1">{t('ana_moran_conclusion')}</span>
                    <strong className={`text-[11px] block font-black ${
                      currentResult.conclusion === 'Clustered' ? 'text-rose-600 dark:text-rose-400' : currentResult.conclusion === 'Dispersed' ? 'text-blue-600 dark:text-blue-400' : 'text-spatio-muted'
                    }`}>
                      {currentResult.conclusion === 'Clustered' ? t('ana_moran_clustered') : currentResult.conclusion === 'Dispersed' ? t('ana_moran_dispersed') : t('ana_moran_random')}
                    </strong>
                  </div>
                </div>

                {/* Scatter Plot and LISA significant areas table Side-by-Side */}
                <div className="grid grid-cols-12 gap-5 flex-1 min-h-0 items-stretch">
                  {/* Left half: Scatter Plot */}
                  <div className="col-span-5 flex flex-col gap-1.5 min-h-0">
                    <span className="text-[10px] font-bold text-spatio-muted block tracking-wider uppercase">Moran Scatter Plot:</span>
                    <div className="flex-1 flex flex-col justify-center animate-fade-in">
                      {scatterPlotSvg}
                    </div>
                  </div>

                  {/* Right half: Significant Areas Table */}
                  <div className="col-span-7 flex flex-col gap-1.5 min-h-0">
                    <span className="text-[10px] font-bold text-spatio-muted block tracking-wider uppercase">
                      {t('ana_moran_sig_areas', { count: significantAreas.length })}
                    </span>
                    
                    <div className="bg-spatio-surface/40 border border-spatio-border rounded-xl overflow-hidden shadow-md flex-1 flex flex-col min-h-0">
                      <div className="overflow-y-auto flex-1 custom-scrollbar max-h-[220px]">
                        {significantAreas.length === 0 ? (
                          <div className="p-8 text-center text-spatio-muted italic text-[10px]">
                            {t('ana_moran_no_sig', { threshold: lisaThreshold })}
                          </div>
                        ) : (
                          <table className="w-full text-left text-[10px]">
                            <thead className="bg-spatio-bg text-spatio-muted font-bold sticky top-0 border-b border-spatio-border z-20">
                              <tr>
                                <th className="px-3 py-1.5">{t('ana_moran_col_area')}</th>
                                <th className="px-3 py-1.5 text-center">{t('ana_moran_col_lisa')}</th>
                                <th className="px-3 py-1.5 text-right">{t('ana_moran_col_val')}</th>
                                <th className="px-3 py-1.5 text-right">p-value</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-spatio-border">
                              {significantAreas.map((area: any, idx: number) => {
                                const colors: Record<string, string> = {
                                  HH: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
                                  LL: 'bg-blue-500/10 text-blue-650 dark:text-blue-400 border border-blue-500/20',
                                  HL: 'bg-pink-500/10 text-pink-650 dark:text-pink-400 border border-pink-500/20',
                                  LH: 'bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 border border-indigo-500/20'
                                }

                                return (
                                  <tr
                                    key={idx}
                                    className={`hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer ${
                                      hoveredPoint?.areaCode === area.areaCode ? 'bg-black/5 dark:bg-white/10' : ''
                                    }`}
                                    onMouseEnter={() => setHoveredPoint(area)}
                                    onMouseLeave={() => setHoveredPoint(null)}
                                  >
                                    <td className="px-3 py-2 font-bold text-spatio-text max-w-[150px] truncate">{area.areaName}</td>
                                    <td className="px-3 py-2 text-center">
                                      <span className={`px-1.5 py-0.5 rounded font-black text-[8.5px] ${colors[area.type]}`}>
                                        {area.type}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-spatio-muted">{area.value}</td>
                                    <td className="px-3 py-2 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">{area.pValue.toFixed(4)}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Standard vertical layout (if isWide is false) */
          <div className="space-y-4 flex-1 overflow-y-auto no-scrollbar">
            {renderSettingsPanel()}

            {!isCalculating && currentResult && (
              <div className="space-y-4 animate-scale-up">
                {/* Summary Box */}
                <div className="bg-spatio-bg/30 border border-spatio-border p-3 rounded-xl space-y-1.5 text-[10px]">
                  <div className="flex justify-between items-center border-b border-spatio-border pb-1.5 mb-1.5">
                    <span className="font-bold text-spatio-muted">{t('ana_moran_conclusion_curr')}</span>
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-sans font-bold">
                      {currentPeriod?.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-spatio-text">
                    <div className="flex justify-between">
                      <span className="text-spatio-muted">Global Moran's I:</span>
                      <strong className="text-spatio-text font-mono">{currentResult.moranIndex.toFixed(4)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-spatio-muted">Expected:</span>
                      <strong className="text-spatio-muted font-mono">{currentResult.expectedValue.toFixed(4)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-spatio-muted">Z-Score:</span>
                      <strong className="text-spatio-text font-mono">{currentResult.zScore.toFixed(3)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-spatio-muted">P-Value:</span>
                      <strong className={`font-mono ${currentResult.pValue < 0.05 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-spatio-text'}`}>
                        {currentResult.pValue.toFixed(4)}
                      </strong>
                    </div>
                  </div>

                  <div className="flex justify-between items-center border-t border-spatio-border pt-1.5 mt-1.5 font-bold">
                    <span className="text-spatio-muted">{t('ana_moran_trend')}</span>
                    <span className={`px-2 py-0.5 rounded font-black ${
                      currentResult.conclusion === 'Clustered'
                        ? 'bg-rose-500/10 text-rose-650 dark:text-rose-400 border border-rose-500/20'
                        : currentResult.conclusion === 'Dispersed'
                        ? 'bg-blue-500/10 text-blue-650 dark:text-blue-400 border border-blue-500/20'
                        : 'bg-spatio-bg text-spatio-muted border border-spatio-border/55'
                    }`}>
                      {currentResult.conclusion === 'Clustered' ? t('ana_moran_clustered') : currentResult.conclusion === 'Dispersed' ? t('ana_moran_dispersed') : t('ana_moran_random')}
                    </span>
                  </div>
                </div>

                {/* SVG Scatter Plot */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-spatio-muted block tracking-wider uppercase">Moran Scatter Plot:</span>
                  {scatterPlotSvg}
                </div>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-spatio-border bg-spatio-bg/50 hover:bg-black/5 dark:hover:bg-white/10 text-[11px] font-bold text-spatio-muted hover:text-spatio-text transition-all shadow active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>{t('ana_moran_close_view')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
