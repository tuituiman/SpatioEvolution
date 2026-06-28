import React, { useState, useEffect } from 'react'
import { useAppStore, type DataKeys, type IngestionMode } from '../store/useAppStore'
import { locationResolver } from '../data/locationResolver'
import { parseDate, toDateKey, getPeriodLabel, type DateMode } from '../data/dateParser'
import { buildDictionary, buildStaticDictionary, buildWideDictionary, clearCumulativeCache } from '../data/aggregator'
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle,
  RefreshCw, Download, ArrowRight, X, Sparkles,
  MapPin, Activity, Users, Settings, Trash2
} from 'lucide-react'
import * as XLSX from 'xlsx'
import clsx from 'clsx'
import { ExportModal } from './mapping/ExportModal'
import { PreviewTable } from './mapping/PreviewTable'
import { readCsvToWorkbook } from '../data/encoding'
import { useTranslation } from '../hooks/useTranslation'

type FlowType = 'static' | 'dynamic' | 'linelist'
type DynamicLayout = 'wide' | 'long'

export const MappingModal: React.FC = () => {
  const { t, language } = useTranslation()
  const {
    isMappingOpen, setIsMappingOpen,
    rawRows, setRawRows,
    dataKeys, setDataKeys,
    setDictionary, setPeriods,
    groupingMode, setGroupingMode,
    colorMode, setColorMode,
    mappingModalTab, setMappingModalTab,
    ingestionMode, setIngestionMode,
    setLoading, notify,
    geoMode, setGeoMode,
    datasets, loadDatasetById, deleteDatasetById, storageUsageBytes, refreshStorageUsage,
    activeDatasetId, clearAllDatasets
  } = useAppStore()

  // Local navigation & layout flow states
  const [activeFlow, setActiveFlow] = useState<FlowType>('static')
  const [dynamicLayout, setDynamicLayout] = useState<DynamicLayout>('wide')
  const [uploadSubTab, setUploadSubTab] = useState<'new' | 'library'>('new')
  const [activeId, setActiveId] = useState<string | null>(null)

  // UI state for showing fullscreen column previews
  const [previewType, setPreviewType] = useState<'static' | 'dynamic_wide' | 'dynamic_long' | 'linelist' | null>(null)

  // File states (stored locally first, then sync'd to store on confirmation)
  const [fileName, setFileName] = useState<string>('')
  const [localRows, setLocalRows] = useState<any[]>([])
  const [localColumns, setLocalColumns] = useState<string[]>([])

  // Sheet selection states (for multi-sheet Excel files)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const workbookRef = React.useRef<XLSX.WorkBook | null>(null)
  const pendingFlowRef = React.useRef<FlowType>('static')
  const fileBytesRef = React.useRef<Uint8Array | null>(null)

  // Column mapping states
  const [mapping, setMapping] = useState<DataKeys>({
    date: '', province: '', district: '', subdistrict: '', lat: '', lng: '', value: '', color: ''
  })
  const [useDist, setUseDist] = useState(true)
  const [useSub, setUseSub] = useState(false)
  const [useVal, setUseVal] = useState(true)
  const [useColor, setUseColor] = useState(false)

  // Export Modal Overlay States
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [exportTimeMode, setExportTimeMode] = useState<DateMode>('weekly')
  const [exportAdminFormat, setExportAdminFormat] = useState<'thai' | 'code'>('thai')
  const [exportLayoutFormat, setExportLayoutFormat] = useState<'wide' | 'long'>('wide')
  const [isExporting, setIsExporting] = useState(false)

  // Auto-fill state if store already has a dataset loaded
  useEffect(() => {
    if (isMappingOpen) {
      refreshStorageUsage().catch(console.warn)
      
      if (rawRows.length > 0 && datasets.length > 0) {
        const meta = datasets.find(d => d.id === activeDatasetId) || datasets[datasets.length - 1]
        setActiveId(meta?.id || null)
        setFileName(meta?.fileName || '')
        setLocalRows(rawRows)
        setLocalColumns(Object.keys(rawRows[0] || {}))
        setMapping(dataKeys)
        setUseDist(!!dataKeys.district)
        setUseSub(!!dataKeys.subdistrict)
        setUseVal(!!dataKeys.value)
        setUseColor(!!dataKeys.color)

        // Infer active flow based on ingestionMode and fields
        let flow: FlowType = 'static'
        if (ingestionMode === 'admin_static' || ingestionMode === 'coord_static') {
          setActiveFlow('static')
          flow = 'static'
        } else if (!!dataKeys.date) {
          // If it has date and is aggregated
          if (rawRows[0] && Object.keys(rawRows[0]).includes(dataKeys.date)) {
            const f = dataKeys.value ? 'dynamic' : 'linelist'
            setActiveFlow(f)
            flow = f
            setDynamicLayout('long')
          }
        } else {
          // Wide format (Matrix) has no single date column mapped
          setActiveFlow('dynamic')
          flow = 'dynamic'
          setDynamicLayout('wide')
        }
        pendingFlowRef.current = flow

        // Restore sheet metadata & bytes if present
        if (meta && 'sheetNames' in meta && Array.isArray((meta as any).sheetNames) && (meta as any).sheetNames.length > 1) {
          setSheetNames((meta as any).sheetNames)
          setSelectedSheet((meta as any).selectedSheet || (meta as any).sheetNames[0])
        } else {
          if (!workbookRef.current) {
            setSheetNames([])
            setSelectedSheet('')
          }
        }
        if (meta && 'fileBytes' in meta && (meta as any).fileBytes) {
          fileBytesRef.current = (meta as any).fileBytes
          if (!workbookRef.current) {
            try {
              workbookRef.current = XLSX.read((meta as any).fileBytes, { type: 'array', cellDates: true })
            } catch (e) {
              console.warn('Failed to parse workbook from saved fileBytes:', e)
            }
          }
        } else {
          if (!workbookRef.current) {
            fileBytesRef.current = null
            workbookRef.current = null
          }
        }
      } else {
        // No active dataset — clear states for a fresh upload
        setLocalRows([])
        setLocalColumns([])
        setFileName('')
        setActiveId(null)
        setSheetNames([])
        setSelectedSheet('')
        workbookRef.current = null
        fileBytesRef.current = null
      }
    }
  }, [isMappingOpen])

  if (!isMappingOpen) return null

  // Auto-detect columns helper
  const runAutoDetect = (cols: string[], flow: FlowType) => {
    const patterns: Record<string, RegExp> = {
      province: /รหัสจังหวัด|^(จังหวัด|จ\.|province|changwat|p_code|pcode|pv_code)/i,
      district: /รหัสอำเภอ|^(อำเภอ|อ\.|district|amphur|amphoe|a_code|acode|am_code)/i,
      subdistrict: /รหัสตำบล|^(ตำบล|ต\.|subdist|tambon|t_code|tcode|t_code_full)/i,
      date: /วัน|date|time/i,
      value: /จำนวน|ยอด|ราย|ผู้ป่วย|case|patient|value|count|total|ปริมาณ/i,
      color: /^(สี|color|hex)$/i,
      lat: /^(lat|latitude|ละติจูด|พิกัด_y|พิกัดy|y|y_coord)/i,
      lng: /^(lon|lng|long|longitude|ลองจิจูด|พิกัด_x|พิกัดx|x|x_coord)/i,
    }

    const detected: DataKeys = {
      date: '', province: '', district: '', subdistrict: '', lat: '', lng: '', value: '', color: ''
    }

    cols.forEach(col => {
      for (const [key, re] of Object.entries(patterns)) {
        const k = key as keyof DataKeys
        if (!detected[k] && re.test(col)) {
          detected[k] = col
        }
      }
    })

    // ตรวจจับ Geographic Mode อัตโนมัติ
    if (detected.lat && detected.lng) {
      setGeoMode('coordinate')
    } else {
      setGeoMode('admin')
    }

    if (flow === 'linelist') {
      detected.value = ''
    }

    setMapping(detected)
    setUseDist(!!detected.district)
    setUseSub(!!detected.subdistrict)
    setUseVal(flow === 'static' ? !!detected.value : (flow === 'linelist' ? false : true))
    setUseColor(flow === 'static' ? !!detected.color : false)
  }

  // Handle uploading based on flow type
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>, flow: FlowType) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) loadFile(file, flow)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, flow: FlowType) => {
    const file = e.target.files?.[0]
    if (file) loadFile(file, flow)
  }

  /** Parse a specific sheet from the stored workbook and populate state */
  const processSheet = (workbook: XLSX.WorkBook, sheetName: string, flow: FlowType) => {
    const sheet = workbook.Sheets[sheetName]
    const rawJson: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    if (rawJson.length === 0) {
      setLocalRows([])
      setLocalColumns([])
      setMapping({ date: '', province: '', district: '', subdistrict: '', lat: '', lng: '', value: '', color: '' })
      setActiveFlow(flow)
      setActiveId(null)
      setMappingModalTab('mapping')
      return
    }

    const cols = Object.keys(rawJson[0])
    setLocalRows(rawJson)
    setLocalColumns(cols)
    setActiveFlow(flow)
    setActiveId(null)
    runAutoDetect(cols, flow)
    setMappingModalTab('mapping')
    notify('success', t('hub_upload_success', { count: rawJson.length.toLocaleString() }))
  }

  const loadFile = (file: File, flow: FlowType) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      notify('error', t('exp_file_type_err'))
      return
    }

    // Clear old file and sheet states immediately to avoid showing stale data in UI
    setLocalRows([])
    setLocalColumns([])
    setMapping({ date: '', province: '', district: '', subdistrict: '', lat: '', lng: '', value: '', color: '' })
    setActiveId(null)
    setSheetNames([])
    setSelectedSheet('')
    workbookRef.current = null

    const flowLabel = flow === 'static'
      ? 'Static Map'
      : flow === 'dynamic'
        ? 'Dynamic Map'
        : 'Line Listing'
    setLoading(true, t('dm_reading_flow', { flow: flowLabel }))
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        fileBytesRef.current = data
        let workbook: XLSX.WorkBook
        if (file.name.toLowerCase().endsWith('.csv')) {
          workbook = readCsvToWorkbook(data)
        } else {
          workbook = XLSX.read(data, { type: 'array', cellDates: true })
        }

        setFileName(file.name)

        // If the workbook has multiple sheets, prompt user to select one
        if (workbook.SheetNames.length > 1) {
          workbookRef.current = workbook
          pendingFlowRef.current = flow
          setSheetNames(workbook.SheetNames)
          setSelectedSheet(workbook.SheetNames[0])
          // Don't auto-advance to mapping tab yet — wait for user to confirm sheet
          setMappingModalTab('mapping')
        } else {
          // Single sheet — process immediately
          workbookRef.current = null
          setSheetNames([])
          setSelectedSheet('')
          processSheet(workbook, workbook.SheetNames[0], flow)
        }
      } catch (err: any) {
        notify('error', t('hub_read_failed', { msg: err.message }))
      } finally {
        setLoading(false)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const cleanVal = (val: any) => {
    if (val === undefined || val === null || val === '') return 0
    const parsed = parseFloat(String(val).replace(/,/g, '').trim())
    return isNaN(parsed) ? 0 : parsed
  }

  // Primary action: Load Map Dynamic/Static
  const handleLoadToMap = async () => {
    if (localRows.length === 0) return
    setLoading(true, t('hub_plotting_msg'))
    try {
      // 0. รีเซ็ตสถานะเก่าใน Store ทั้งหมดเพื่อเริ่มต้นใหม่างสะอาด (Pristine state reset)
      useAppStore.setState({
        rawRows: [],
        dictionary: {},
        periods: [],
        currentStep: 0,
        selectedPeriods: new Set<string>(),
        lastClickedPeriod: null,
        isCumulative: false,
        isPlaying: false,
        globalStats: null,
        globalBreaks: []
      })

      const mergedKeys: DataKeys = {
        date: activeFlow === 'static' ? '' : (activeFlow === 'dynamic' && dynamicLayout === 'wide' ? '' : mapping.date),
        province: mapping.province,
        district: geoMode === 'coordinate' ? '' : (useDist ? mapping.district : ''),
        subdistrict: geoMode === 'coordinate' ? '' : (useSub ? mapping.subdistrict : ''),
        value: (activeFlow === 'static' || activeFlow === 'linelist') ? (useVal ? mapping.value : '') : (dynamicLayout === 'long' ? mapping.value : ''),
        color: activeFlow === 'static' && useColor ? mapping.color : '',
        lat: geoMode === 'coordinate' ? mapping.lat : '',
        lng: geoMode === 'coordinate' ? mapping.lng : ''
      }

      const calculatedMode: IngestionMode = activeFlow === 'static'
        ? (geoMode === 'coordinate' ? 'coord_static' : 'admin_static')
        : (geoMode === 'coordinate' ? 'coord_dynamic' : 'admin_dynamic')

      // Save keys and raw data to store
      setDataKeys(mergedKeys)
      setRawRows(localRows, {
        id: activeId || undefined,
        fileName,
        rowCount: localRows.length,
        keys: mergedKeys,
        loadedAt: new Date(),
        ingestionMode: calculatedMode,
        fileBytes: fileBytesRef.current || undefined,
        sheetNames: sheetNames.length > 0 ? sheetNames : undefined,
        selectedSheet: selectedSheet || undefined,
      })

      clearCumulativeCache()

      let result
      if (activeFlow === 'static') {
        result = await buildStaticDictionary(localRows, mergedKeys)
      } else if (activeFlow === 'dynamic' && dynamicLayout === 'wide') {
        // Automatically determine time cols
        const actualGeoCols = geoMode === 'coordinate'
          ? [mergedKeys.lat, mergedKeys.lng, mergedKeys.province, mergedKeys.color].filter(Boolean)
          : [mapping.province, useDist ? mapping.district : '', useSub ? mapping.subdistrict : ''].filter(Boolean)
        const timeCols = localColumns.filter(c => !actualGeoCols.includes(c))
        result = await buildWideDictionary(localRows, mergedKeys, timeCols)
      } else {
        result = await buildDictionary(localRows, mergedKeys, groupingMode)
      }

      setDictionary(result.dictionary)
      setPeriods(result.periods)

      // Fallback displayMode to choropleth if we switched to custom colors
      if (useColor && activeFlow === 'static') {
        setColorMode('custom')
      } else {
        setColorMode('value')
      }

      notify('success', t('hub_plot_success'))
      setIsMappingOpen(false)
    } catch (err: any) {
      console.error(err)
      notify('error', t('hub_plot_failed', { msg: err.message }))
    } finally {
      setLoading(false)
    }
  }

  // Line listing conversion and Excel download
  const handleExportLineListing = async () => {
    if (localRows.length === 0) return
    setIsExporting(true)
    setLoading(true, t('ex_exporting_msg'))

    try {
      await locationResolver.init()

      const periodsMap = new Map<string, { key: string; label: string; date: Date }>()
      const dateMode = exportTimeMode
      const hasDateCol = !!mapping.date

      localRows.forEach(row => {
        let dateVal = hasDateCol ? row[mapping.date] : null
        let d = parseDate(dateVal)
        if (!d || isNaN(d.getTime())) {
          d = new Date('2026-01-01')
        }
        const key = toDateKey(d, dateMode)
        const yearFormat = useAppStore.getState().yearFormat || 'ce'
        const label = getPeriodLabel(d, dateMode, yearFormat)
        if (!periodsMap.has(key)) {
          periodsMap.set(key, { key, label, date: d })
        }
      })

      const sortedPeriods = Array.from(periodsMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime())

      const areaLevel = useSub ? 'subdistrict' : (useDist ? 'district' : 'province')
      const aggregated: Record<string, {
        codes: { pCode: string; aCode: string; tCode: string }
        names: { pName: string; aName: string; tName: string }
        vals: Record<string, number>
      }> = {}

      const unmatchedRows: any[] = []

      localRows.forEach(row => {
        const rawP = String(row[mapping.province] || '')
        const rawA = useDist ? String(row[mapping.district] || '') : ''
        const rawT = useSub ? String(row[mapping.subdistrict] || '') : ''

        const resolved = locationResolver.resolve(rawP, rawA, rawT)
        if (!resolved ||
          (areaLevel === 'district' && !resolved.aCode) ||
          (areaLevel === 'subdistrict' && !resolved.tCode)) {
          unmatchedRows.push(row)
          return
        }

        let areaKey = resolved.pCode
        if (areaLevel === 'district') areaKey = resolved.aCode
        if (areaLevel === 'subdistrict') areaKey = resolved.tCode

        let val = 1
        if (useVal && mapping.value) {
          val = cleanVal(row[mapping.value])
        }

        let dateVal = hasDateCol ? row[mapping.date] : null
        let d = parseDate(dateVal)
        if (!d || isNaN(d.getTime())) {
          d = new Date('2026-01-01')
        }
        const periodKey = toDateKey(d, dateMode)

        if (!aggregated[areaKey]) {
          aggregated[areaKey] = {
            codes: { pCode: resolved.pCode, aCode: resolved.aCode, tCode: resolved.tCode },
            names: { pName: resolved.pName, aName: resolved.aName, tName: resolved.tName },
            vals: {}
          }
        }

        aggregated[areaKey].vals[periodKey] = (aggregated[areaKey].vals[periodKey] || 0) + val
      })

      const sheetData: any[] = []
      const isTh = language === 'th'
      const colProv = isTh ? 'จังหวัด' : 'Province'
      const colDist = isTh ? 'อำเภอ' : 'District'
      const colSub = isTh ? 'ตำบล' : 'Subdistrict'
      const colProvCode = isTh ? 'รหัสจังหวัด' : 'Province Code'
      const colDistCode = isTh ? 'รหัสอำเภอ' : 'District Code'
      const colSubCode = isTh ? 'รหัสตำบล' : 'Subdistrict Code'
      const colPeriod = isTh ? 'ช่วงเวลา' : 'Period'
      const colCount = isTh ? 'จำนวนผู้ป่วย' : 'Cases'

      if (exportLayoutFormat === 'wide') {
        Object.entries(aggregated).forEach(([_, info]) => {
          const item: any = {}
          if (exportAdminFormat === 'code') {
            if (areaLevel === 'subdistrict') {
              item[colSubCode] = info.codes.tCode
              item[colDistCode] = info.codes.aCode
              item[colProvCode] = info.codes.pCode
            } else if (areaLevel === 'district') {
              item[colDistCode] = info.codes.aCode
              item[colProvCode] = info.codes.pCode
            } else {
              item[colProvCode] = info.codes.pCode
            }
          } else {
            item[colProv] = info.names.pName
            if (areaLevel === 'district' || areaLevel === 'subdistrict') {
              item[colDist] = info.names.aName
            }
            if (areaLevel === 'subdistrict') {
              item[colSub] = info.names.tName
            }
          }

          sortedPeriods.forEach(p => {
            item[p.key] = info.vals[p.key] || 0
          })

          sheetData.push(item)
        })
      } else {
        // LONG TIME-SERIES LIST FORMAT (Grouped by area and time period, omitting 0 counts)
        Object.entries(aggregated).forEach(([_, info]) => {
          sortedPeriods.forEach(p => {
            const count = info.vals[p.key] || 0
            if (count > 0) {
              const item: any = {}
              if (exportAdminFormat === 'code') {
                if (areaLevel === 'subdistrict') {
                  item[colSubCode] = info.codes.tCode
                  item[colDistCode] = info.codes.aCode
                  item[colProvCode] = info.codes.pCode
                } else if (areaLevel === 'district') {
                  item[colDistCode] = info.codes.aCode
                  item[colProvCode] = info.codes.pCode
                } else {
                  item[colProvCode] = info.codes.pCode
                }
              } else {
                item[colProv] = info.names.pName
                if (areaLevel === 'district' || areaLevel === 'subdistrict') {
                  item[colDist] = info.names.aName
                }
                if (areaLevel === 'subdistrict') {
                  item[colSub] = info.names.tName
                }
              }

              item[colPeriod] = p.key
              item[colCount] = count
              sheetData.push(item)
            }
          })
        })
      }

      const wb = XLSX.utils.book_new()
      const wsAgg = XLSX.utils.json_to_sheet(sheetData)
      const sheetTitle = isTh
        ? `ข้อมูลสรุป_${exportLayoutFormat === 'wide' ? 'Matrix' : 'แนวยาว'}`
        : `Summary_${exportLayoutFormat === 'wide' ? 'Matrix' : 'Long'}`
      XLSX.utils.book_append_sheet(wb, wsAgg, sheetTitle)

      if (unmatchedRows.length > 0) {
        const wsUnmatched = XLSX.utils.json_to_sheet(unmatchedRows)
        const unmatchedTitle = isTh ? 'ข้อมูลที่ไม่พบพิกัด' : 'Unmatched'
        XLSX.utils.book_append_sheet(wb, wsUnmatched, unmatchedTitle)
      }

      XLSX.writeFile(wb, `aggregated_${exportLayoutFormat}_${fileName.split('.')[0]}.xlsx`)
      notify('success', t('ex_export_success', { count: sheetData.length.toLocaleString() }))
      setIsExportOpen(false)
    } catch (err: any) {
      notify('error', t('ex_export_failed', { msg: err.message }))
    } finally {
      setIsExporting(false)
      setLoading(false)
    }
  }

  const resetUpload = () => {
    setLocalRows([])
    setLocalColumns([])
    setFileName('')
    setActiveId(null)
    setSheetNames([])
    setSelectedSheet('')
    workbookRef.current = null
    setMappingModalTab('upload')
  }

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-spatio-surface border border-spatio-border rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col h-[85vh] overflow-hidden relative">

        {/* ── Modal Header ── */}
        <div className="px-6 py-4 border-b border-spatio-border flex justify-between items-start">
          <div>
            <h3 className="text-lg font-black text-spatio-text flex items-center gap-2">
              <Sparkles className="text-blue-500 dark:text-blue-400" size={18} />
              <span>{t('hub_title')}</span>
            </h3>
            <p className="text-xs text-spatio-muted mt-0.5">
              {mappingModalTab === 'upload'
                ? t('hub_upload_desc')
                : t('hub_mapping_desc')}
            </p>
          </div>
          <button
            onClick={() => setIsMappingOpen(false)}
            className="p-1.5 rounded-lg text-spatio-muted hover:text-spatio-text hover:bg-spatio-surface-alt transition-colors self-center cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Modal Body ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {mappingModalTab === 'upload' ? (
            <div className="space-y-6 animate-fade-in">
              {/* Sub-tab selection: New Upload vs Saved Library */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-spatio-border pb-3 gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setUploadSubTab('new')}
                    className={clsx(
                      'px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer',
                      uploadSubTab === 'new'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-spatio-muted hover:text-spatio-text hover:bg-spatio-surface-alt'
                    )}
                  >
                    {t('hub_new_import')}
                  </button>
                  <button
                    onClick={() => setUploadSubTab('library')}
                    className={clsx(
                      'px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer',
                      uploadSubTab === 'library'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-spatio-muted hover:text-spatio-text hover:bg-spatio-surface-alt'
                    )}
                  >
                    {t('hub_saved_library', { count: datasets.length })}
                  </button>
                </div>
                {uploadSubTab === 'library' && (
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-spatio-muted font-mono">
                      {t('hub_storage_usage', { size: (storageUsageBytes / (1024 * 1024)).toFixed(2) })}
                    </span>
                    {datasets.length > 0 && (
                      <button
                        onClick={async () => {
                          const confirmMsg = language === 'th'
                            ? 'คุณแน่ใจหรือไม่ว่าต้องการลบชุดข้อมูลทั้งหมดออกจากคลังข้อมูลในเครื่อง? การดำเนินการนี้ไม่สามารถย้อนกลับได้'
                            : 'Are you sure you want to delete all datasets from local storage? This action cannot be undone.'
                          if (confirm(confirmMsg)) {
                            setLoading(true, language === 'th' ? 'กำลังลบข้อมูลทั้งหมด...' : 'Deleting all datasets...')
                            await clearAllDatasets()
                            setLoading(false)
                          }
                        }}
                        className="px-2.5 py-1 text-[10px] font-bold rounded bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white border border-rose-500/20 transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 size={11} />
                        <span>{language === 'th' ? 'ลบทั้งหมด' : 'Delete All'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {uploadSubTab === 'new' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* 1. Static Ingestion Card */}
                  <div className="spatio-card p-5 border-t-4 border-t-emerald-500 bg-spatio-surface-alt border border-spatio-border/60 flex flex-col justify-between gap-4">
                    <div className="space-y-2.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-lg">
                        <MapPin className="text-emerald-500 dark:text-emerald-400" size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-spatio-text">{t('dm_static_title')}</h4>
                        <p className="text-[11px] text-spatio-muted mt-1 leading-relaxed">
                          {t('dm_static_desc')}
                        </p>
                      </div>

                      <button
                        onClick={() => setPreviewType('static')}
                        className="text-[11px] font-bold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-1.5 transition-all bg-emerald-500/5 hover:bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20 w-fit mt-1 shadow-sm active:scale-95 cursor-pointer"
                      >
                        <Sparkles size={12} className="text-emerald-500 dark:text-emerald-400" />
                        <span>{t('dm_preview_show')}</span>
                      </button>
                    </div>

                    <div
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => handleFileDrop(e, 'static')}
                      className="border border-dashed border-spatio-border hover:border-emerald-500/50 rounded-xl p-4 bg-spatio-surface/40 flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer transition-all duration-300 group"
                    >
                      <Upload size={16} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] text-spatio-muted">{t('dm_drag_drop')}</span>
                      <label className="spatio-btn px-3 py-1 bg-spatio-surface border border-spatio-border hover:bg-emerald-600 hover:text-white text-[9px] text-spatio-text font-semibold rounded cursor-pointer transition-all">
                        {t('dm_select_file')}
                        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleFileChange(e, 'static')} />
                      </label>
                    </div>
                  </div>

                  {/* 2. Dynamic Ingestion Card */}
                  <div className="spatio-card p-5 border-t-4 border-t-blue-500 bg-spatio-surface-alt border border-spatio-border/60 flex flex-col justify-between gap-4">
                    <div className="space-y-2.5">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shadow-lg">
                        <Activity className="text-blue-500 dark:text-blue-400" size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-spatio-text">{t('dm_dynamic_title')}</h4>
                        <p className="text-[11px] text-spatio-muted mt-1 leading-relaxed">
                          {t('dm_dynamic_desc')}
                        </p>
                      </div>

                      <button
                        onClick={() => setPreviewType('dynamic_wide')}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1.5 transition-all bg-blue-500/5 hover:bg-blue-500/10 px-2.5 py-1.5 rounded-lg border border-blue-500/20 w-fit mt-1 shadow-sm active:scale-95 cursor-pointer"
                      >
                        <Sparkles size={12} className="text-blue-500 dark:text-blue-400" />
                        <span>{t('dm_preview_show')}</span>
                      </button>
                    </div>

                    <div
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => handleFileDrop(e, 'dynamic')}
                      className="border border-dashed border-spatio-border hover:border-blue-500/50 rounded-xl p-4 bg-spatio-surface/40 flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer transition-all duration-300 group"
                    >
                      <Upload size={16} className="text-blue-500 group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] text-spatio-muted">{t('dm_drag_drop_dynamic')}</span>
                      <label className="spatio-btn px-3 py-1 bg-spatio-surface border border-spatio-border hover:bg-blue-600 hover:text-white text-[9px] text-spatio-text font-semibold rounded cursor-pointer transition-all">
                        {t('dm_select_file')}
                        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleFileChange(e, 'dynamic')} />
                      </label>
                    </div>
                  </div>

                  {/* 3. Line Listing Card */}
                  <div className="spatio-card p-5 border-t-4 border-t-indigo-500 bg-spatio-surface-alt border border-spatio-border/60 flex flex-col justify-between gap-4">
                    <div className="space-y-2.5">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-lg">
                        <Users className="text-indigo-500 dark:text-indigo-400" size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-spatio-text">{t('dm_linelist_title')}</h4>
                        <p className="text-[11px] text-spatio-muted mt-1 leading-relaxed">
                          {t('dm_linelist_desc')}
                        </p>
                      </div>
                      <button
                        onClick={() => setPreviewType('linelist')}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1.5 transition-all bg-indigo-500/5 hover:bg-indigo-500/10 px-2.5 py-1.5 rounded-lg border border-indigo-500/20 w-fit mt-1 shadow-sm active:scale-95 cursor-pointer"
                      >
                        <Sparkles size={12} className="text-indigo-500 dark:text-indigo-400" />
                        <span>{t('dm_preview_show')}</span>
                      </button>
                    </div>

                    <div
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => handleFileDrop(e, 'linelist')}
                      className="border border-dashed border-spatio-border hover:border-indigo-500/50 rounded-xl p-4 bg-spatio-surface/40 flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer transition-all duration-300 group"
                    >
                      <Upload size={16} className="text-indigo-500 group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] text-spatio-muted">{t('dm_drag_drop_linelist')}</span>
                      <label className="spatio-btn px-3 py-1 bg-spatio-surface border border-spatio-border hover:bg-indigo-600 hover:text-white text-[9px] text-spatio-text font-semibold rounded cursor-pointer transition-all">
                        {t('dm_select_file')}
                        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleFileChange(e, 'linelist')} />
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Database Information Block */}
                  <div className="p-4 rounded-xl border border-blue-500/20 dark:border-blue-500/10 bg-blue-50 dark:bg-blue-500/5 flex items-start gap-3 text-xs text-spatio-muted">
                    <span className="text-xl">🛡️</span>
                    <div className="space-y-1">
                      <span className="font-bold text-spatio-text block">{t('hub_indexeddb_info')}</span>
                      <p className="leading-relaxed">
                        {t('hub_indexeddb_desc')}
                      </p>
                      <span className="text-[10px] text-spatio-muted block leading-tight mt-1.5">
                        {t('hub_indexeddb_tip')}
                      </span>
                    </div>
                  </div>

                  {datasets.length === 0 ? (
                    <div className="p-12 text-center border border-dashed border-spatio-border rounded-xl space-y-3">
                      <p className="text-xs text-spatio-muted">{t('hub_empty_library')}</p>
                      <button
                        onClick={() => setUploadSubTab('new')}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all cursor-pointer"
                      >
                        {t('hub_import_first_btn')}
                      </button>
                    </div>
                  ) : (
                    <div className="border border-spatio-border rounded-xl overflow-hidden bg-spatio-surface-alt divide-y divide-spatio-border max-h-[350px] overflow-y-auto">
                      {datasets.map((ds) => {
                        const isActive = rawRows.length > 0 && activeDatasetId === ds.id;
                        return (
                          <div key={ds.id} className={clsx(
                            "p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-spatio-surface-hover transition-colors",
                            isActive && "bg-blue-500/5 dark:bg-blue-950/15 border-l-4 border-l-blue-500"
                          )}>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-spatio-text truncate max-w-xs sm:max-w-md block">{ds.fileName}</span>
                                {isActive && (
                                  <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[9px] uppercase font-bold">
                                    {t('hub_active_label')}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-spatio-muted flex items-center gap-2 flex-wrap">
                                <span>{t('hub_meta_rows', { count: ds.rowCount.toLocaleString() })}</span>
                                <span className="text-spatio-border">•</span>
                                <span>{language === 'th' ? `อัปโหลดเมื่อ: ${new Date(ds.loadedAt).toLocaleString()}` : `Uploaded at: ${new Date(ds.loadedAt).toLocaleString()}`}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={async () => {
                                  setLoading(true, language === 'th' ? 'กำลังโหลดข้อมูลจากคลังส่วนตัว...' : 'Loading dataset from local storage...')
                                  await loadDatasetById(ds.id)
                                  setLoading(false)
                                  setIsMappingOpen(false)
                                }}
                                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all active:scale-95 cursor-pointer"
                              >
                                {t('hub_load_dataset_btn')}
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm(t('hub_delete_confirm'))) {
                                    await deleteDatasetById(ds.id)
                                  }
                                }}
                                className="p-2 rounded-lg bg-spatio-surface hover:bg-rose-500/10 text-spatio-muted hover:text-rose-600 border border-spatio-border hover:border-rose-500 transition-all active:scale-95 cursor-pointer"
                                title={t('hub_delete_title')}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-fade-in">
              {/* Left Column: Mapping options */}
              <div className="lg:col-span-3 space-y-4">
                {/* Meta Summary Block */}
                <div className="flex items-center justify-between gap-3 bg-spatio-surface border border-spatio-border p-4 rounded-xl shadow-inner">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded bg-blue-500/10 border border-blue-500/25">
                      <FileSpreadsheet className="text-blue-500 dark:text-blue-400" size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-spatio-text truncate max-w-[200px] md:max-w-xs">{fileName}</div>
                      <div className="text-[10px] text-spatio-muted mt-0.5">
                        {t('hub_meta_cols', { count: localColumns.length })} | {t('hub_meta_rows', { count: localRows.length.toLocaleString() })}
                      </div>
                    </div>
                  </div>
                  <button onClick={resetUpload} className="px-2.5 py-1 rounded bg-spatio-surface hover:bg-spatio-surface-hover text-spatio-text text-[10px] border border-spatio-border flex items-center gap-1 transition-colors cursor-pointer">
                    <X size={11} />
                    <span>{t('hub_choose_mode')}</span>
                  </button>
                </div>

                {/* Sheet Selector (multi-sheet Excel) */}
                {sheetNames.length > 1 && (
                  <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-400/30 dark:border-amber-500/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 animate-fade-in">
                    <div className="flex items-center gap-2 shrink-0">
                      <FileSpreadsheet size={14} className="text-amber-500" />
                      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                        {t('hub_sheets_found', { count: sheetNames.length })}
                      </span>
                    </div>
                    <select
                      value={selectedSheet}
                      onChange={e => {
                        const sheetName = e.target.value
                        setSelectedSheet(sheetName)
                        if (workbookRef.current) {
                          try {
                            processSheet(workbookRef.current, sheetName, pendingFlowRef.current)
                          } catch (err) {
                            console.error(err)
                          }
                        }
                      }}
                      className="flex-1 text-[11px] px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-600/40 rounded-lg text-spatio-text focus:ring-1 focus:ring-amber-400 focus:outline-none"
                    >
                      {sheetNames.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="spatio-card p-5 space-y-4 bg-spatio-surface border border-spatio-border">
                  <div className="flex items-center gap-2 border-b border-spatio-border pb-3">
                    <Settings size={14} className="text-blue-500 dark:text-blue-400 animate-spin-slow" />
                    <h4 className="text-xs font-black text-spatio-text">{t('tbl_col_mapping')}</h4>
                  </div>

                  {/* Geographic Mode Switcher */}
                  <div className="bg-spatio-surface-alt p-2.5 rounded-xl border border-spatio-border space-y-2">
                    <span className="block text-[9px] text-spatio-muted font-bold uppercase tracking-wider select-none px-1">
                      {t('hub_geo_mode')}
                    </span>
                    <div className="bg-spatio-surface p-1 rounded-lg border border-spatio-border flex gap-1">
                      <button
                        onClick={() => setGeoMode('admin')}
                        className={clsx(
                          'flex-1 text-center py-1.5 text-[10px] rounded font-bold transition-all cursor-pointer',
                          geoMode === 'admin' ? 'bg-blue-600 text-white shadow' : 'text-spatio-muted hover:text-spatio-text'
                        )}
                      >
                        {t('hub_geo_boundary')}
                      </button>
                      <button
                        onClick={() => setGeoMode('coordinate')}
                        className={clsx(
                          'flex-1 text-center py-1.5 text-[10px] rounded font-bold transition-all cursor-pointer',
                          geoMode === 'coordinate' ? 'bg-blue-600 text-white shadow' : 'text-spatio-muted hover:text-spatio-text'
                        )}
                      >
                        {t('hub_geo_points')}
                      </button>
                    </div>
                  </div>

                  {activeFlow === 'dynamic' && (
                    <div className="bg-spatio-surface p-1 rounded-lg border border-spatio-border flex gap-1">
                      <button
                        onClick={() => setDynamicLayout('wide')}
                        className={clsx(
                          'flex-1 text-center py-1.5 text-[10px] rounded font-bold transition-all cursor-pointer',
                          dynamicLayout === 'wide' ? 'bg-blue-600 text-white shadow' : 'text-spatio-muted hover:text-spatio-text'
                        )}
                      >
                        {t('tbl_wide_matrix')}
                      </button>
                      <button
                        onClick={() => setDynamicLayout('long')}
                        className={clsx(
                          'flex-1 text-center py-1.5 text-[10px] rounded font-bold transition-all cursor-pointer',
                          dynamicLayout === 'long' ? 'bg-blue-600 text-white shadow' : 'text-spatio-muted hover:text-spatio-text'
                        )}
                      >
                        {t('tbl_long_list')}
                      </button>
                    </div>
                  )}

                  <div className="space-y-3">
                    {/* Date Column mapping */}
                    {((activeFlow === 'dynamic' && dynamicLayout === 'long') || activeFlow === 'linelist') && (
                      <div className="flex items-center gap-3 bg-spatio-surface/40 border border-spatio-border px-3 py-2.5 rounded-xl">
                        <div className="w-28 shrink-0">
                          <span className="text-[11px] font-semibold text-spatio-text block">{t('hub_map_date')} <span className="text-red-400">*</span></span>
                          <span className="text-[9px] text-spatio-muted block leading-tight">{t('hub_map_date_desc')}</span>
                        </div>
                        <select
                          value={mapping.date}
                          onChange={e => setMapping({ ...mapping, date: e.target.value })}
                          className="flex-1 text-[11px] px-2 py-1.5 bg-spatio-surface border border-spatio-border rounded-lg text-spatio-text"
                        >
                          <option value="">{t('hub_select_date_col')}</option>
                          {localColumns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    )}

                    {geoMode === 'coordinate' ? (
                      <>
                        {/* Latitude Column */}
                        <div className="flex items-center gap-3 bg-spatio-surface/40 border border-spatio-border px-3 py-2.5 rounded-xl border-l-4 border-l-blue-500">
                          <div className="w-28 shrink-0">
                            <span className="text-[11px] font-bold text-spatio-text block">{t('hub_map_latitude')} <span className="text-red-400 font-bold">*</span></span>
                            <span className="text-[9px] text-spatio-muted block leading-tight">{t('hub_map_latitude_desc')}</span>
                          </div>
                          <select
                            value={mapping.lat}
                            onChange={e => setMapping({ ...mapping, lat: e.target.value })}
                            className="flex-1 text-[11px] px-2 py-1.5 bg-spatio-surface border border-spatio-border rounded-lg text-spatio-text"
                          >
                            <option value="">{t('hub_select_lat_col')}</option>
                            {localColumns.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>

                        {/* Longitude Column */}
                        <div className="flex items-center gap-3 bg-spatio-surface/40 border border-spatio-border px-3 py-2.5 rounded-xl border-l-4 border-l-blue-500">
                          <div className="w-28 shrink-0">
                            <span className="text-[11px] font-bold text-spatio-text block">{t('hub_map_longitude')} <span className="text-red-400 font-bold">*</span></span>
                            <span className="text-[9px] text-spatio-muted block leading-tight">{t('hub_map_longitude_desc')}</span>
                          </div>
                          <select
                            value={mapping.lng}
                            onChange={e => setMapping({ ...mapping, lng: e.target.value })}
                            className="flex-1 text-[11px] px-2 py-1.5 bg-spatio-surface border border-spatio-border rounded-lg text-spatio-text"
                          >
                            <option value="">{t('hub_select_lng_col')}</option>
                            {localColumns.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>

                        {/* Province / Location Label Column (Optional for tooltip labeling) */}
                        <div className="flex items-center gap-3 bg-spatio-surface/40 border border-spatio-border px-3 py-2.5 rounded-xl">
                          <div className="w-28 shrink-0">
                            <span className="text-[11px] font-semibold text-spatio-text block">{language === 'th' ? 'ป้ายกำกับจุด (Label)' : 'Point Label'}</span>
                            <span className="text-[9px] text-spatio-muted block leading-tight">{language === 'th' ? 'ชื่อสถานที่/จังหวัด' : 'Location/Province name'}</span>
                          </div>
                          <select
                            value={mapping.province}
                            onChange={e => setMapping({ ...mapping, province: e.target.value })}
                            className="flex-1 text-[11px] px-2 py-1.5 bg-spatio-surface border border-spatio-border rounded-lg text-spatio-text"
                          >
                            <option value="">{language === 'th' ? '— เลือกคอลัมน์ชื่อสถานที่/จังหวัด (เลือกใส่) —' : '— Select location/province column (optional) —'}</option>
                            {localColumns.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Province Column */}
                        <div className="flex items-center gap-3 bg-spatio-surface/40 border border-spatio-border px-3 py-2.5 rounded-xl">
                          <div className="w-28 shrink-0">
                            <span className="text-[11px] font-semibold text-spatio-text block">{t('hub_map_province')} <span className="text-red-400">*</span></span>
                            <span className="text-[9px] text-spatio-muted block leading-tight">{t('hub_map_province_desc')}</span>
                          </div>
                          <select
                            value={mapping.province}
                            onChange={e => setMapping({ ...mapping, province: e.target.value })}
                            className="flex-1 text-[11px] px-2 py-1.5 bg-spatio-surface border border-spatio-border rounded-lg text-spatio-text"
                          >
                            <option value="">{t('hub_select_prov_col')}</option>
                            {localColumns.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>

                        {/* District Column */}
                        <div className="flex items-center gap-3 bg-spatio-surface/40 border border-spatio-border px-3 py-2.5 rounded-xl">
                          <div className="w-28 shrink-0 flex items-center gap-1">
                            <input type="checkbox" id="modal-dist-chk" checked={useDist} onChange={e => setUseDist(e.target.checked)} className="rounded bg-spatio-surface border-spatio-border accent-blue-500 w-3.5 h-3.5" />
                            <label htmlFor="modal-dist-chk" className="text-[11px] font-semibold text-spatio-text cursor-pointer">{t('hub_use_district')}</label>
                          </div>
                          <select
                            disabled={!useDist}
                            value={mapping.district}
                            onChange={e => setMapping({ ...mapping, district: e.target.value })}
                            className="flex-1 text-[11px] px-2 py-1.5 bg-spatio-surface border border-spatio-border rounded-lg text-spatio-text disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <option value="">{t('hub_select_dist_col')}</option>
                            {localColumns.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>

                        {/* Subdistrict Column */}
                        <div className="flex items-center gap-3 bg-spatio-surface/40 border border-spatio-border px-3 py-2.5 rounded-xl">
                          <div className="w-28 shrink-0 flex items-center gap-1">
                            <input type="checkbox" id="modal-sub-chk" checked={useSub} onChange={e => setUseSub(e.target.checked)} className="rounded bg-spatio-surface border-spatio-border accent-blue-500 w-3.5 h-3.5" />
                            <label htmlFor="modal-sub-chk" className="text-[11px] font-semibold text-spatio-text cursor-pointer">{t('hub_use_subdistrict')}</label>
                          </div>
                          <select
                            disabled={!useSub}
                            value={mapping.subdistrict}
                            onChange={e => setMapping({ ...mapping, subdistrict: e.target.value })}
                            className="flex-1 text-[11px] px-2 py-1.5 bg-spatio-surface border border-spatio-border rounded-lg text-spatio-text disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <option value="">{t('hub_select_subdist_col')}</option>
                            {localColumns.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </>
                    )}

                    {/* Value Column */}
                    {((activeFlow === 'static') || (activeFlow === 'dynamic' && dynamicLayout === 'long') || activeFlow === 'linelist') && (
                      <div className="flex items-center gap-3 bg-spatio-surface/40 border border-spatio-border px-3 py-2.5 rounded-xl">
                        <div className="w-28 shrink-0 flex items-center gap-1">
                          <input type="checkbox" id="modal-val-chk" checked={useVal} onChange={e => setUseVal(e.target.checked)} className="rounded bg-spatio-surface border-spatio-border accent-blue-500 w-3.5 h-3.5" />
                          <label htmlFor="modal-val-chk" className="text-[11px] font-semibold text-spatio-text cursor-pointer">
                            {activeFlow === 'linelist' ? t('hub_use_weight') : t('hub_use_value')}
                          </label>
                        </div>
                        <select
                          disabled={!useVal}
                          value={mapping.value}
                          onChange={e => setMapping({ ...mapping, value: e.target.value })}
                          className="flex-1 text-[11px] px-2 py-1.5 bg-spatio-surface border border-spatio-border rounded-lg text-spatio-text disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <option value="">{activeFlow === 'linelist' ? t('hub_select_val_col_linelist') : t('hub_select_val_col')}</option>
                          {localColumns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    )}

                    {/* Color Column */}
                    {activeFlow === 'static' && (
                      <div className="flex items-center gap-3 bg-spatio-surface/40 border border-spatio-border px-3 py-2.5 rounded-xl">
                        <div className="w-28 shrink-0 flex items-center gap-1">
                          <input type="checkbox" id="modal-color-chk" checked={useColor} onChange={e => setUseColor(e.target.checked)} className="rounded bg-spatio-surface border-spatio-border accent-blue-500 w-3.5 h-3.5" />
                          <label htmlFor="modal-color-chk" className="text-[11px] font-semibold text-spatio-text cursor-pointer">{t('hub_use_custom_color')}</label>
                        </div>
                        <select
                          disabled={!useColor}
                          value={mapping.color}
                          onChange={e => setMapping({ ...mapping, color: e.target.value })}
                          className="flex-1 text-[11px] px-2 py-1.5 bg-spatio-surface border border-spatio-border rounded-lg text-spatio-text disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <option value="">{t('hub_select_color_col')}</option>
                          {localColumns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Execution tools */}
              <div className="lg:col-span-2 space-y-4 flex flex-col justify-between">
                <div className="spatio-card p-5 border border-blue-500/20 dark:border-blue-500/10 shadow-lg flex-1 flex flex-col justify-between gap-5 bg-spatio-surface">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 border-b border-spatio-border pb-3">
                      <Sparkles size={14} className="text-blue-500 dark:text-blue-400 animate-pulse" />
                      <h4 className="text-xs font-black text-spatio-text">{t('hub_plot_title')}</h4>
                    </div>
                    <p className="text-[11px] text-spatio-muted leading-relaxed">
                      {t('hub_plot_desc')}
                    </p>
                  </div>

                  <button
                    onClick={handleLoadToMap}
                    disabled={
                      geoMode === 'coordinate'
                        ? (!mapping.lat || !mapping.lng || (((activeFlow === 'dynamic' && dynamicLayout === 'long') || activeFlow === 'linelist') && !mapping.date))
                        : (!mapping.province || (((activeFlow === 'dynamic' && dynamicLayout === 'long') || activeFlow === 'linelist') && !mapping.date))
                    }
                    className={clsx(
                      'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all active:scale-95 shadow-md shadow-blue-950/20',
                      (geoMode === 'coordinate'
                        ? (!mapping.lat || !mapping.lng || (((activeFlow === 'dynamic' && dynamicLayout === 'long') || activeFlow === 'linelist') && !mapping.date))
                        : (!mapping.province || (((activeFlow === 'dynamic' && dynamicLayout === 'long') || activeFlow === 'linelist') && !mapping.date)))
                        ? 'bg-spatio-surface-alt border border-spatio-border text-spatio-muted/50 cursor-not-allowed shadow-none'
                        : 'bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white hover:opacity-95'
                    )}
                  >
                    <span>{language === 'th' ? 'ยืนยันและพล็อตแผนที่' : 'Confirm and Plot Map'}</span>
                    <ArrowRight size={12} />
                  </button>
                </div>

                {activeFlow === 'linelist' && (
                  <div className="spatio-card p-5 border border-indigo-500/15 bg-spatio-surface-alt space-y-4 shadow-sm">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 border-b border-spatio-border pb-2">
                        <Download size={14} className="text-indigo-500 dark:text-indigo-400" />
                        <h4 className="text-xs font-bold text-spatio-text">{language === 'th' ? 'จัดกลุ่มความถี่ & แปลงสรุป Excel' : 'Group Intervals & Convert Excel'}</h4>
                      </div>
                      <p className="text-[10px] text-spatio-muted leading-relaxed">
                        {language === 'th'
                          ? 'มีตาราง Line List รายบุคคลเชิงเดี่ยวอยู่ อยากแปลงความถี่เป็นแบบตารางกวาด (Matrix/Long) กดปุ่มนี้เพื่อตั้งค่าจัดกลุ่มเวลาแล้วดาวน์โหลดทันที'
                          : 'If you have a raw line listing, you can aggregate and convert it into a wide matrix or long series layout here.'}
                      </p>
                    </div>

                    <button
                      onClick={() => setIsExportOpen(true)}
                      disabled={!mapping.province || !mapping.date}
                      className={clsx(
                        'w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold border transition-all active:scale-95 cursor-pointer',
                        (!mapping.province || !mapping.date)
                          ? 'bg-spatio-surface border border-spatio-border text-spatio-muted/50 cursor-not-allowed shadow-none'
                          : 'border-indigo-600 dark:border-indigo-500 text-indigo-700 dark:text-indigo-350 bg-indigo-50 dark:bg-indigo-950/20 hover:bg-indigo-650 dark:hover:bg-indigo-500 dark:hover:text-white hover:text-white'
                      )}
                    >
                      <span>{language === 'th' ? 'แปลง & ดาวน์โหลดตาราง Excel...' : 'Aggregate & Download Excel...'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <ExportModal
        isExportOpen={isExportOpen}
        setIsExportOpen={setIsExportOpen}
        exportTimeMode={exportTimeMode}
        setExportTimeMode={setExportTimeMode}
        exportAdminFormat={exportAdminFormat}
        setExportAdminFormat={setExportAdminFormat}
        exportLayoutFormat={exportLayoutFormat}
        setExportLayoutFormat={setExportLayoutFormat}
        isExporting={isExporting}
        handleExportLineListing={handleExportLineListing}
      />

      <PreviewTable
        previewType={previewType}
        setPreviewType={setPreviewType}
      />
    </div>
  )
}

