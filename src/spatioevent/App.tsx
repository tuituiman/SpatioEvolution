import React, { useEffect, useRef, useState, useMemo } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  MapPin, Play, Pause, RotateCcw, Upload, ArrowLeft, Clock,
  ChevronLeft, ChevronRight, Settings, Sliders, Calendar, HelpCircle,
  BarChart3, X
} from 'lucide-react'
import { useSpatioEventStore, type GroupingMode, type TimePeriod, type MappedRow } from './store.ts'
import { clsx } from 'clsx'

interface SpatioEventAppProps {
  embedded?: boolean
}

let hasShownGuideThisSession = false

export function App({ embedded = false }: SpatioEventAppProps) {
  const {
    rawRows, columns, dataKeys, pointRadiusBuffer, playSpeed, isPlaying,
    currentStep, periods, dictionary, groupingMode, selectedDatasetName,
    baseMapStyle, setRawRows, setDataKeys, setPointRadiusBuffer,
    setPlaySpeed, setIsPlaying, setCurrentStep, setGroupingMode,
    setBaseMapStyle, resetAll, isCumulative, setIsCumulative
  } = useSpatioEventStore()

  const [mappingOpen, setMappingOpen] = useState(false)
  const [tempKeys, setTempKeys] = useState(dataKeys)
  const [showChart, setShowChart] = useState(true)
  const [showGuide, setShowGuide] = useState(() => !hasShownGuideThisSession)

  // File picker references
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Map references
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMap = useRef<L.Map | null>(null)
  const markerLayerGroup = useRef<L.LayerGroup | null>(null)
  const baseTileLayer = useRef<L.TileLayer | null>(null)

  const activePeriod = periods[currentStep]
  const activeCases = useMemo(() => {
    if (!activePeriod || !dictionary[activePeriod.key]) return []
    if (isCumulative) {
      const cases: MappedRow[] = []
      for (let i = 0; i <= currentStep; i++) {
        const key = periods[i].key
        if (dictionary[key]) {
          cases.push(...dictionary[key])
        }
      }
      return cases
    }
    return dictionary[activePeriod.key]
  }, [activePeriod, dictionary, isCumulative, currentStep, periods])

  // 1. Initialize Map
  useEffect(() => {
    if (!mapRef.current) return

    // Leaflet default icon fix
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
    })

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([13.0, 101.5], 6)

    leafletMap.current = map
    markerLayerGroup.current = L.layerGroup().addTo(map)

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    return () => {
      map.remove()
      leafletMap.current = null
      markerLayerGroup.current = null
    }
  }, [])

  // 2. Map Tile Switcher
  useEffect(() => {
    const map = leafletMap.current
    if (!map) return

    if (baseTileLayer.current) {
      map.removeLayer(baseTileLayer.current)
    }

    let url = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
    if (baseMapStyle === 'street') {
      url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    } else if (baseMapStyle === 'satellite') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    }

    baseTileLayer.current = L.tileLayer(url, { maxZoom: 19, maxNativeZoom: baseMapStyle === 'dark' ? 16 : 19 }).addTo(map)
  }, [baseMapStyle])

  // 3. Render Active Cases and Buffers
  useEffect(() => {
    const map = leafletMap.current
    const group = markerLayerGroup.current
    if (!map || !group) return

    group.clearLayers()

    if (activeCases.length === 0) return

    const latlngs: L.LatLngExpression[] = []

    activeCases.forEach((pt) => {
      latlngs.push([pt.lat, pt.lng])

      // ── Draw Faded Community Radius Circle (in meters) ──
      if (pointRadiusBuffer > 0) {
        L.circle([pt.lat, pt.lng], {
          radius: pointRadiusBuffer,
          fillColor: '#3b82f6',
          fillOpacity: 0.15,
          color: '#3b82f6',
          weight: 1,
          opacity: 0.4,
          dashArray: '4, 4'
        }).addTo(group)
      }

      // Draw Center Marker
      const marker = L.circleMarker([pt.lat, pt.lng], {
        radius: 8,
        fillColor: '#ef4444',
        fillOpacity: 0.85,
        color: '#ffffff',
        weight: 2,
        opacity: 1
      }).addTo(group)

      marker.bindTooltip(`
        <div class="p-1 text-slate-100 text-xs font-semibold">
          <div class="font-bold border-b border-slate-700 pb-1 mb-1">${pt.label}</div>
          <div>เวลาที่เกิดเหตุ: <span class="text-rose-400 font-bold">${pt.date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span></div>
          <div class="text-[10px] text-slate-400 mt-0.5">พิกัด: ${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}</div>
        </div>
      `, { direction: 'top', className: 'spatio-tooltip-leaflet border border-slate-700 bg-slate-900/90 rounded-lg p-2' })
    })

    // Auto fit map bounds to active cases on first load or when dataset changes
    if (latlngs.length > 0 && currentStep === 0) {
      map.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50], maxZoom: 15 })
    }
  }, [activeCases, pointRadiusBuffer])

  // 4. Timer/Playback Control
  useEffect(() => {
    if (!isPlaying) {
      if (playTimerRef.current) clearInterval(playTimerRef.current)
      return
    }

    playTimerRef.current = setInterval(() => {
      setCurrentStep((currentStep + 1) % Math.max(1, periods.length))
    }, playSpeed)

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current)
    }
  }, [isPlaying, currentStep, periods.length, playSpeed])

  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 5. Excel/CSV File Uploader
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const XLSX = await import('xlsx')
    const reader = new FileReader()

    reader.onload = (evt) => {
      const data = evt.target?.result
      if (!data) return

      const workbook = XLSX.read(data, { type: 'binary', cellDates: true })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

      if (rows.length > 0) {
        setRawRows(rows, file.name)
        // Auto map columns
        const cols = Object.keys(rows[0] as any)
        const lat = cols.find(c => c.toLowerCase().includes('lat') || c.includes('พิกัดy') || c.includes('ละติจูด')) || ''
        const lng = cols.find(c => c.toLowerCase().includes('lng') || c.toLowerCase().includes('lon') || c.includes('พิกัดx') || c.includes('ลองจิจูด')) || ''
        const dateTime = cols.find(c => c.toLowerCase().includes('date') || c.includes('วัน') || c.includes('เวลา')) || ''
        const label = cols.find(c => c.toLowerCase().includes('name') || c.toLowerCase().includes('label') || c.includes('โรค') || c.includes('รายละเอียด')) || ''

        const initialKeys = { lat, lng, dateTime, label }
        setTempKeys(initialKeys)
        setDataKeys(initialKeys)
        setMappingOpen(true)
      }
    }
    reader.readAsBinaryString(file)
  }

  // 6. Bar Chart Stats
  const chartHeight = 80
  const maxCasesInStep = useMemo(() => {
    let max = 0
    periods.forEach((p) => {
      const cnt = dictionary[p.key]?.length ?? 0
      if (cnt > max) max = cnt
    })
    return max || 1
  }, [periods, dictionary])

  const handleBarClick = (idx: number) => {
    setIsPlaying(false)
    setCurrentStep(idx)
  }

  return (
    <div className={clsx(
      "flex overflow-hidden bg-slate-950 font-sans text-slate-100 select-none",
      embedded ? "h-full w-full" : "h-screen w-screen"
    )}>
      {/* 1. Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/60 backdrop-blur-xl flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-500">
              <Clock size={18} />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white">SpatioEvent</h1>
              <p className="text-[10px] text-slate-400">ระบบจำลองการระบาดรายชั่วโมง</p>
            </div>
          </div>
          {!embedded && (
            <a
              href="./"
              title="กลับสู่แอปหลัก"
              className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
            >
              <ArrowLeft size={16} />
            </a>
          )}
        </div>

        {/* Menu Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {/* File Upload Section */}
          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-3">
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">นำเข้าชุดข้อมูลระบาด</h2>
            {selectedDatasetName ? (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-rose-400 truncate">{selectedDatasetName}</div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  นำเข้าแล้ว {rawRows.length.toLocaleString()} แถว ({periods.length} คาบย่อย)
                </div>
                <div className="flex gap-1.5 pt-1">
                  <button
                    onClick={() => setMappingOpen(true)}
                    className="flex-1 text-[10px] font-bold py-1 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded transition-all cursor-pointer text-center"
                  >
                    ตั้งค่าหัวตาราง
                  </button>
                  <button
                    onClick={resetAll}
                    className="text-[10px] font-bold px-2 py-1 bg-rose-950/40 border border-rose-900/30 hover:bg-rose-900/40 text-rose-300 rounded transition-all cursor-pointer"
                  >
                    ล้าง
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center py-6 border-2 border-dashed border-slate-800 hover:border-rose-500/50 bg-slate-950/20 hover:bg-rose-500/5 rounded-xl transition-all cursor-pointer text-slate-400 hover:text-rose-400 group"
              >
                <Upload size={22} className="mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold">เลือกไฟล์ Excel หรือ CSV</span>
                <span className="text-[9px] text-slate-500 mt-1">ต้องมีพิกัด Lat, Lng และวันเวลา</span>
              </button>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
          </div>

          {/* Temporal Grouping Controls */}
          {rawRows.length > 0 && (
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sliders size={14} className="text-rose-400" />
                  <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">จัดกลุ่มเวลา</h2>
                </div>
                
                {/* Compact Cumulative Pill Button */}
                <button
                  type="button"
                  onClick={() => setIsCumulative(!isCumulative)}
                  className={clsx(
                    "text-[9px] font-bold px-2 py-0.5 rounded border transition-all duration-150 cursor-pointer select-none",
                    isCumulative
                      ? "bg-rose-500 border-rose-500 text-white shadow-sm font-semibold"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                  )}
                  title="สลับการแสดงผลสะสม (Cumulative)"
                >
                  ยอดสะสม {isCumulative ? "ON" : "OFF"}
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                <select
                  value={groupingMode}
                  onChange={(e) => setGroupingMode(e.target.value as GroupingMode)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none cursor-pointer hover:border-slate-700 transition-colors"
                >
                  <option value="daily">รายวัน (Daily)</option>
                  <option value="hourly">รายชั่วโมง (Hourly)</option>
                  <option value="shift">รายเวรผลัดเวร (8 ชั่วโมง)</option>
                  <option value="day_night">รายกลางวัน / กลางคืน (12 ชั่วโมง)</option>
                  <option value="custom_2h">ช่วงละ 2 ชั่วโมง</option>
                  <option value="custom_4h">ช่วงละ 4 ชั่วโมง</option>
                </select>
              </div>
            </div>
          )}

          {/* Map Style Selection */}
          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-3">
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">สไตล์แผนที่ฐาน</h2>
            <div className="grid grid-cols-3 gap-1">
              {[
                { id: 'dark', label: 'Dark Mode' },
                { id: 'street', label: 'แผนที่ถนน' },
                { id: 'satellite', label: 'ดาวเทียม' },
              ].map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setBaseMapStyle(style.id as any)}
                  className={clsx(
                    "text-[10px] font-bold py-1.5 rounded transition-all cursor-pointer border text-center",
                    baseMapStyle === style.id
                      ? "bg-rose-500 border-rose-500 text-white font-bold"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  )}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          {/* Point Buffer Radius Settings */}
          {rawRows.length > 0 && (
            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-3.5">
              <div className="flex justify-between items-center text-xs font-bold text-slate-200 uppercase tracking-wider">
                <span>รัศมีขอบเขตชุมชน</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={pointRadiusBuffer}
                    onChange={(e) => {
                      const val = Math.min(1000000, Math.max(0, Number(e.target.value) || 0))
                      setPointRadiusBuffer(val)
                    }}
                    className="w-20 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-right font-mono font-bold text-rose-400 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400">เมตร</span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="10000"
                step="100"
                value={pointRadiusBuffer}
                onChange={(e) => setPointRadiusBuffer(Number(e.target.value))}
                className="w-full h-1.5 accent-rose-500 cursor-pointer appearance-none bg-slate-800 rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-rose-500"
              />
              <div className="grid grid-cols-5 gap-1">
                {[
                  { label: 'ปิด', value: 0 },
                  { label: '500m', value: 500 },
                  { label: '1km', value: 1000 },
                  { label: '5km', value: 5000 },
                  { label: '10km', value: 10000 },
                ].map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPointRadiusBuffer(p.value)}
                    className={clsx(
                      "text-[9px] font-semibold py-1 rounded transition-colors cursor-pointer border text-center",
                      pointRadiusBuffer === p.value
                        ? "bg-rose-500 text-white border-rose-500 shadow-sm font-bold"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-850"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/30 text-center text-[10px] text-slate-500">
          กลุ่มระบาดวิทยา สำนักงานป้องกันควบคุมโรคที่ 1 เชียงใหม่
        </div>
      </aside>

      {/* 2. Main Map Dashboard Area */}
      <main className="flex-1 flex flex-col relative min-w-0">
        {/* Map Container */}
        <div ref={mapRef} className="flex-1 bg-slate-900" />

        {/* Bottom Timeline Control Panel */}
        {periods.length > 0 && (
          <div className="absolute bottom-6 left-6 right-6 p-4 bg-slate-900/80 border border-slate-800/80 rounded-2xl backdrop-blur-md shadow-2xl flex flex-col gap-3 select-none z-[1000]">
            {/* Upper row: Controls & Date/Time Info */}
            <div className="flex items-center justify-between gap-4">
              {/* Playback Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setIsPlaying(false)
                    setCurrentStep((currentStep - 1 + periods.length) % periods.length)
                  }}
                  className="p-2 bg-slate-850 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={clsx(
                    "p-2.5 rounded-lg border flex items-center justify-center transition-all cursor-pointer",
                    isPlaying
                      ? "bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30"
                      : "bg-rose-500 text-white border-rose-500 hover:bg-rose-600"
                  )}
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button
                  onClick={() => {
                    setIsPlaying(false)
                    setCurrentStep((currentStep + 1) % periods.length)
                  }}
                  className="p-2 bg-slate-850 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={() => {
                    setIsPlaying(false)
                    setCurrentStep(0)
                  }}
                  className="p-2 bg-slate-850 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
                  title="เริ่มใหม่"
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  onClick={() => setShowChart(!showChart)}
                  className={clsx(
                    "p-2 border rounded-lg transition-all cursor-pointer",
                    showChart
                      ? "bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30"
                      : "bg-slate-850 text-slate-400 border-slate-800 hover:text-white"
                  )}
                  title="แสดง/ซ่อนกราฟคลื่นระบาด"
                >
                  <BarChart3 size={14} />
                </button>
              </div>

              {/* Time Indicator text */}
              <div className="text-right">
                <div className="text-xs font-bold text-white tracking-wide">
                  {activePeriod ? activePeriod.label : '-'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  ช่วงเวลาลำดับที่: {currentStep + 1} / {periods.length} | มีผู้ป่วยในคาบนี้:{' '}
                  <span className="text-rose-400 font-bold">{activeCases.length.toLocaleString()} ราย</span>
                </div>
              </div>
            </div>

            {/* Middle row: Timeline Track */}
            <div className="relative w-full">
              <input
                type="range"
                min="0"
                max={periods.length - 1}
                value={currentStep}
                onChange={(e) => {
                  setIsPlaying(false)
                  setCurrentStep(Number(e.target.value))
                }}
                className="w-full h-2 accent-rose-500 cursor-pointer appearance-none bg-slate-800 rounded-full"
              />
            </div>

            {/* Bottom row: SVG Mini-histogram chart */}
            {showChart && (
              <div className="w-full bg-slate-950/40 border border-slate-800/40 rounded-lg p-2 flex flex-col gap-1">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center px-1">
                  <span>ความถี่เคสรายช่วงเวลา (Epidemic Wave)</span>
                  <span>สูงสุด {maxCasesInStep} เคส</span>
                </div>
                <div className="w-full flex items-end gap-0.5 h-8 pt-1 select-none overflow-x-auto no-scrollbar">
                  {periods.map((p, idx) => {
                    const cnt = dictionary[p.key]?.length ?? 0
                    const heightPercent = maxCasesInStep > 0 ? (cnt / maxCasesInStep) * 100 : 0
                    const active = idx === currentStep

                    return (
                      <button
                        key={p.key}
                        onClick={() => handleBarClick(idx)}
                        className="flex-1 min-w-[4px] h-full flex items-end group focus:outline-none cursor-pointer"
                        title={`${p.label}: ${cnt} ราย`}
                      >
                        <div
                          style={{ height: `${Math.max(2, heightPercent)}%` }}
                          className={clsx(
                            "w-full rounded-t-sm transition-all duration-150",
                            active
                              ? "bg-rose-500 shadow-[0_-2px_10px_rgba(239,68,68,0.5)]"
                              : "bg-slate-700 group-hover:bg-slate-500"
                          )}
                        />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 3. Ingestion & Column Mapping Modal */}
      {mappingOpen && columns.length > 0 && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-850 bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Calendar size={18} className="text-rose-400" />
              <h3 className="text-sm font-bold text-white">ตั้งค่าคีย์และคอลัมน์ข้อมูล</h3>
            </div>
            <p className="text-xs text-slate-400 leading-normal">
              โปรดจับคู่คอลัมน์จากตารางของคุณเพื่อให้แอปคำนวณตำแหน่งและวันเวลาที่ละเอียดระดับนาทีได้ถูกต้อง
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-slate-400 font-bold mb-1.5">คอลัมน์พิกัดละติจูด (Latitude):</label>
                <select
                  value={tempKeys.lat}
                  onChange={(e) => setTempKeys({ ...tempKeys, lat: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="">-- เลือกคอลัมน์ --</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-bold mb-1.5">คอลัมน์พิกัดลองจิจูด (Longitude):</label>
                <select
                  value={tempKeys.lng}
                  onChange={(e) => setTempKeys({ ...tempKeys, lng: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="">-- เลือกคอลัมน์ --</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-bold mb-1.5">คอลัมน์วันที่และเวลาประทับ (Date/Time):</label>
                <select
                  value={tempKeys.dateTime}
                  onChange={(e) => setTempKeys({ ...tempKeys, dateTime: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="">-- เลือกคอลัมน์ --</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-bold mb-1.5">คอลัมน์ชื่อ / รายละเอียดเหตุการณ์ (Label):</label>
                <select
                  value={tempKeys.label}
                  onChange={(e) => setTempKeys({ ...tempKeys, label: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="">-- เลือกคอลัมน์ --</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMappingOpen(false)}
                className="flex-1 text-xs font-bold py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  setDataKeys(tempKeys)
                  setMappingOpen(false)
                }}
                disabled={!tempKeys.lat || !tempKeys.lng || !tempKeys.dateTime}
                className="flex-1 text-xs font-bold py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-40 disabled:hover:bg-rose-500 text-white rounded-lg transition-colors cursor-pointer"
              >
                ยืนยันและพล็อตแผนที่
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Guide / Instructions Popup */}
      {showGuide && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5 text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <HelpCircle size={20} className="text-rose-500" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">แนะนำการใช้งานวิเคราะห์รายชั่วโมง</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs leading-relaxed">
              <div className="flex gap-2.5">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-[10px] font-bold text-rose-400">1</div>
                <div>
                  <h4 className="font-bold text-slate-100">สำหรับวิเคราะห์รายชั่วโมง / วันผลัดเวร</h4>
                  <p className="text-slate-400 mt-0.5">ใช้จำลองเส้นเวลาของเหตุการณ์ระบาดที่มีความถี่สูงและละเอียดระดับชั่วโมง/นาที (ต่างจากหน้าหลักที่วิเคราะห์สะสมรายสัปดาห์/รายเดือน)</p>
                </div>
              </div>

              <div className="flex gap-2.5">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-[10px] font-bold text-rose-400">2</div>
                <div>
                  <h4 className="font-bold text-slate-100">ใช้ข้อมูลพิกัดภูมิศาสตร์ (Incident Coordinates)</h4>
                  <p className="text-slate-400 mt-0.5">เหมาะสำหรับข้อมูลพิกัดจุดเกิดเหตุจริง เช่น ตำแหน่งการเกิดอุบัติเหตุทางถนน, การเกิดเพลิงไหม้, จุดพบรังโรค หรือพิกัดบ้านเคสผู้ป่วยจริง</p>
                </div>
              </div>

              <div className="flex gap-2.5">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-[10px] font-bold text-rose-400">3</div>
                <div>
                  <h4 className="font-bold text-slate-100">ตัวอย่างตารางข้อมูลที่จะอัปโหลด</h4>
                  <p className="text-slate-400 mt-0.5 mb-2">ตารางในไฟล์ Excel/CSV ควรมีคอลัมน์วันที่เวลาประทับ พิกัดจุด (X, Y) และชื่อเหตุการณ์ ดังนี้:</p>
                  
                  <div className="overflow-hidden border border-slate-800 rounded-lg bg-slate-950/40">
                    <table className="w-full text-[10px] text-slate-300 font-sans border-collapse">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-800 text-slate-400">
                          <th className="px-2 py-1.5 text-left font-bold">วันเวลาเหตุการณ์</th>
                          <th className="px-2 py-1.5 text-right font-bold">ละติจูด (Lat)</th>
                          <th className="px-2 py-1.5 text-right font-bold">ลองจิจูด (Lng)</th>
                          <th className="px-2 py-1.5 text-left font-bold">รายละเอียด/โรค</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-800/50">
                          <td className="px-2 py-1.5 font-mono text-rose-400/90">2026-07-15 08:30</td>
                          <td className="px-2 py-1.5 text-right font-mono">18.7904</td>
                          <td className="px-2 py-1.5 text-right font-mono">98.9845</td>
                          <td className="px-2 py-1.5 truncate max-w-[100px]">อุบัติเหตุ จยย. ล้ม</td>
                        </tr>
                        <tr>
                          <td className="px-2 py-1.5 font-mono text-rose-400/90">2026-07-15 14:15</td>
                          <td className="px-2 py-1.5 text-right font-mono">18.8012</td>
                          <td className="px-2 py-1.5 text-right font-mono">98.9912</td>
                          <td className="px-2 py-1.5 truncate max-w-[100px]">ไฟไหม้หญ้าข้างทาง</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  hasShownGuideThisSession = true
                  setShowGuide(false)
                }}
                className="px-4 py-2 border border-slate-800 hover:border-slate-700 bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer text-center"
              >
                ไม่ต้องแสดงข้อความนี้อีก
              </button>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer text-center"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
