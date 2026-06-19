import React, { useState, useCallback } from 'react'
import { useAppStore, type DataKeys } from '../store/useAppStore'
import { locationResolver } from '../data/locationResolver'
import { parseDate, toDateKey, getPeriodLabel, type DateMode } from '../data/dateParser'
import { buildDictionary, buildStaticDictionary, buildWideDictionary, clearCumulativeCache } from '../data/aggregator'
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle,
  RefreshCw, Download, ArrowRight, X, Sparkles,
  MapPin, Activity, Users, Settings
} from 'lucide-react'
import * as XLSX from 'xlsx'
import clsx from 'clsx'
import { readCsvToWorkbook } from '../data/encoding'
import { useTranslation } from '../hooks/useTranslation'

type FlowType = 'static' | 'dynamic' | 'linelist'
type DynamicLayout = 'wide' | 'long'

export function DataManager() {
  const { t, language } = useTranslation()
  const {
    rawRows, dataKeys, groupingMode,
    setRawRows, setDataKeys, setDictionary, setPeriods,
    setLoading, notify, setIngestionMode
  } = useAppStore()

  // Navigation states
  const [step, setStep] = useState<'upload' | 'mapping'>('upload')
  const [activeFlow, setActiveFlow] = useState<FlowType>('static')
  const [dynamicLayout, setDynamicLayout] = useState<DynamicLayout>('wide')

  // UI state for showing column previews
  const [expandedPreview, setExpandedPreview] = useState<Record<string, boolean>>({
    static: false,
    dynamic: false,
    linelist: false
  })

  // File states
  const [fileName, setFileName] = useState<string>('')
  const [rows, setRows] = useState<any[]>([])
  const [columns, setColumns] = useState<string[]>([])

  // Column mapping states
  const [mapping, setMapping] = useState<Record<string, string>>({
    date: '', province: '', district: '', subdistrict: '', value: '', color: ''
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

  // Auto-detect columns helper
  const runAutoDetect = (cols: string[], flow: FlowType) => {
    const patterns: Record<string, RegExp> = {
      province:    /รหัสจังหวัด|^(จังหวัด|จ\.|province|changwat|p_code|pcode|pv_code)/i,
      district:    /รหัสอำเภอ|^(อำเภอ|อ\.|district|amphur|amphoe|a_code|acode|am_code)/i,
      subdistrict: /รหัสตำบล|^(ตำบล|ต\.|subdist|tambon|t_code|tcode|t_code_full)/i,
      date:        /วัน|date|time/i,
      value:       /จำนวน|ยอด|ราย|ผู้ป่วย|case|patient|value|count|total|ปริมาณ/i,
      color:       /^(สี|color|hex)$/i,
    }

    const detected: Record<string, string> = {
      date: '', province: '', district: '', subdistrict: '', value: '', color: ''
    }

    cols.forEach(col => {
      for (const [key, re] of Object.entries(patterns)) {
        if (!detected[key] && re.test(col)) {
          detected[key] = col
        }
      }
    })

    setMapping(detected)
    setUseDist(!!detected.district)
    setUseSub(!!detected.subdistrict)
    setUseVal(flow === 'static' ? !!detected.value : (flow === 'linelist' ? !!detected.value : true))
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

  const loadFile = (file: File, flow: FlowType) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      notify('error', t('exp_file_type_err'))
      return
    }

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
          throw new Error(language === 'th' ? 'ไม่พบข้อมูลในไฟล์ Excel' : 'No data found in spreadsheet')
        }

        const cols = Object.keys(rawJson[0])
        setRows(rawJson)
        setColumns(cols)
        setFileName(file.name)
        setActiveFlow(flow)
        runAutoDetect(cols, flow)
        setStep('mapping')
        notify('success', t('hub_upload_success', { count: rawJson.length.toLocaleString() }))
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
    if (rows.length === 0) return
    setLoading(true, t('hub_plotting_msg'))

    try {
      const mergedKeys: DataKeys = {
        date: activeFlow === 'static' ? '' : (activeFlow === 'dynamic' && dynamicLayout === 'wide' ? '' : mapping.date),
        province: mapping.province,
        district: useDist ? mapping.district : '',
        subdistrict: useSub ? mapping.subdistrict : '',
        value: (activeFlow === 'static' || activeFlow === 'linelist') ? (useVal ? mapping.value : '') : (dynamicLayout === 'long' ? mapping.value : ''),
        color: activeFlow === 'static' && useColor ? mapping.color : '',
        lat: '',
        lng: ''
      }

      setDataKeys(mergedKeys)
      setRawRows(rows, {
        fileName,
        rowCount: rows.length,
        keys: mergedKeys,
        loadedAt: new Date()
      })

      clearCumulativeCache()

      let result
      if (activeFlow === 'static') {
        // 1. Static Flow
        setIngestionMode('admin_static')
        result = await buildStaticDictionary(rows, mergedKeys)
      } else if (activeFlow === 'dynamic' && dynamicLayout === 'wide') {
        // 2. Dynamic Wide (Matrix)
        setIngestionMode('admin_dynamic')
        // Automatically determine time cols: columns that are NOT mapped as geographic area fields
        const geoCols = [mapping.province, useDist ? mapping.district : '', useSub ? mapping.subdistrict : ''].filter(Boolean) as string[]
        const timeCols = columns.filter(c => !geoCols.includes(c))
        result = await buildWideDictionary(rows, mergedKeys, timeCols)
      } else {
        // 3. Dynamic Long or Line Listing
        setIngestionMode('admin_dynamic')
        result = await buildDictionary(rows, mergedKeys, groupingMode)
      }

      setDictionary(result.dictionary)
      setPeriods(result.periods)

      notify('success', t('hub_plot_success'))
      if ((window as any).setActivePage) {
        (window as any).setActivePage('explorer')
      }
    } catch (err: any) {
      console.error(err)
      notify('error', t('hub_plot_failed', { msg: err.message }))
    } finally {
      setLoading(false)
    }
  }

  // Line listing conversion and Excel download based on pop-up overlay configuration
  const handleExportLineListing = async () => {
    if (rows.length === 0) return
    setIsExporting(true)
    setLoading(true, t('ex_exporting_msg'))

    try {
      await locationResolver.init()
      
      const periodsMap = new Map<string, { key: string; label: string; date: Date }>()
      const dateMode = exportTimeMode
      const hasDateCol = !!mapping.date

      // 1. Determine period buckets
      rows.forEach(row => {
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
      
      // 2. Aggregate cases by location and period
      const areaLevel = useSub ? 'subdistrict' : (useDist ? 'district' : 'province')
      const aggregated: Record<string, {
        codes: { pCode: string; aCode: string; tCode: string }
        names: { pName: string; aName: string; tName: string }
        vals: Record<string, number>
      }> = {}
      
      const unmatchedRows: any[] = []
      
      rows.forEach(row => {
        const rawP = String(row[mapping.province] || '')
        const rawA = useDist ? String(row[mapping.district] || '') : ''
        const rawT = useSub ? String(row[mapping.subdistrict] || '') : ''
        
        const resolved = locationResolver.resolve(rawP, rawA, rawT)
        if (!resolved) {
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

      // 3. Construct export data rows (Wide Format or Long Format based on User Choice)
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
        // WIDE MATRIX FORMAT
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
      
      // 4. Write to workbook & download
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
    setRows([])
    setColumns([])
    setFileName('')
    setStep('upload')
  }

  const togglePreview = (key: string) => {
    setExpandedPreview(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="p-6 h-full overflow-auto animate-fade-in text-spatio-text relative bg-spatio-background">
      {step === 'upload' ? (
        <div className="max-w-6xl mx-auto mt-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black mb-2 tracking-tight bg-gradient-to-r from-blue-600 via-indigo-500 to-indigo-950 dark:from-blue-400 dark:via-indigo-200 dark:to-white bg-clip-text text-transparent">
              {t('dm_main_title')}
            </h2>
            <p className="text-xs text-spatio-muted max-w-xl mx-auto leading-relaxed">
              {t('dm_main_desc')}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 1. Static Data Card */}
            <div className="spatio-card p-6 border-t-4 border-t-emerald-500 bg-spatio-surface-alt border border-spatio-border/60 flex flex-col justify-between gap-5 relative hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-lg">
                  <MapPin className="text-emerald-500 dark:text-emerald-400" size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-spatio-text">{t('dm_static_title')}</h3>
                  <p className="text-xs text-spatio-muted mt-1 leading-relaxed">
                    {t('dm_static_desc')}
                  </p>
                </div>

                {/* Column preview expander */}
                <button
                  onClick={() => togglePreview('static')}
                  className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400/90 dark:hover:text-emerald-300 flex items-center gap-1 transition-colors pt-1"
                >
                  {expandedPreview.static ? t('dm_preview_hide') : t('dm_preview_show')}
                </button>

                {expandedPreview.static && (
                  <div className="rounded-lg bg-spatio-surface p-3 border border-spatio-border text-[10px] font-mono overflow-auto max-h-[140px] animate-fade-in space-y-1">
                    <p className="text-emerald-600 dark:text-emerald-400 font-semibold mb-1 text-[9px] uppercase">{t('dm_required_template')}</p>
                    <table className="w-full text-spatio-muted text-left border-collapse">
                      <thead>
                        <tr className="border-b border-spatio-border">
                          <th className="py-1 pr-1 font-bold text-spatio-text">{t('dm_col_province')}</th>
                          <th className="py-1 pr-1 font-bold text-spatio-text">{t('dm_col_district')}</th>
                          <th className="py-1 pr-1 font-bold text-spatio-text">{t('dm_col_value')}</th>
                          <th className="py-1 font-bold text-spatio-text">{t('dm_col_color')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="py-1 pr-1">{language === 'th' ? 'เชียงใหม่' : 'Chiang Mai'}</td>
                          <td className="py-1 pr-1">{language === 'th' ? 'เมืองเชียงใหม่' : 'Mueang Chiang Mai'}</td>
                          <td className="py-1 pr-1">320</td>
                          <td className="py-1">#2563EB</td>
                        </tr>
                        <tr>
                          <td className="py-1 pr-1">{language === 'th' ? 'กรุงเทพฯ' : 'Bangkok'}</td>
                          <td className="py-1 pr-1">{language === 'th' ? 'พระนคร' : 'Phra Nakhon'}</td>
                          <td className="py-1 pr-1">150</td>
                          <td className="py-1">#E11D48</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Upload area */}
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleFileDrop(e, 'static')}
                className="border border-dashed border-spatio-border hover:border-emerald-500/50 rounded-xl p-6 bg-spatio-surface/20 hover:bg-spatio-surface/50 flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition-all duration-300 group"
              >
                <Upload size={18} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] text-spatio-muted group-hover:text-spatio-text transition-colors">{t('dm_drag_drop')}</span>
                <label className="spatio-btn px-4 py-1.5 text-[10px] bg-spatio-surface border border-spatio-border hover:bg-emerald-600 hover:text-white text-spatio-text font-semibold rounded-lg cursor-pointer transition-all active:scale-95 shadow">
                  {t('dm_select_file')}
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleFileChange(e, 'static')} />
                </label>
              </div>
            </div>

            {/* 2. Dynamic Time Series Card */}
            <div className="spatio-card p-6 border-t-4 border-t-blue-500 bg-spatio-surface-alt border border-spatio-border/60 flex flex-col justify-between gap-5 relative hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shadow-lg">
                  <Activity className="text-blue-500 dark:text-blue-400" size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-spatio-text">{t('dm_dynamic_title')}</h3>
                  <p className="text-xs text-spatio-muted mt-1 leading-relaxed">
                    {t('dm_dynamic_desc')}
                  </p>
                </div>

                <button
                  onClick={() => togglePreview('dynamic')}
                  className="text-[10px] font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400/90 dark:hover:text-blue-300 flex items-center gap-1 transition-colors pt-1"
                >
                  {expandedPreview.dynamic ? t('dm_preview_hide') : t('dm_preview_show')}
                </button>

                {expandedPreview.dynamic && (
                  <div className="rounded-lg bg-spatio-surface p-3 border border-spatio-border text-[10px] font-mono overflow-auto max-h-[140px] animate-fade-in space-y-2">
                    <div>
                      <p className="text-blue-600 dark:text-blue-400 font-bold text-[9px] uppercase">{t('dm_dynamic_wide_temp')}</p>
                      <table className="w-full text-spatio-muted text-left text-[9px] border-collapse mb-1">
                        <thead>
                          <tr className="border-b border-spatio-border">
                            <th className="py-0.5 text-spatio-text">{t('dm_col_province')}</th>
                            <th className="py-0.5 text-spatio-text">{t('dm_col_district')}</th>
                            <th className="py-0.5 text-spatio-text">W01</th>
                            <th className="py-0.5 text-spatio-text">W02</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>{language === 'th' ? 'เชียงใหม่' : 'Chiang Mai'}</td>
                            <td>{language === 'th' ? 'เมืองเชียงใหม่' : 'Mueang Chiang Mai'}</td>
                            <td>12</td>
                            <td>15</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="border-t border-spatio-border pt-1.5">
                      <p className="text-blue-600 dark:text-blue-400 font-bold text-[9px] uppercase">{t('dm_dynamic_long_temp')}</p>
                      <table className="w-full text-spatio-muted text-left text-[9px] border-collapse">
                        <thead>
                          <tr className="border-b border-spatio-border">
                            <th className="py-0.5 text-spatio-text">{language === 'th' ? 'วันที่' : 'Date'}</th>
                            <th className="py-0.5 text-spatio-text">{t('dm_col_province')}</th>
                            <th className="py-0.5 text-spatio-text">{language === 'th' ? 'ยอด' : 'Count'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>2026-05-01</td>
                            <td>{language === 'th' ? 'เชียงใหม่' : 'Chiang Mai'}</td>
                            <td>12</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload area */}
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleFileDrop(e, 'dynamic')}
                className="border border-dashed border-spatio-border hover:border-blue-500/50 rounded-xl p-6 bg-spatio-surface/20 hover:bg-spatio-surface/50 flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition-all duration-300 group"
              >
                <Upload size={18} className="text-blue-500 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] text-spatio-muted group-hover:text-spatio-text transition-colors">{t('dm_drag_drop_dynamic')}</span>
                <label className="spatio-btn px-4 py-1.5 text-[10px] bg-spatio-surface border border-spatio-border hover:bg-blue-600 hover:text-white text-spatio-text font-semibold rounded-lg cursor-pointer transition-all active:scale-95 shadow">
                  {t('dm_select_file')}
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleFileChange(e, 'dynamic')} />
                </label>
              </div>
            </div>

            {/* 3. Line Listing Card */}
            <div className="spatio-card p-6 border-t-4 border-t-indigo-500 bg-spatio-surface-alt border border-spatio-border/60 flex flex-col justify-between gap-5 relative hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-lg">
                  <Users className="text-indigo-500 dark:text-indigo-400" size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-spatio-text">{t('dm_linelist_title')}</h3>
                  <p className="text-xs text-spatio-muted mt-1 leading-relaxed">
                    {t('dm_linelist_desc')}
                  </p>
                </div>

                <button
                  onClick={() => togglePreview('linelist')}
                  className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400/90 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors pt-1"
                >
                  {expandedPreview.linelist ? t('dm_preview_hide') : t('dm_preview_show')}
                </button>

                {expandedPreview.linelist && (
                  <div className="rounded-lg bg-spatio-surface p-3 border border-spatio-border text-[10px] font-mono overflow-auto max-h-[140px] animate-fade-in space-y-1">
                    <p className="text-indigo-600 dark:text-indigo-400 font-semibold mb-1 text-[9px] uppercase">{t('dm_linelist_temp')}</p>
                    <table className="w-full text-spatio-muted text-left border-collapse">
                      <thead>
                        <tr className="border-b border-spatio-border">
                          <th className="py-1 pr-1 font-bold text-spatio-text">{language === 'th' ? 'วันที่เริ่มป่วย' : 'Onset Date'}</th>
                          <th className="py-1 pr-1 font-bold text-spatio-text">{t('dm_col_province')}</th>
                          <th className="py-1 pr-1 font-bold text-spatio-text">{t('dm_col_district')}</th>
                          <th className="py-1 font-bold text-spatio-text">{language === 'th' ? 'ตำบล' : 'Subdistrict'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="py-1 pr-1">2026-05-24</td>
                          <td className="py-1 pr-1">{language === 'th' ? 'เชียงใหม่' : 'Chiang Mai'}</td>
                          <td className="py-1 pr-1">{language === 'th' ? 'เมืองเชียงใหม่' : 'Mueang Chiang Mai'}</td>
                          <td className="py-1">{language === 'th' ? 'ศรีภูมิ' : 'Si Phum'}</td>
                        </tr>
                        <tr>
                          <td className="py-1 pr-1">2026-05-24</td>
                          <td className="py-1 pr-1">{language === 'th' ? 'เชียงใหม่' : 'Chiang Mai'}</td>
                          <td className="py-1 pr-1">{language === 'th' ? 'สันทราย' : 'San Sai'}</td>
                          <td className="py-1">{language === 'th' ? 'หนองจ๊อม' : 'Nong Chom'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Upload area */}
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleFileDrop(e, 'linelist')}
                className="border border-dashed border-spatio-border hover:border-indigo-500/50 rounded-xl p-6 bg-spatio-surface/20 hover:bg-spatio-surface/50 flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition-all duration-300 group"
              >
                <Upload size={18} className="text-indigo-500 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] text-spatio-muted group-hover:text-spatio-text transition-colors">{t('dm_drag_drop_linelist')}</span>
                <label className="spatio-btn px-4 py-1.5 text-[10px] bg-spatio-surface border border-spatio-border hover:bg-indigo-600 hover:text-white text-spatio-text font-semibold rounded-lg cursor-pointer transition-all active:scale-95 shadow">
                  {t('dm_select_file')}
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleFileChange(e, 'linelist')} />
                </label>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header metadata bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-spatio-surface-alt border border-spatio-border rounded-xl px-5 py-4 shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/15 border border-blue-500/25">
                <FileSpreadsheet className="text-blue-500 dark:text-blue-400" size={20} />
              </div>
              <div>
                <div className="text-sm font-bold text-spatio-text truncate max-w-[280px] md:max-w-md">{fileName}</div>
                <div className="text-[10px] text-spatio-muted mt-0.5 flex items-center gap-2">
                  <span>{t('hub_meta_cols', { count: columns.length })}</span>
                  <span className="text-spatio-border">•</span>
                  <span>{t('hub_meta_rows', { count: rows.length.toLocaleString() })}</span>
                  <span className="text-spatio-border">•</span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 text-[9px] uppercase font-bold">
                    {activeFlow === 'static' ? 'Static Mode' : (activeFlow === 'dynamic' ? `Dynamic Mode (${dynamicLayout})` : 'Line Listing')}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={resetUpload} className="px-3.5 py-1.5 rounded-lg text-xs bg-spatio-surface hover:bg-spatio-surface-hover text-spatio-text border border-spatio-border flex items-center gap-1.5 transition-colors self-start md:self-auto">
              <X size={13} />
              <span>{t('hub_choose_mode')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Column Mapping Panel */}
            <div className="lg:col-span-3 space-y-4">
              <div className="spatio-card p-5">
                <div className="flex items-center gap-2 border-b border-spatio-border pb-3 mb-4">
                  <Settings size={16} className="text-blue-500 dark:text-blue-400" />
                  <h3 className="text-sm font-bold text-spatio-text">{t('tbl_col_mapping')}</h3>
                </div>

                {/* Sub-Layout Selector for Dynamic Data */}
                {activeFlow === 'dynamic' && (
                  <div className="mb-4 bg-spatio-surface p-1.5 rounded-xl border border-spatio-border flex gap-1">
                    <button
                      onClick={() => setDynamicLayout('wide')}
                      className={clsx(
                        'flex-1 text-center py-2 text-xs rounded-lg font-bold transition-all',
                        dynamicLayout === 'wide' ? 'bg-blue-600 text-white shadow-md' : 'text-spatio-muted hover:text-spatio-text'
                      )}
                    >
                      {t('tbl_wide_matrix')}
                    </button>
                    <button
                      onClick={() => setDynamicLayout('long')}
                      className={clsx(
                        'flex-1 text-center py-2 text-xs rounded-lg font-bold transition-all',
                        dynamicLayout === 'long' ? 'bg-blue-600 text-white shadow-md' : 'text-spatio-muted hover:text-spatio-text'
                      )}
                    >
                      {t('tbl_long_list')}
                    </button>
                  </div>
                )}

                <div className="space-y-3">
                  {/* Date Column (Required for Long formats and Line list) */}
                  {((activeFlow === 'dynamic' && dynamicLayout === 'long') || activeFlow === 'linelist') && (
                    <div className="flex items-center gap-3 bg-spatio-surface/40 border border-spatio-border px-4 py-3 rounded-xl">
                      <div className="w-36 shrink-0">
                        <span className="text-xs font-semibold text-spatio-text block">{t('hub_map_date')} <span className="text-red-400">*</span></span>
                        <span className="text-[9px] text-spatio-muted block leading-tight">{t('hub_map_date_desc')}</span>
                      </div>
                      <select
                        value={mapping.date}
                        onChange={e => setMapping({ ...mapping, date: e.target.value })}
                        className="flex-1 text-xs px-2.5 py-2 bg-spatio-surface border border-spatio-border rounded-lg text-spatio-text"
                      >
                        <option value="">{t('hub_select_date_col')}</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Province Column */}
                  <div className="flex items-center gap-3 bg-spatio-surface/40 border border-spatio-border px-4 py-3 rounded-xl">
                    <div className="w-36 shrink-0">
                      <span className="text-xs font-semibold text-spatio-text block">{t('hub_map_province')} <span className="text-red-400">*</span></span>
                      <span className="text-[9px] text-spatio-muted block leading-tight">{t('hub_map_province_desc')}</span>
                    </div>
                    <select
                      value={mapping.province}
                      onChange={e => setMapping({ ...mapping, province: e.target.value })}
                      className="flex-1 text-xs px-2.5 py-2 bg-spatio-surface border border-spatio-border rounded-lg text-spatio-text"
                    >
                      <option value="">{t('hub_select_prov_col')}</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* District Column */}
                  <div className="flex items-center gap-3 bg-spatio-surface/40 border border-spatio-border px-4 py-3 rounded-xl">
                    <div className="w-36 shrink-0 flex items-center gap-1.5">
                      <input type="checkbox" id="use-dist-chk" checked={useDist} onChange={e => setUseDist(e.target.checked)} className="rounded bg-spatio-surface border-spatio-border accent-blue-500" />
                      <label htmlFor="use-dist-chk" className="text-xs font-semibold text-spatio-text cursor-pointer">{t('hub_use_district')}</label>
                    </div>
                    <select
                      disabled={!useDist}
                      value={mapping.district}
                      onChange={e => setMapping({ ...mapping, district: e.target.value })}
                      className="flex-1 text-xs px-2.5 py-2 bg-spatio-surface border border-spatio-border rounded-lg text-spatio-text disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <option value="">{t('hub_select_dist_col')}</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* Subdistrict Column */}
                  <div className="flex items-center gap-3 bg-spatio-surface/40 border border-spatio-border px-4 py-3 rounded-xl">
                    <div className="w-36 shrink-0 flex items-center gap-1.5">
                      <input type="checkbox" id="use-sub-chk" checked={useSub} onChange={e => setUseSub(e.target.checked)} className="rounded bg-spatio-surface border-spatio-border accent-blue-500" />
                      <label htmlFor="use-sub-chk" className="text-xs font-semibold text-spatio-text cursor-pointer">{t('hub_use_subdistrict')}</label>
                    </div>
                    <select
                      disabled={!useSub}
                      value={mapping.subdistrict}
                      onChange={e => setMapping({ ...mapping, subdistrict: e.target.value })}
                      className="flex-1 text-xs px-2.5 py-2 bg-spatio-surface border border-spatio-border rounded-lg text-spatio-text disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <option value="">{t('hub_select_subdist_col')}</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* Value Column */}
                  {((activeFlow === 'static') || (activeFlow === 'dynamic' && dynamicLayout === 'long') || activeFlow === 'linelist') && (
                    <div className="flex items-center gap-3 bg-spatio-surface/40 border border-spatio-border px-4 py-3 rounded-xl">
                      <div className="w-36 shrink-0 flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          id="use-val-chk"
                          checked={useVal}
                          onChange={e => setUseVal(e.target.checked)}
                          className="rounded bg-spatio-surface border-spatio-border accent-blue-500"
                        />
                        <label htmlFor="use-val-chk" className="text-xs font-semibold text-spatio-text cursor-pointer">
                          {activeFlow === 'linelist' ? t('hub_use_weight') : t('hub_use_value')}
                        </label>
                      </div>
                      <select
                        disabled={!useVal}
                        value={mapping.value}
                        onChange={e => setMapping({ ...mapping, value: e.target.value })}
                        className="flex-1 text-xs px-2.5 py-2 bg-spatio-surface border border-spatio-border rounded-lg text-spatio-text disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <option value="">{activeFlow === 'linelist' ? t('hub_select_val_col_linelist') : t('hub_select_val_col')}</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Color Column (Only for Static Map) */}
                  {activeFlow === 'static' && (
                    <div className="flex items-center gap-3 bg-spatio-surface/40 border border-spatio-border px-4 py-3 rounded-xl">
                      <div className="w-36 shrink-0 flex items-center gap-1.5">
                        <input type="checkbox" id="use-color-chk" checked={useColor} onChange={e => setUseColor(e.target.checked)} className="rounded bg-spatio-surface border-spatio-border accent-blue-500" />
                        <label htmlFor="use-color-chk" className="text-xs font-semibold text-spatio-text cursor-pointer">{t('hub_use_custom_color')}</label>
                      </div>
                      <select
                        disabled={!useColor}
                        value={mapping.color}
                        onChange={e => setMapping({ ...mapping, color: e.target.value })}
                        className="flex-1 text-xs px-2.5 py-2 bg-spatio-surface border border-spatio-border rounded-lg text-spatio-text disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <option value="">{t('hub_select_color_col')}</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions Flow Control */}
            <div className="lg:col-span-2 space-y-4">
              {/* Load Live Map directly */}
              <div className="spatio-card p-5 border border-blue-500/20 dark:border-blue-500/10 shadow-lg flex flex-col justify-between gap-4 h-full bg-spatio-surface">
                <div>
                  <div className="flex items-center gap-2 border-b border-spatio-border pb-3 mb-3">
                    <Sparkles size={16} className="text-blue-500 dark:text-blue-400 animate-pulse" />
                    <h4 className="text-sm font-bold text-spatio-text">{t('hub_plot_title')}</h4>
                  </div>
                  <p className="text-xs text-spatio-muted leading-relaxed mb-3">
                    {t('hub_plot_desc')}
                  </p>
                </div>

                <button
                  onClick={handleLoadToMap}
                  disabled={!mapping.province || (((activeFlow === 'dynamic' && dynamicLayout === 'long') || activeFlow === 'linelist') && !mapping.date)}
                  className={clsx(
                    'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all active:scale-95 shadow-lg shadow-blue-900/20',
                    (!mapping.province || (((activeFlow === 'dynamic' && dynamicLayout === 'long') || activeFlow === 'linelist') && !mapping.date))
                      ? 'bg-spatio-surface-alt border border-spatio-border text-spatio-muted cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white hover:opacity-95 cursor-pointer'
                  )}
                >
                  <span>{t('hub_plot_btn')}</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              {/* Line Listing Export Action */}
              {activeFlow === 'linelist' && (
                <div className="spatio-card p-5 border border-indigo-500/20 dark:border-indigo-500/15 bg-spatio-surface-alt flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 border-b border-spatio-border pb-3 mb-3">
                      <Download size={16} className="text-indigo-500 dark:text-indigo-400" />
                      <h4 className="text-sm font-bold text-spatio-text">{t('hub_agg_title')}</h4>
                    </div>
                    <p className="text-xs text-spatio-muted leading-relaxed">
                      {t('hub_agg_desc')}
                    </p>
                  </div>

                  <button
                    onClick={() => setIsExportOpen(true)}
                    disabled={!mapping.province || !mapping.date}
                    className={clsx(
                      'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer',
                      (!mapping.province || !mapping.date)
                        ? 'bg-spatio-surface border-spatio-border text-spatio-muted cursor-not-allowed'
                        : 'border-indigo-600 dark:border-indigo-500 text-indigo-700 dark:text-indigo-350 bg-indigo-50 dark:bg-indigo-950/20 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 shadow shadow-indigo-950/40'
                    )}
                  >
                    <span>{t('hub_agg_btn')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* 4. Interactive Export Settings Overlay Modal             */}
      {/* ──────────────────────────────────────────────────────── */}
      {isExportOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="spatio-card w-full max-w-md border border-spatio-border p-6 space-y-5 bg-spatio-surface shadow-2xl relative">
            <button
              onClick={() => setIsExportOpen(false)}
              className="absolute top-4 right-4 text-spatio-muted hover:text-spatio-text transition-colors p-1 rounded-lg bg-spatio-surface-alt hover:bg-spatio-border cursor-pointer"
            >
              <X size={14} />
            </button>

            <div className="flex items-center gap-2 pb-2 border-b border-spatio-border">
              <Download className="text-indigo-500 dark:text-indigo-400" size={18} />
              <h3 className="text-base font-bold text-spatio-text">{t('ex_modal_title')}</h3>
            </div>

            <div className="space-y-4 text-xs">
              {/* Time grouping mode selection */}
              <div>
                <label className="text-[11px] text-spatio-muted block mb-1.5 font-semibold">{t('ex_time_grouping')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['daily', 'weekly', 'monthly'] as DateMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setExportTimeMode(mode)}
                      className={clsx(
                        'py-1.5 text-center rounded border font-medium transition-all capitalize cursor-pointer',
                        exportTimeMode === mode ? 'bg-indigo-600 border-indigo-500 text-white shadow' : 'bg-spatio-surface border-spatio-border text-spatio-muted hover:text-spatio-text'
                      )}
                    >
                      {mode === 'daily' ? (language === 'th' ? 'รายวัน' : 'Daily') : (mode === 'weekly' ? (language === 'th' ? 'รายสัปดาห์' : 'Weekly') : (language === 'th' ? 'รายเดือน' : 'Monthly'))}
                    </button>
                  ))}
                </div>
              </div>

              {/* Administrative language / code type selection */}
              <div>
                <label className="text-[11px] text-spatio-muted block mb-1.5 font-semibold">{t('ex_col_format')}</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setExportAdminFormat('thai')}
                    className={clsx(
                      'flex-1 py-2 text-center rounded border font-medium transition-all cursor-pointer',
                      exportAdminFormat === 'thai' ? 'bg-indigo-600 border-indigo-500 text-white shadow' : 'bg-spatio-surface border-spatio-border text-spatio-muted hover:text-spatio-text'
                    )}
                  >
                    {t('ex_admin_name')}
                  </button>
                  <button
                    onClick={() => setExportAdminFormat('code')}
                    className={clsx(
                      'flex-1 py-2 text-center rounded border font-medium transition-all cursor-pointer',
                      exportAdminFormat === 'code' ? 'bg-indigo-600 border-indigo-500 text-white shadow' : 'bg-spatio-surface border-spatio-border text-spatio-muted hover:text-spatio-text'
                    )}
                  >
                    {t('ex_admin_code')}
                  </button>
                </div>
              </div>

              {/* Layout format choice: Wide vs Long (Dynamic wide / long) */}
              <div>
                <label className="text-[11px] text-spatio-muted block mb-1.5 font-semibold">
                  {t('ex_layout_format')}
                </label>
                <div className="space-y-2">
                  <label
                    onClick={() => setExportLayoutFormat('wide')}
                    className={clsx(
                      'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                      exportLayoutFormat === 'wide' ? 'border-indigo-600 dark:border-indigo-500/70 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-950 dark:text-white' : 'border-spatio-border bg-spatio-surface-alt text-spatio-muted'
                    )}
                  >
                    <input
                      type="radio"
                      name="export-layout"
                      checked={exportLayoutFormat === 'wide'}
                      onChange={() => setExportLayoutFormat('wide')}
                      className="mt-0.5 accent-indigo-500 cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-spatio-text text-[11px] block">{t('tbl_wide_matrix')}</span>
                      <span className="text-[10px] text-spatio-muted mt-0.5 block leading-normal">
                        {t('ex_layout_wide')}
                      </span>
                    </div>
                  </label>

                  <label
                    onClick={() => setExportLayoutFormat('long')}
                    className={clsx(
                      'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                      exportLayoutFormat === 'long' ? 'border-indigo-600 dark:border-indigo-500/70 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-950 dark:text-white' : 'border-spatio-border bg-spatio-surface-alt text-spatio-muted'
                    )}
                  >
                    <input
                      type="radio"
                      name="export-layout"
                      checked={exportLayoutFormat === 'long'}
                      onChange={() => setExportLayoutFormat('long')}
                      className="mt-0.5 accent-indigo-500 cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-spatio-text text-[11px] block">{t('tbl_long_list')}</span>
                      <span className="text-[10px] text-spatio-muted mt-0.5 block leading-normal">
                        {t('ex_layout_long')}
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-spatio-border text-xs">
              <button
                onClick={() => setIsExportOpen(false)}
                className="flex-1 py-2.5 rounded-lg border border-spatio-border text-spatio-muted hover:text-spatio-text transition-colors bg-spatio-surface cursor-pointer"
              >
                {t('ex_cancel')}
              </button>
              <button
                onClick={handleExportLineListing}
                disabled={isExporting}
                className="flex-1 py-2.5 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all shadow-indigo-950/30 cursor-pointer"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="animate-spin" size={12} />
                    <span>{language === 'th' ? 'กำลังนำออก...' : 'Exporting...'}</span>
                  </>
                ) : (
                  <>
                    <Download size={12} />
                    <span>{t('ex_download')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
