/**
 * useMappingState.ts — Centralized state and handlers for MappingModal
 * ดึง state + handlers ทั้งหมดออกมาจาก MappingModal component
 */
import { useState, useEffect } from 'react'
import { useAppStore, type DataKeys } from '../../../store/useAppStore'
import { locationResolver } from '../../../data/locationResolver'
import { parseDate, toDateKey, getPeriodLabel, type DateMode } from '../../../data/dateParser'
import { buildDictionary, buildStaticDictionary, buildWideDictionary, clearCumulativeCache } from '../../../data/aggregator'
import * as XLSX from 'xlsx'
import { readCsvToWorkbook } from '../../../data/encoding'

export type FlowType = 'static' | 'dynamic' | 'linelist'
export type DynamicLayout = 'wide' | 'long'

export interface MappingState {
  // Flow controls
  activeFlow: FlowType
  setActiveFlow: (f: FlowType) => void
  dynamicLayout: DynamicLayout
  setDynamicLayout: (l: DynamicLayout) => void

  // Preview
  previewType: 'static' | 'dynamic_wide' | 'dynamic_long' | 'linelist' | null
  setPreviewType: (t: 'static' | 'dynamic_wide' | 'dynamic_long' | 'linelist' | null) => void

  // File states
  fileName: string
  localRows: any[]
  localColumns: string[]

  // Column mapping
  mapping: DataKeys
  setMapping: (m: DataKeys) => void
  useDist: boolean
  setUseDist: (v: boolean) => void
  useSub: boolean
  setUseSub: (v: boolean) => void
  useVal: boolean
  setUseVal: (v: boolean) => void
  useColor: boolean
  setUseColor: (v: boolean) => void

  // Export dialog
  isExportOpen: boolean
  setIsExportOpen: (v: boolean) => void
  exportTimeMode: DateMode
  setExportTimeMode: (m: DateMode) => void
  exportAdminFormat: 'thai' | 'code'
  setExportAdminFormat: (f: 'thai' | 'code') => void
  exportLayoutFormat: 'wide' | 'long'
  setExportLayoutFormat: (f: 'wide' | 'long') => void
  isExporting: boolean

  // Handlers
  handleFileDrop: (e: React.DragEvent<HTMLDivElement>, flow: FlowType) => void
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>, flow: FlowType) => void
  handleLoadToMap: () => Promise<void>
  handleExportLineListing: () => Promise<void>
  resetUpload: () => void
  runAutoDetect: (cols: string[], flow: FlowType) => void

  // Store passthrough (needed by sub-components)
  groupingMode: string
  geoMode: string
  setGeoMode: (m: 'admin' | 'coordinate') => void
  mappingModalTab: string
  setMappingModalTab: (t: 'upload' | 'mapping') => void
  setIsMappingOpen: (v: boolean) => void
}

