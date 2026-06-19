import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'
import { 
  calculateMoransI, 
  calculateCorrelation, 
  extractCentroid,
  calculateDistance
} from '../data/spatialStats'
import { locationResolver } from '../data/locationResolver'
import { registry } from '../data/registry'
import { getActiveCoordinatesSlice, mountPointLayer } from '../map/pointLayer'
import { Sparkles, Sliders, Flame, TrendingUp, BarChart2, Compass, Lock, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'
import { parseDate, toDateKey } from '../data/dateParser'
import { MoranPanel } from '../components/AnalysisPanel/MoranPanel'
import { ClusterPanel } from '../components/AnalysisPanel/ClusterPanel'
import { CorrelationPanel } from '../components/AnalysisPanel/CorrelationPanel'
import { DriftPanel } from '../components/AnalysisPanel/DriftPanel'
import { InterpPanel } from '../components/AnalysisPanel/InterpPanel'

// ──────────────────────────────────────────
// Hex colour helper (self-contained)
// ──────────────────────────────────────────
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
  if (index < 0) return '#475569'
  const hue = (index * 360) / Math.max(1, total)
  return hslToHex(hue, 85, 55)
}

export function Analysis() {
  const {
    rawRows,
    dataKeys,
    periods,
    currentStep,
    ingestionMode,
    geoMode,
    adminLevel,
    dictionary,
    palette,
    groupingMode,
    setDictionary,
    setColorMode,
    setDataKeys,
    setRawRows,
    notify
  } = useAppStore()

  // Selected tool tab (5 tabs matching full specifications)
  const [activeTab, setActiveTab] = useState<'hotspot' | 'morans' | 'interp' | 'corr' | 'drift'>('morans')

  // DBSCAN States
  const [eps, setEps] = useState<number>(30) // km
  const [minPts, setMinPts] = useState<number>(4)
  const [dbscanRes, setDbscanRes] = useState<any | null>(null)
  const [isDBSCANApplied, setIsDBSCANApplied] = useState(false)
  const [originalColorKey, setOriginalColorKey] = useState<string | null>(null)
  const [isComputing, setIsComputing] = useState(false)
  const [computeProgress, setComputeProgress] = useState(0)
  const dbscanWorkerRef = useRef<Worker | null>(null)

  // Moran's I States
  const [distanceBand, setDistanceBand] = useState<number>(100) // km
  const [moransRes, setMoransRes] = useState<any | null>(null)
  const [isMoranApplied, setIsMoranApplied] = useState(false)
  const [originalDictionary, setOriginalDictionary] = useState<any | null>(null)
  const [isComputingMoran, setIsComputingMoran] = useState(false)
  const [moranProgress, setMoranProgress] = useState(0)
  const moranWorkerRef = useRef<Worker | null>(null)

  // IDW Interpolation States
  const [idwPower, setIdwPower] = useState<number>(2)
  const [idwRadius, setIdwRadius] = useState<number>(150) // km
  const [interpolatedPoints, setInterpolatedPoints] = useState<any[] | null>(null)

  // Correlation States
  const [xCol, setXCol] = useState<string>('')
  const [yCol, setYCol] = useState<string>('')
  const [corrRes, setCorrRes] = useState<any | null>(null)

  // Spatiotemporal Drift States
  const [driftRes, setDriftRes] = useState<any | null>(null)

  // Detect which of the 6 data profiles is loaded
  const dataProfile = useMemo(() => {
    if (rawRows.length === 0) return null

    const hasValue = !!dataKeys.value
    const isCoord = geoMode === 'coordinate' || (!!dataKeys.lat && !!dataKeys.lng)
    const isTS = periods.length > 1

    if (!isCoord) {
      // Area-based
      return isTS
        ? { id: 1, title: 'ตัวเลข รายพื้นที่ รายเวลา (Dynamic Area Counts)', type: 'Area' }
        : { id: 2, title: 'ตัวเลข รายพื้นที่ สะสมคงที่ (Static Area Counts)', type: 'Area' }
    } else {
      // Point/Coord-based
      if (!hasValue) {
        return isTS
          ? { id: 3, title: 'พิกัด รายเวลา เคสรายบุคคล (Dynamic Case Coordinates)', type: 'Coordinate' }
          : { id: 4, title: 'พิกัด สะสมคงที่ เคสรายบุคคล (Static Case Coordinates)', type: 'Coordinate' }
      } else {
        return isTS
          ? { id: 5, title: 'พิกัด + ค่าที่วัดได้ รายเวลา (Dynamic Measurement Stations)', type: 'Measurement' }
          : { id: 6, title: 'พิกัด + ค่าที่วัดได้ คงที่ (Static Measurement Stations)', type: 'Measurement' }
      }
    }
  }, [rawRows, dataKeys, geoMode, periods])

  // Get active columns for numerical correlation analysis
  const numericColumns = useMemo(() => {
    if (rawRows.length === 0) return []
    const firstRow = rawRows[0]
    return Object.keys(firstRow).filter(k => {
      const val = firstRow[k]
      return typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val.replace(/,/g, '').trim())))
    })
  }, [rawRows])

  // Check compatibility for each of the 5 tabs based on the active data profile
  const tabSuitability = useMemo(() => {
    if (!dataProfile) {
      return {
        interp: false,
        drift: false,
        morans: false,
        hotspot: false,
        corr: false,
      }
    }

    const hasValue = !!dataKeys.value
    const isCoord = geoMode === 'coordinate' || (!!dataKeys.lat && !!dataKeys.lng)
    const isTS = periods.length > 1

    return {
      interp: isCoord && hasValue, // Profile 5 & 6
      drift: isTS,                // Profile 1, 3, 5
      morans: !isCoord,            // Profile 1 & 2
      hotspot: isCoord,            // Profile 3, 4, 5, 6
      corr: numericColumns.length >= 2,
    }
  }, [dataProfile, dataKeys.value, geoMode, dataKeys.lat, dataKeys.lng, periods.length, numericColumns.length])

  // Auto-select first compatible tab when profile loads
  useEffect(() => {
    if (!dataProfile) return
    const order: ('morans' | 'hotspot' | 'interp' | 'drift' | 'corr')[] = ['morans', 'hotspot', 'interp', 'drift', 'corr']
    const firstCompatible = order.find(tab => tabSuitability[tab])
    if (firstCompatible && !tabSuitability[activeTab]) {
      setActiveTab(firstCompatible)
    }
  }, [dataProfile, tabSuitability, activeTab])

  // Set default correlation columns
  useEffect(() => {
    if (numericColumns.length >= 2) {
      setXCol(numericColumns[0])
      setYCol(numericColumns[1])
    }
  }, [numericColumns])

  // Reset tools when dataset changes
  useEffect(() => {
    setDbscanRes(null)
    setIsDBSCANApplied(false)
    setMoransRes(null)
    setIsMoranApplied(false)
    setInterpolatedPoints(null)
    setCorrRes(null)
    setDriftRes(null)
  }, [rawRows])

  // Clean up workers on unmount
  useEffect(() => {
    return () => {
      if (dbscanWorkerRef.current) dbscanWorkerRef.current.terminate()
      if (moranWorkerRef.current) moranWorkerRef.current.terminate()
    }
  }, [])

  if (rawRows.length === 0) {
    return (
      <div className="p-8 max-w-4xl mx-auto flex flex-col justify-center items-center h-full text-center space-y-6 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center shadow-xl">
          <AlertCircle size={32} className="text-blue-500 animate-pulse" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-black text-white">ยังไม่มีข้อมูลนำเข้าในระบบวิเคราะห์</h2>
          <p className="text-xs text-slate-400 max-w-md leading-relaxed">
            กรุณาไปที่หน้านำเข้าข้อมูล [หน้าแรก] แล้วเปิดไฟล์ตารางระบาดวิทยา (.xlsx, .xls, .csv) เพื่อใช้งานสตูดิโอวิเคราะห์สถิติเชิงพื้นที่ขั้นสูง
          </p>
        </div>

        {/* Informative Profiles Card */}
        <div className="spatio-card p-5 w-full border border-slate-800 text-left space-y-3 shadow-2xl bg-slate-900/40">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block border-b border-slate-850 pb-2">
            💡 รูปแบบข้อมูลวิเคราะห์เชิงพื้นที่ 6 โปรไฟล์:
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px] text-slate-400 leading-normal">
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40">
              <span className="text-white font-bold block mb-1">📊 1. ตัวเลข รายพื้นที่ รายเวลา [Dynamic Area]</span>
              วิเคราะห์ดัชนี Moran's I & LISA แยกหมวดหมู่ความเร็วการระบาดเชิงสัปดาห์
            </div>
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40">
              <span className="text-white font-bold block mb-1">📈 2. ตัวเลข รายพื้นที่ สะสม [Static Area]</span>
              คำนวณสหสัมพันธ์เพื่อนบ้านเชิงพื้นที่ขอบเขตสรุปยอดรวมคงที่
            </div>
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40">
              <span className="text-white font-bold block mb-1">📍 3. พิกัดจริง รายเวลา [Dynamic Coordinates]</span>
              ประมวลผลจับกลุ่มก้อนคลัสเตอร์ระบาดด่วนพิเศษ (DBSCAN) และจุดหนาแน่นรายสัปดาห์
            </div>
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40">
              <span className="text-white font-bold block mb-1">🎯 4. พิกัดจริง สะสม [Static Coordinates]</span>
              ประมวลผลจัดกลุ่มความหนาแน่นของผู้ป่วยเชิงพิกัดกายภาพสะสมคงที่
            </div>
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40">
              <span className="text-white font-bold block mb-1">🌧️ 5. พิกัด + ค่าที่วัด รายเวลา [Dynamic Stations]</span>
              ประมาณค่าพื้นผิวต่อเนื่องจากจุดตรวจวัดรายคาบเวลา (IDW Interpolation)
            </div>
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40">
              <span className="text-white font-bold block mb-1">🔬 6. พิกัด + ค่าที่วัด สะสม [Static Stations]</span>
              สร้างพื้นผิวค่าตัวชี้วัดมลพิษ/สิ่งแวดล้อมเชิงพื้นที่ต่อสัปดาห์คงที่
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ──────────────────────────────────────────
  // TOOL 1: Moran's I Execution (Web Worker)
  // ──────────────────────────────────────────
  const runMoranAnalysis = async () => {
    if (!periods || periods.length === 0) return

    if (moranWorkerRef.current) {
      moranWorkerRef.current.terminate()
      moranWorkerRef.current = null
    }

    notify('info', 'กำลังประมวลผลสถิติความสัมพันธ์เพื่อนบ้านเชิงพื้นที่ Moran\'s I ทุกช่วงเวลาบนไทม์ไลน์...')
    setIsComputingMoran(true)
    setMoranProgress(0)

    try {
      await locationResolver.init()
      
      // Back up original dictionary
      if (!originalDictionary) {
        setOriginalDictionary(JSON.parse(JSON.stringify(dictionary)))
      }

      const features = registry.getFeatures(adminLevel)
      const areasByPeriod: Record<string, any[]> = {}

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

      // Spawn background worker using Vite-standard URL constructor
      const worker = new Worker(
        new URL('../workers/moranWorker.ts', import.meta.url),
        { type: 'module' }
      )
      moranWorkerRef.current = worker

      worker.onmessage = (e: MessageEvent) => {
        const { type, percent, periodKey, results, message } = e.data

        if (type === 'PROGRESS') {
          setMoranProgress(percent)
        } else if (type === 'DONE') {
          setIsComputingMoran(false)
          worker.terminate()
          moranWorkerRef.current = null

          const baseDict = originalDictionary || dictionary
          const dictCopy = JSON.parse(JSON.stringify(baseDict))

          const colors: Record<string, string> = {
            HH: '#ef4444',
            LL: '#3b82f6',
            HL: '#ec4899',
            LH: '#6366f1',
            NS: '#cbd5e1'
          }

          let lastRes: any = null
          Object.entries(results).forEach(([pKey, resObj]: [string, any]) => {
            const slice = dictCopy[pKey]
            if (!slice) return
            lastRes = resObj

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

          if (lastRes) {
            setMoransRes(lastRes)
          }
          setDictionary(dictCopy)
          setColorMode('custom')
          setIsMoranApplied(true)

          notify('success', `คำนวณและประยุกต์ LISA Hotspots ทั้งไทม์ไลน์เรียบร้อย! Moran's Index ล่าสุด = ${lastRes?.moranIndex?.toFixed(3) ?? '—'}`)

          setTimeout(() => {
            (window as any).setActivePage?.('explorer')
          }, 800)
        } else if (type === 'ERROR') {
          notify('error', `เกิดข้อผิดพลาดในการวิเคราะห์: ${message}`)
          setIsComputingMoran(false)
          worker.terminate()
          moranWorkerRef.current = null
        }
      }

      worker.postMessage({
        type: 'RUN',
        periods,
        areasByPeriod,
        adjacency: null, // Always Inverse Distance inside MoranPanel
        options: {
          weightType: 'inverse_distance',
          distanceBandKm: distanceBand,
          rowStandardized: true,
          numPermutations: 999,
          lisaThreshold: 0.05
        },
        adminLevel
      })

    } catch (err: any) {
      notify('error', `เกิดข้อผิดพลาดในการวิเคราะห์: ${err.message}`)
      setIsComputingMoran(false)
    }
  }

  const applyMoranToMap = () => {
    if (!moransRes || !periods || periods.length === 0) return
    const currentPeriod = periods[currentStep]
    const periodKey = currentPeriod.key

    // Back up original dictionary
    if (!originalDictionary) {
      setOriginalDictionary(JSON.parse(JSON.stringify(dictionary)))
    }

    // Inject LISA colors into current period dictionary
    const dictCopy = JSON.parse(JSON.stringify(dictionary))
    const slice = dictCopy[periodKey]

    if (!slice) return

    // Color definitions
    const colors: Record<string, string> = {
      HH: '#ef4444',
      LL: '#3b82f6',
      HL: '#ec4899',
      LH: '#6366f1',
      NS: '#cbd5e1'
    }

    moransRes.details.forEach((item: any) => {
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

    setDictionary(dictCopy)
    setColorMode('custom')
    setIsMoranApplied(true)
    notify('success', 'พล็อตสี LISA Hotspots ลงแผนที่เรียบร้อยแล้ว!')
  }

  const resetMoranFromMap = () => {
    if (originalDictionary) {
      setDictionary(originalDictionary)
      setOriginalDictionary(null)
    }
    (window as any).driftRes = null
    setColorMode('value')
    setIsMoranApplied(false)
    notify('info', 'ล้างเลเยอร์สถิติความสัมพันธ์เชิงพื้นที่แล้ว')
  }

  // ──────────────────────────────────────────
  // TOOL 2: DBSCAN via Web Worker (background)
  // ──────────────────────────────────────────
  const runDBSCANAnalysis = useCallback(() => {
    if (rawRows.length === 0) {
      notify('error', 'ไม่มีข้อมูลสำหรับวิเคราะห์')
      return
    }

    // Terminate old worker if any
    if (dbscanWorkerRef.current) {
      dbscanWorkerRef.current.terminate()
      dbscanWorkerRef.current = null
    }

    notify('info', 'กำลังประมวลผล DBSCAN Clustering ใน background worker...')
    setIsComputing(true)
    setComputeProgress(0)

    if (!originalColorKey) {
      setOriginalColorKey(dataKeys.color || '')
    }

    // Collect ALL points from ALL periods (one flat pass)
    const allPoints: { lat: number; lng: number; periodKey: string; rowLat: number; rowLng: number }[] = []
    for (const p of periods) {
      const slice = getActiveCoordinatesSlice([p.key])
      slice.forEach(pt => allPoints.push({ lat: pt.lat, lng: pt.lng, periodKey: p.key, rowLat: pt.lat, rowLng: pt.lng }))
    }

    if (allPoints.length === 0) {
      notify('error', 'ไม่มีข้อมูลพิกัดจุดเพียงพอ')
      setIsComputing(false)
      return
    }

    // Launch worker
    const worker = new Worker(
      new URL('../workers/dbscanWorker.ts', import.meta.url),
      { type: 'module' }
    )
    dbscanWorkerRef.current = worker

    worker.postMessage({
      type: 'RUN',
      points: allPoints.map(p => ({ lat: p.lat, lng: p.lng })),
      epsKm: eps,
      minPts,
    })

    worker.onmessage = (e) => {
      const { type, percent, labels, numClusters, noiseCount, clusterSizes, message } = e.data

      if (type === 'PROGRESS') {
        setComputeProgress(percent)
        return
      }

      if (type === 'ERROR') {
        notify('error', `DBSCAN worker error: ${message}`)
        setIsComputing(false)
        worker.terminate()
        dbscanWorkerRef.current = null
        return
      }

      if (type === 'DONE') {
        setIsComputing(false)
        worker.terminate()
        dbscanWorkerRef.current = null

        // Apply colors to rawRows
        const rowsCopy = JSON.parse(JSON.stringify(rawRows))
        labels.forEach((label: number, idx: number) => {
          const pt = allPoints[idx]
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
                return Math.abs(lat - pt.lat) < 0.0001 && Math.abs(lng - pt.lng) < 0.0001 && rKey === pt.periodKey
              }
            }
            return Math.abs(lat - pt.lat) < 0.0001 && Math.abs(lng - pt.lng) < 0.0001
          })

          if (rowIdx !== -1) {
            rowsCopy[rowIdx]._dbscan_color = getClusterHex(label, numClusters)
          }
        })

        setDbscanRes({ labels, numClusters, noiseCount, clusterSizes, points: allPoints })

        const state = useAppStore.getState()
        const meta = state.datasets.find(d => d.id === state.activeDatasetId) || state.datasets[state.datasets.length - 1]
        setRawRows(rowsCopy, {
          ...meta,
          keys: { ...dataKeys, color: '_dbscan_color' }
        })

        setColorMode('custom')
        setIsDBSCANApplied(true)

        setTimeout(() => { mountPointLayer() }, 100)
        notify('success', `DBSCAN สำเร็จ! พบ ${numClusters} คลัสเตอร์ (noise: ${noiseCount} จุด)`)
        setTimeout(() => { (window as any).setActivePage?.('explorer') }, 800)
      }
    }

    worker.onerror = (err) => {
      notify('error', `Worker error: ${err.message}`)
      setIsComputing(false)
    }
  }, [rawRows, periods, eps, minPts, dataKeys, groupingMode, originalColorKey, notify, setRawRows, setColorMode])


  const applyDBSCANToMap = () => {
    if (!dbscanRes || rawRows.length === 0) return

    notify('info', 'กำลังลงสีคลัสเตอร์บนจุดพิกัด Leaflet...')

    if (!originalColorKey) {
      setOriginalColorKey(dataKeys.color || '')
    }

    const rowsCopy = JSON.parse(JSON.stringify(rawRows))
    const slice = getActiveCoordinatesSlice()

    dbscanRes.labels.forEach((label: number, idx: number) => {
      const pt = dbscanRes.points[idx]
      if (!pt) return

      const originalRowIdx = rawRows.findIndex(row => {
        const lat = parseFloat(String(row[dataKeys.lat] || '').trim())
        const lng = parseFloat(String(row[dataKeys.lng] || '').trim())
        return Math.abs(lat - pt.lat) < 0.0001 && Math.abs(lng - pt.lng) < 0.0001
      })

      if (originalRowIdx !== -1) {
        const hexColor = getClusterHex(label, dbscanRes.numClusters)
        rowsCopy[originalRowIdx]._dbscan_color = hexColor
      }
    })

    const state = useAppStore.getState()
    const meta = state.datasets.find(d => d.id === state.activeDatasetId) || state.datasets[state.datasets.length - 1]
    setRawRows(rowsCopy, {
      ...meta,
      keys: {
        ...dataKeys,
        color: '_dbscan_color'
      }
    })
    
    setColorMode('custom')
    setIsDBSCANApplied(true)

    setTimeout(() => {
      mountPointLayer()
    }, 100)

    notify('success', `ลงสีคลัสเตอร์ระบาดจุด ${dbscanRes.numClusters} สี เรียบร้อยแล้ว!`)
  }

  const resetDBSCANFromMap = () => {
    if (originalColorKey !== null) {
      const state = useAppStore.getState()
      const meta = state.datasets.find(d => d.id === state.activeDatasetId) || state.datasets[state.datasets.length - 1]
      const cleanRows = rawRows.map((row: any) => {
        delete row._dbscan_color
        return row
      })
      setRawRows(cleanRows, {
        ...meta,
        keys: {
          ...dataKeys,
          color: originalColorKey
        }
      })
      setOriginalColorKey(null)
    }

    (window as any).driftRes = null
    setColorMode('value')
    setIsDBSCANApplied(false)

    setTimeout(() => {
      mountPointLayer()
    }, 100)

    notify('info', 'ล้างสีกำหนดของกลุ่มก้อนคลัสเตอร์จุดแล้ว')
  }

  // ──────────────────────────────────────────
  // TOOL 3: IDW Interpolation
  // ──────────────────────────────────────────
  const runIDWInterpolation = () => {
    const slice = getActiveCoordinatesSlice()
    const pointsWithVal = slice.filter(p => p.value > 0)

    if (pointsWithVal.length < 3) {
      notify('error', 'ต้องการสถานีที่มีค่าเฉลี่ยตรวจวัดมากกว่า 0 อย่างน้อย 3 จุด ในการประมาณค่าเชิงพื้นที่')
      return
    }

    notify('info', 'กำลังประมวลผลพื้นผิวการประมาณค่า IDW (Inverse Distance Weighting)...')


    // Find bounding box
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180
    pointsWithVal.forEach(p => {
      if (p.lat < minLat) minLat = p.lat
      if (p.lat > maxLat) maxLat = p.lat
      if (p.lng < minLng) minLng = p.lng
      if (p.lng > maxLng) maxLng = p.lng
    })

    // Create a grid of 10 sample query points across the bounding box (representative of regions)
    const samples: any[] = []
    const latStep = (maxLat - minLat) / 4
    const lngStep = (maxLng - minLng) / 4

    let index = 1
    for (let r = 0; r < 3; r++) {
      const qLat = minLat + r * latStep + latStep/2
      for (let c = 0; c < 3; c++) {
        const qLng = minLng + c * lngStep + lngStep/2

        // Run IDW formula
        let num = 0
        let den = 0
        let closestDist = Infinity
        let value = 0

        for (const pt of pointsWithVal) {
          const dist = calculateDistance(pt.lat, pt.lng, qLat, qLng)
          if (dist < closestDist) closestDist = dist
          if (dist === 0) {
            value = pt.value
            break
          }
          if (dist > idwRadius) continue

          const w = 1 / Math.pow(dist, idwPower)
          num += w * pt.value
          den += w
        }

        if (closestDist > 0 && den > 0) {
          value = num / den
        }

        samples.push({
          id: index++,
          lat: qLat,
          lng: qLng,
          value,
          closestDist
        })
      }
    }

    setInterpolatedPoints(samples)
    notify('success', 'คำนวณประมาณพื้นผิว IDW สำเร็จ!')

    // Auto redirect to map explorer
    setTimeout(() => {
      (window as any).setActivePage?.('explorer')
    }, 800)
  }

  // ──────────────────────────────────────────
  // TOOL: Spatiotemporal Drift Execution
  // ──────────────────────────────────────────
  const runDriftAnalysis = async () => {
    if (!periods || periods.length < 2) {
      notify('error', 'การคำนวณจุดศูนย์กลางหลั่งไหลระบาด (Drift) ต้องการข้อมูลอนุกรมเวลาอย่างน้อย 2 ช่วงเวลา (Dynamic Mode)')
      return
    }

    notify('info', 'กำลังประมวลผลวิเคราะห์จุดศูนย์กลางการระบาดเยื้องตัวตามเวลา (Centroid Drift)...')
    try {
      await locationResolver.init()
      const trajectory: any[] = []

      for (const p of periods) {
        const periodKey = p.key
        const slice = dictionary[periodKey]
        if (!slice) continue

        let sumLat = 0
        let sumLng = 0
        let totalVal = 0

        if (geoMode === 'coordinate') {
          // Points
          const points = getActiveCoordinatesSlice([periodKey])
          points.forEach(pt => {
            if (pt.value > 0) {
              sumLat += pt.lat * pt.value
              sumLng += pt.lng * pt.value
              totalVal += pt.value
            }
          })
        } else {
          // Admin Boundaries
          const features = registry.getFeatures(adminLevel)
          features.forEach(f => {
            const props = f.properties
            const resolved = locationResolver.resolve(
              String(props.P_Name_T ?? props.PV_TN ?? ''),
              adminLevel === 'province' ? '' : String(props.A_Name_T ?? props.AM_TN ?? ''),
              adminLevel === 'subdistrict' ? String(props.T_Name_T ?? props.TB_TN ?? '') : ''
            )
            if (!resolved) return

            const pCode = resolved.pCode
            const aCode = resolved.aCode
            const tCode = resolved.tCode

            let val = 0
            const pData = slice[pCode]
            if (pData) {
              if (adminLevel === 'province') val = pData._total || 0
              else if (adminLevel === 'district' && aCode) val = pData.districts[aCode]?._total || 0
              else if (adminLevel === 'subdistrict' && tCode) val = pData.districts[aCode]?.subdistricts[tCode] || 0
            }

            const centroid = extractCentroid(f.geometry)
            if (centroid && val > 0) {
              sumLat += centroid[0] * val
              sumLng += centroid[1] * val
              totalVal += val
            }
          })
        }

        if (totalVal > 0) {
          trajectory.push({
            label: p.label,
            centroid: [sumLat / totalVal, sumLng / totalVal] as [number, number]
          })
        }
      }

      if (trajectory.length < 2) {
        notify('error', 'ขอบเขตช่วงเวลาที่มีข้อมูลไม่เพียงพอในการสร้างเส้นทางการเยื้องตัว')
        return
      }

      const first = trajectory[0]
      const last = trajectory[trajectory.length - 1]
      const dist = calculateDistance(first.centroid[0], first.centroid[1], last.centroid[0], last.centroid[1])

      let direction = 'ทิศตะวันออก'
      const latDiff = last.centroid[0] - first.centroid[0]
      const lngDiff = last.centroid[1] - first.centroid[1]
      if (latDiff > 0 && lngDiff > 0) direction = 'ทิศตะวันออกเฉียงเหนือ'
      else if (latDiff > 0 && lngDiff < 0) direction = 'ทิศตะวันตกเฉียงเหนือ'
      else if (latDiff < 0 && lngDiff > 0) direction = 'ทิศตะวันออกเฉียงใต้'
      else if (latDiff < 0 && lngDiff < 0) direction = 'ทิศตะวันตกเฉียงใต้'
      else if (latDiff > 0) direction = 'ทิศเหนือ'
      else if (latDiff < 0) direction = 'ทิศใต้'
      else if (lngDiff < 0) direction = 'ทิศตะวันตกลงใต้'

      const result = {
        trajectory,
        distance: dist,
        direction,
        sampleSize: trajectory.length
      }

      setDriftRes(result)
      ;(window as any).driftRes = result

      notify('success', `คำนวณจุดศูนย์กลางเรียบร้อย! คลัสเตอร์การระบาดเยื้องตัวเป็นระยะ ${dist.toFixed(2)} กม. ไปทาง ${direction} ในรอบ ${trajectory.length} สัปดาห์`)

      // Auto redirect to map explorer
      setTimeout(() => {
        (window as any).setActivePage?.('explorer')
      }, 800)
    } catch (e: any) {
      notify('error', `เกิดข้อผิดพลาด: ${e.message}`)
    }
  }

  // ──────────────────────────────────────────
  // TOOL 4: Numerical Correlation
  // ──────────────────────────────────────────
  const runCorrelationAnalysis = () => {
    if (!xCol || !yCol) {
      notify('error', 'กรุณาเลือกคอลัมน์ดัชนีทั้ง 2 คอลัมน์')
      return
    }

    notify('info', 'กำลังประมวลผลสถิติความสัมพันธ์เชิงตารางสากล...')

    // Gather arrays
    const xArr: number[] = []
    const yArr: number[] = []

    rawRows.forEach((row: any) => {
      const vx = parseFloat(String(row[xCol] || '').replace(/,/g, '').trim())
      const vy = parseFloat(String(row[yCol] || '').replace(/,/g, '').trim())
      if (!isNaN(vx) && !isNaN(vy)) {
        xArr.push(vx)
        yArr.push(vy)
      }
    })

    const result = calculateCorrelation(xArr, yArr)
    if (!result) {
      notify('error', 'ข้อมูลไม่เพียงพอหรือไม่มีความแปรปรวนเชิงตัวเลข')
      return
    }

    setCorrRes(result)
    notify('success', `คำนวณสำเร็จ: Pearson r = ${result.pearsonR.toFixed(3)}`)
  }

  return (
    <div className="p-6 h-full overflow-y-auto animate-fade-in text-slate-100 max-w-6xl mx-auto space-y-6">
      
      {/* Upper Status Banner showing active profile */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-blue-400 animate-spin-slow" />
            <h1 className="text-base font-black text-white">สตูดิโอวิเคราะห์แผนที่เชิงพื้นที่ขั้นสูง (Deep Spatial Analysis Studio)</h1>
          </div>
          <p className="text-xs text-slate-400 leading-normal">
            ประมวลผลตัวชี้วัดสถิติเชิงปริมาณ อัตรากระจุกตัว คลัสเตอร์การระบาด และการประมาณค่าพื้นผิวจากพิกัดตรวจวัดอย่างมีนัยสำคัญ
          </p>
        </div>

        {dataProfile && (
          <div className="flex items-center gap-2.5 bg-blue-950/20 border border-blue-500/25 px-4 py-2.5 rounded-xl shadow-inner shrink-0">
            <Compass className="text-blue-400" size={16} />
            <div>
              <span className="text-[9px] text-slate-500 block leading-none font-bold uppercase tracking-wider">โปรไฟล์ข้อมูลที่ตรวจพบ:</span>
              <span className="text-xs font-black text-white block mt-1">{dataProfile.title}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Side: Sidebar selectors with Locks */}
        <div className="lg:col-span-1 space-y-3">
          <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1">เมนูเครื่องมือวิเคราะห์ทางภูมิศาสตร์</span>
          
          {/* Tool Item Moran's I */}
          <button
            disabled={!tabSuitability.morans}
            onClick={() => setActiveTab('morans')}
            title={!tabSuitability.morans ? "เปิดใช้เฉพาะข้อมูลสรุปยอดรายพื้นที่ (โปรไฟล์ 1 และ 2)" : "ค้นหาการกระจุกตัว Hotspots LISA ระดับ อำเภอ/ตำบล"}
            className={clsx(
              "w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3 active:scale-98 relative",
              !tabSuitability.morans
                ? "bg-slate-950/20 border-slate-900/40 text-slate-500 cursor-not-allowed opacity-40"
                : activeTab === 'morans'
                  ? "bg-blue-600/10 border-blue-500 text-white shadow-lg cursor-pointer"
                  : "bg-slate-900/40 border-slate-850 text-slate-400 hover:text-slate-200 cursor-pointer"
            )}
          >
            <div className="p-2 rounded bg-slate-950 border border-slate-850 mt-0.5"><Flame size={16} className="text-rose-400" /></div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-1.5">
                <div className="text-xs font-black text-white">1. ความสัมพันธ์พื้นที่ Moran's I</div>
                {!tabSuitability.morans && <Lock size={12} className="text-slate-500 animate-pulse shrink-0" />}
              </div>
              <div className="text-[10px] text-slate-400 mt-1 leading-relaxed">ค้นหาการกระจุกตัว Hotspots LISA ระดับ อำเภอ/ตำบล</div>
            </div>
          </button>

          {/* Tool Item DBSCAN */}
          <button
            disabled={!tabSuitability.hotspot}
            onClick={() => setActiveTab('hotspot')}
            title={!tabSuitability.hotspot ? "เปิดใช้เฉพาะข้อมูลแบบจุดพิกัด Lat/Lng เท่านั้น (โปรไฟล์ 3, 4, 5, 6)" : "ระบุความหนาแน่นและจับกลุ่มคลัสเตอร์"}
            className={clsx(
              "w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3 active:scale-98 relative",
              !tabSuitability.hotspot
                ? "bg-slate-950/20 border-slate-900/40 text-slate-500 cursor-not-allowed opacity-40"
                : activeTab === 'hotspot'
                  ? "bg-blue-600/10 border-blue-500 text-white shadow-lg cursor-pointer"
                  : "bg-slate-900/40 border-slate-850 text-slate-400 hover:text-slate-200 cursor-pointer"
            )}
          >
            <div className="p-2 rounded bg-slate-950 border border-slate-850 mt-0.5"><Sliders size={16} className="text-emerald-400" /></div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-1.5">
                <div className="text-xs font-black text-white">2. การจัดกลุ่มหนาแน่น DBSCAN</div>
                {!tabSuitability.hotspot && <Lock size={12} className="text-slate-500 animate-pulse shrink-0" />}
              </div>
              <div className="text-[10px] text-slate-400 mt-1 leading-relaxed">ระบุพื้นที่ระบาดหนาแน่นตามจุดพิกัดละติจูด/ลองจิจูดจริง</div>
            </div>
          </button>

          {/* Tool Item IDW */}
          <button
            disabled={!tabSuitability.interp}
            onClick={() => setActiveTab('interp')}
            title={!tabSuitability.interp ? "เปิดใช้เฉพาะข้อมูลแบบพิกัดที่มีการระบุค่าตรวจวัดเท่านั้น (โปรไฟล์ 5 และ 6)" : "ประมวลผลประมาณค่าต่อเนื่องเชิงพื้นที่"}
            className={clsx(
              "w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3 active:scale-98 relative",
              !tabSuitability.interp
                ? "bg-slate-950/20 border-slate-900/40 text-slate-500 cursor-not-allowed opacity-40"
                : activeTab === 'interp'
                  ? "bg-blue-600/10 border-blue-500 text-white shadow-lg cursor-pointer"
                  : "bg-slate-900/40 border-slate-850 text-slate-400 hover:text-slate-200 cursor-pointer"
            )}
          >
            <div className="p-2 rounded bg-slate-950 border border-slate-850 mt-0.5"><BarChart2 size={16} className="text-indigo-400" /></div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-1.5">
                <div className="text-xs font-black text-white">3. การประมาณค่าพื้นผิว IDW</div>
                {!tabSuitability.interp && <Lock size={12} className="text-slate-500 animate-pulse shrink-0" />}
              </div>
              <div className="text-[10px] text-slate-400 mt-1 leading-relaxed">ประมวลผลต่อเนื่อง เช่น ปริมาณน้ำฝนจากสถานีตรวจวัด</div>
            </div>
          </button>

          {/* Tool Item Spatiotemporal Drift */}
          <button
            disabled={!tabSuitability.drift}
            onClick={() => setActiveTab('drift')}
            title={!tabSuitability.drift ? "เปิดใช้เฉพาะข้อมูลที่มีมิติอนุกรมเวลารายสัปดาห์ (โปรไฟล์ 1, 3, 5)" : "วิเคราะห์รอยเยื้องตัวจุดศูนย์กลางระบาด"}
            className={clsx(
              "w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3 active:scale-98 relative",
              !tabSuitability.drift
                ? "bg-slate-950/20 border-slate-900/40 text-slate-500 cursor-not-allowed opacity-40"
                : activeTab === 'drift'
                  ? "bg-blue-600/10 border-blue-500 text-white shadow-lg cursor-pointer"
                  : "bg-slate-900/40 border-slate-850 text-slate-400 hover:text-slate-200 cursor-pointer"
            )}
          >
            <div className="p-2 rounded bg-slate-950 border border-slate-850 mt-0.5"><Compass size={16} className="text-cyan-400" /></div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-1.5">
                <div className="text-xs font-black text-white">4. จุดศูนย์กลางหลั่งไหล Drift</div>
                {!tabSuitability.drift && <Lock size={12} className="text-slate-500 animate-pulse shrink-0" />}
              </div>
              <div className="text-[10px] text-slate-400 mt-1 leading-relaxed">วิเคราะห์ทิศทางและระยะทางเคลื่อนที่เฉลี่ยตามรายสัปดาห์</div>
            </div>
          </button>

          {/* Tool Item Correlation */}
          <button
            disabled={!tabSuitability.corr}
            onClick={() => setActiveTab('corr')}
            title={!tabSuitability.corr ? "เปิดใช้เฉพาะข้อมูลที่มีคอลัมน์เชิงตัวเลขอย่างน้อย 2 คอลัมน์" : "เปรียบเทียบสหสัมพันธ์คู่ดัชนี"}
            className={clsx(
              "w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3 active:scale-98 relative",
              !tabSuitability.corr
                ? "bg-slate-950/20 border-slate-900/40 text-slate-500 cursor-not-allowed opacity-40"
                : activeTab === 'corr'
                  ? "bg-blue-600/10 border-blue-500 text-white shadow-lg cursor-pointer"
                  : "bg-slate-900/40 border-slate-850 text-slate-400 hover:text-slate-200 cursor-pointer"
            )}
          >
            <div className="p-2 rounded bg-slate-950 border border-slate-850 mt-0.5"><TrendingUp size={16} className="text-amber-400" /></div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-1.5">
                <div className="text-xs font-black text-white">5. ทดสอบความสัมพันธ์เชิงสถิติ</div>
                {!tabSuitability.corr && <Lock size={12} className="text-slate-500 animate-pulse shrink-0" />}
              </div>
              <div className="text-[10px] text-slate-400 mt-1 leading-relaxed">วิเคราะห์ Pearson/Spearman ระหว่างคู่คอลัมน์ดัชนี</div>
            </div>
          </button>
        </div>

        {/* Right Side: Active Workspace — using extracted sub-components */}
        <div className="lg:col-span-3 space-y-6">

          {activeTab === 'morans' && (
            <MoranPanel
              distanceBand={distanceBand}
              onDistanceBandChange={setDistanceBand}
              adminLevel={adminLevel}
              moransRes={moransRes}
              isMoranApplied={isMoranApplied}
              isComputing={isComputingMoran}
              computeProgress={moranProgress}
              onRun={runMoranAnalysis}
              onApplyToMap={applyMoranToMap}
              onResetFromMap={resetMoranFromMap}
            />
          )}

          {activeTab === 'hotspot' && (
            <ClusterPanel
              hasCoords={!!(dataKeys.lat && dataKeys.lng)}
              eps={eps}
              onEpsChange={setEps}
              minPts={minPts}
              onMinPtsChange={setMinPts}
              dbscanRes={dbscanRes}
              isDBSCANApplied={isDBSCANApplied}
              isComputing={isComputing}
              computeProgress={computeProgress}
              onRun={runDBSCANAnalysis}
              onApplyToMap={applyDBSCANToMap}
              onResetFromMap={resetDBSCANFromMap}
            />
          )}

          {activeTab === 'interp' && (
            <InterpPanel
              hasCoords={!!(dataKeys.lat && dataKeys.lng)}
              hasValue={!!dataKeys.value}
              idwPower={idwPower}
              onIdwPowerChange={setIdwPower}
              idwRadius={idwRadius}
              onIdwRadiusChange={setIdwRadius}
              interpolatedPoints={interpolatedPoints}
              onRun={runIDWInterpolation}
            />
          )}

          {activeTab === 'drift' && (
            <DriftPanel
              driftRes={driftRes}
              onRun={runDriftAnalysis}
            />
          )}

          {activeTab === 'corr' && (
            <CorrelationPanel
              numericColumns={numericColumns}
              xCol={xCol}
              yCol={yCol}
              onXColChange={setXCol}
              onYColChange={setYCol}
              corrRes={corrRes}
              onRun={runCorrelationAnalysis}
            />
          )}

        </div>
      </div>
    </div>
  )
}