export function useMappingState(): MappingState {
  const {
    isMappingOpen,
    setIsMappingOpen,
    rawRows,
    setRawRows,
    dataKeys,
    setDataKeys,
    setDictionary,
    setPeriods,
    groupingMode,
    setGroupingMode: _setGroupingMode,
    colorMode: _colorMode,
    setColorMode,
    mappingModalTab,
    setMappingModalTab,
    ingestionMode,
    setIngestionMode,
    setLoading,
    notify,
    geoMode,
    setGeoMode,
    activeDatasetId,
    datasets
  } = useAppStore()

  // Flow controls
  const [activeFlow, setActiveFlow] = useState<FlowType>('static')
  const [dynamicLayout, setDynamicLayout] = useState<DynamicLayout>('wide')
  const [activeId, setActiveId] = useState<string | null>(null)

  // Preview lightbox
  const [previewType, setPreviewType] = useState<'static' | 'dynamic_wide' | 'dynamic_long' | 'linelist' | null>(null)

  // File states
  const [fileName, setFileName] = useState<string>('')
  const [localRows, setLocalRows] = useState<any[]>([])
  const [localColumns, setLocalColumns] = useState<string[]>([])

  // Column mapping
  const [mapping, setMapping] = useState<DataKeys>({
    date: '', province: '', district: '', subdistrict: '', lat: '', lng: '', value: '', color: ''
  })
  const [useDist, setUseDist] = useState(true)
  const [useSub, setUseSub] = useState(false)
  const [useVal, setUseVal] = useState(true)
  const [useColor, setUseColor] = useState(false)

  // Export dialog
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [exportTimeMode, setExportTimeMode] = useState<DateMode>('weekly')
  const [exportAdminFormat, setExportAdminFormat] = useState<'thai' | 'code'>('thai')
  const [exportLayoutFormat, setExportLayoutFormat] = useState<'wide' | 'long'>('wide')
  const [isExporting, setIsExporting] = useState(false)

  // Auto-fill from store when modal opens with existing data
  useEffect(() => {
    if (isMappingOpen && rawRows.length > 0 && datasets.length > 0) {
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

      if (ingestionMode === 'admin_static' || ingestionMode === 'coord_static') {
        setActiveFlow('static')
      } else if (!!dataKeys.date) {
        if (rawRows[0] && Object.keys(rawRows[0]).includes(dataKeys.date)) {
          setActiveFlow(dataKeys.value ? 'dynamic' : 'linelist')
          setDynamicLayout('long')
        }
      } else {
        setActiveFlow('dynamic')
        setDynamicLayout('wide')
      }
    }
  }, [isMappingOpen, rawRows, dataKeys, ingestionMode, activeDatasetId, datasets])

  // ── Column Auto-Detect ──
  const runAutoDetect = (cols: string[], flow: FlowType) => {
    const patterns: Record<string, RegExp> = {
      province:    /รหัสจังหวัด|^(จังหวัด|จ\.|province|changwat|p_code|pcode|pv_code)/i,
      district:    /รหัสอำเภอ|^(อำเภอ|อ\.|district|amphur|amphoe|a_code|acode|am_code)/i,
      subdistrict: /รหัสตำบล|^(ตำบล|ต\.|subdist|tambon|t_code|tcode|t_code_full)/i,
      date:        /วัน|date|time/i,
      value:       /จำนวน|ยอด|ราย|ผู้ป่วย|case|patient|value|count|total|ปริมาณ/i,
      color:       /^(สี|color|hex)$/i,
      lat:         /^(lat|latitude|ละติจูด|พิกัด_y|พิกัดy|y|y_coord)/i,
      lng:         /^(lon|lng|long|longitude|ลองจิจูด|พิกัด_x|พิกัดx|x|x_coord)/i,
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

  // ── File Loading ──
  const loadFile = (file: File, flow: FlowType) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      notify('error', 'รองรับเฉพาะไฟล์ .xlsx, .xls, .csv')
      return
    }

    setLoading(true, `กำลังอ่านไฟล์สำหรับ ${flow === 'static' ? 'Static Map' : flow === 'dynamic' ? 'Dynamic Map' : 'Line Listing'}...`)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        let workbook: XLSX.WorkBook
        if (file.name.toLowerCase().endsWith('.csv')) {
          workbook = readCsvToWorkbook(data)
        } else {
          workbook = XLSX.read(data, { type: 'array', cellDates: true })
        }
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rawJson: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

        if (rawJson.length === 0) {
          throw new Error('ไม่พบข้อมูลในไฟล์ Excel')
        }

        const cols = Object.keys(rawJson[0])
        setLocalRows(rawJson)
        setLocalColumns(cols)
        setFileName(file.name)
        setActiveFlow(flow)
        runAutoDetect(cols, flow)
        setMappingModalTab('mapping')
        notify('success', `อัปโหลดไฟล์สำเร็จ — พบข้อมูล ${rawJson.length.toLocaleString()} แถว`)
      } catch (err: any) {
        notify('error', `อ่านไฟล์ล้มเหลว: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>, flow: FlowType) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) loadFile(file, flow)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, flow: FlowType) => {
    const file = e.target.files?.[0]
    if (file) loadFile(file, flow)
  }

  const cleanVal = (val: any) => {
    if (val === undefined || val === null || val === '') return 0
    const parsed = parseFloat(String(val).replace(/,/g, '').trim())
    return isNaN(parsed) ? 0 : parsed
  }

  // ── Load to Map ──
  const handleLoadToMap = async () => {
    if (localRows.length === 0) return
    setLoading(true, 'กำลังเตรียมประมวลผลตำแหน่งพล็อตแผนที่...')

    try {
      // 0. รีเซ็ตสถานะเก่าใน Store ทั้งหมดเพื่อเริ่มต้นใหม่อย่างสะอาด (Pristine state reset)
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

      setDataKeys(mergedKeys)
      setRawRows(localRows, {
        id: activeId || undefined,
        fileName,
        rowCount: localRows.length,
        keys: mergedKeys,
        loadedAt: new Date()
      })

      clearCumulativeCache()

      let result
      if (activeFlow === 'static') {
        setIngestionMode(geoMode === 'coordinate' ? 'coord_static' : 'admin_static')
        result = await buildStaticDictionary(localRows, mergedKeys)
      } else if (activeFlow === 'dynamic' && dynamicLayout === 'wide') {
        setIngestionMode(geoMode === 'coordinate' ? 'coord_dynamic' : 'admin_dynamic')
        const actualGeoCols = geoMode === 'coordinate'
          ? [mergedKeys.lat, mergedKeys.lng, mergedKeys.province, mergedKeys.color].filter(Boolean)
          : [mapping.province, useDist ? mapping.district : '', useSub ? mapping.subdistrict : ''].filter(Boolean)
        const timeCols = localColumns.filter(c => !actualGeoCols.includes(c))
        result = await buildWideDictionary(localRows, mergedKeys, timeCols)
      } else {
        setIngestionMode(geoMode === 'coordinate' ? 'coord_dynamic' : 'admin_dynamic')
        result = await buildDictionary(localRows, mergedKeys, groupingMode as any)
      }

      setDictionary(result.dictionary)
      setPeriods(result.periods)

      if (useColor && activeFlow === 'static') {
        setColorMode('custom')
      } else {
        setColorMode('value')
      }

      notify('success', `พล็อตขอบเขตข้อมูลเรียบร้อยแล้ว`)
      setIsMappingOpen(false)
    } catch (err: any) {
      console.error(err)
      notify('error', `โหลดแผนที่ขัดข้อง: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // ── Export Line Listing ──
  const handleExportLineListing = async () => {
    if (localRows.length === 0) return
    setIsExporting(true)
    setLoading(true, 'กำลังประมวลผลจัดกลุ่มข้อมูลเพื่อดาวน์โหลด Excel...')

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
        const label = getPeriodLabel(d, dateMode)
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

      if (exportLayoutFormat === 'wide') {
        Object.entries(aggregated).forEach(([_, info]) => {
          const item: any = {}
          if (exportAdminFormat === 'code') {
            if (areaLevel === 'subdistrict') {
              item['รหัสตำบล'] = info.codes.tCode
              item['รหัสอำเภอ'] = info.codes.aCode
              item['รหัสจังหวัด'] = info.codes.pCode
            } else if (areaLevel === 'district') {
              item['รหัสอำเภอ'] = info.codes.aCode
              item['รหัสจังหวัด'] = info.codes.pCode
            } else {
              item['รหัสจังหวัด'] = info.codes.pCode
            }
          } else {
            item['จังหวัด'] = info.names.pName
            if (areaLevel === 'district' || areaLevel === 'subdistrict') {
              item['อำเภอ'] = info.names.aName
            }
            if (areaLevel === 'subdistrict') {
              item['ตำบล'] = info.names.tName
            }
          }
          sortedPeriods.forEach(p => {
            item[p.key] = info.vals[p.key] || 0
          })
          sheetData.push(item)
        })
      } else {
        Object.entries(aggregated).forEach(([_, info]) => {
          sortedPeriods.forEach(p => {
            const count = info.vals[p.key] || 0
            if (count > 0) {
              const item: any = {}
              if (exportAdminFormat === 'code') {
                if (areaLevel === 'subdistrict') {
                  item['รหัสตำบล'] = info.codes.tCode
                  item['รหัสอำเภอ'] = info.codes.aCode
                  item['รหัสจังหวัด'] = info.codes.pCode
                } else if (areaLevel === 'district') {
                  item['รหัสอำเภอ'] = info.codes.aCode
                  item['รหัสจังหวัด'] = info.codes.pCode
                } else {
                  item['รหัสจังหวัด'] = info.codes.pCode
                }
              } else {
                item['จังหวัด'] = info.names.pName
                if (areaLevel === 'district' || areaLevel === 'subdistrict') {
                  item['อำเภอ'] = info.names.aName
                }
                if (areaLevel === 'subdistrict') {
                  item['ตำบล'] = info.names.tName
                }
              }
              item['ช่วงเวลา'] = p.key
              item['จำนวนผู้ป่วย'] = count
              sheetData.push(item)
            }
          })
        })
      }

      const wb = XLSX.utils.book_new()
      const wsAgg = XLSX.utils.json_to_sheet(sheetData)
      XLSX.utils.book_append_sheet(wb, wsAgg, `ข้อมูลสรุป_${exportLayoutFormat === 'wide' ? 'Matrix' : 'แนวยาว'}`)

      if (unmatchedRows.length > 0) {
        const wsUnmatched = XLSX.utils.json_to_sheet(unmatchedRows)
        XLSX.utils.book_append_sheet(wb, wsUnmatched, 'ข้อมูลที่ไม่พบพิกัด')
      }

      XLSX.writeFile(wb, `aggregated_${exportLayoutFormat}_${fileName.split('.')[0]}.xlsx`)
      notify('success', `ดาวน์โหลดสำเร็จ! (จำนวน ${sheetData.length.toLocaleString()} แถว)`)
      setIsExportOpen(false)
    } catch (err: any) {
      notify('error', `เกิดข้อผิดพลาดในการนำออก: ${err.message}`)
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
    setMappingModalTab('upload')
  }

  return {
    activeFlow, setActiveFlow,
    dynamicLayout, setDynamicLayout,
    previewType, setPreviewType,
    fileName, localRows, localColumns,
    mapping, setMapping,
    useDist, setUseDist,
    useSub, setUseSub,
    useVal, setUseVal,
    useColor, setUseColor,
    isExportOpen, setIsExportOpen,
    exportTimeMode, setExportTimeMode,
    exportAdminFormat, setExportAdminFormat,
    exportLayoutFormat, setExportLayoutFormat,
    isExporting,
    handleFileDrop, handleFileChange,
    handleLoadToMap, handleExportLineListing,
    resetUpload, runAutoDetect,
    groupingMode, geoMode, setGeoMode,
    mappingModalTab, setMappingModalTab,
    setIsMappingOpen,
  }
}
