/**
 * ColumnMappingTab.tsx — Field mapping UI: column dropdowns + flow switcher
 */
import React from 'react'
import { FileSpreadsheet, Settings, X, ArrowRight, Sparkles, Download } from 'lucide-react'
import clsx from 'clsx'
import { type DataKeys } from '../../store/useAppStore'
import type { FlowType, DynamicLayout, MappingState } from './hooks/useMappingState'

interface ColumnMappingTabProps {
  // File info
  fileName: string
  localColumns: string[]
  localRows: any[]
  // Flow
  activeFlow: FlowType
  dynamicLayout: DynamicLayout
  setDynamicLayout: (l: DynamicLayout) => void
  // Geo
  geoMode: string
  setGeoMode: (m: 'admin' | 'coordinate') => void
  // Mapping
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
  // Actions
  resetUpload: () => void
  handleLoadToMap: () => Promise<void>
  setIsExportOpen: (v: boolean) => void
}

export const ColumnMappingTab: React.FC<ColumnMappingTabProps> = ({
  fileName, localColumns, localRows,
  activeFlow, dynamicLayout, setDynamicLayout,
  geoMode, setGeoMode,
  mapping, setMapping,
  useDist, setUseDist,
  useSub, setUseSub,
  useVal, setUseVal,
  useColor, setUseColor,
  resetUpload, handleLoadToMap, setIsExportOpen,
}) => {
  const isLoadDisabled = geoMode === 'coordinate'
    ? (!mapping.lat || !mapping.lng || (((activeFlow === 'dynamic' && dynamicLayout === 'long') || activeFlow === 'linelist') && !mapping.date))
    : (!mapping.province || (((activeFlow === 'dynamic' && dynamicLayout === 'long') || activeFlow === 'linelist') && !mapping.date))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-fade-in">
      {/* Left: mapping selects */}
      <div className="lg:col-span-3 space-y-4">
        {/* File meta */}
        <div className="flex items-center justify-between gap-3 bg-slate-950/40 border border-slate-850 p-4 rounded-xl shadow-inner">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-blue-500/10 border border-blue-500/25">
              <FileSpreadsheet className="text-blue-400" size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-white truncate max-w-[200px] md:max-w-xs">{fileName}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">คอลัมน์: {localColumns.length} | บรรทัด: {localRows.length.toLocaleString()} แถว</div>
            </div>
          </div>
          <button onClick={resetUpload} className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] border border-slate-700 flex items-center gap-1 transition-colors">
            <X size={11} />
            <span>นำเข้าไฟล์ใหม่</span>
          </button>
        </div>

        <div className="spatio-card p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
            <Settings size={14} className="text-blue-400 animate-spin-slow" />
            <h4 className="text-xs font-black text-white">ตั้งค่าการเลือกจับคู่ฟิลด์ข้อมูล</h4>
          </div>

          {/* Geographic Mode */}
          <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-850 space-y-2">
            <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider select-none px-1">
              รูปแบบการระบุตำแหน่งทางภูมิศาสตร์
            </span>
            <div className="bg-slate-950/60 p-1 rounded-lg border border-slate-850 flex gap-1">
              <button
                onClick={() => setGeoMode('admin')}
                className={clsx('flex-1 text-center py-1.5 text-[10px] rounded font-bold transition-all',
                  geoMode === 'admin' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200')}
              >
                แบบเขตพื้นที่ (Admin Boundary)
              </button>
              <button
                onClick={() => setGeoMode('coordinate')}
                className={clsx('flex-1 text-center py-1.5 text-[10px] rounded font-bold transition-all',
                  geoMode === 'coordinate' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200')}
              >
                แบบพิกัดจริง (Lat/Lng Points)
              </button>
            </div>
          </div>

          {/* Dynamic layout switcher */}
          {activeFlow === 'dynamic' && (
            <div className="bg-slate-950/60 p-1 rounded-lg border border-slate-850 flex gap-1">
              <button
                onClick={() => setDynamicLayout('wide')}
                className={clsx('flex-1 text-center py-1.5 text-[10px] rounded font-bold transition-all',
                  dynamicLayout === 'wide' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200')}
              >
                แบบตารางไขว้ (Wide Matrix)
              </button>
              <button
                onClick={() => setDynamicLayout('long')}
                className={clsx('flex-1 text-center py-1.5 text-[10px] rounded font-bold transition-all',
                  dynamicLayout === 'long' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200')}
              >
                แบบอนุกรมแนวตั้ง (Long List)
              </button>
            </div>
          )}

          <div className="space-y-3">
            {/* Date field */}
            {((activeFlow === 'dynamic' && dynamicLayout === 'long') || activeFlow === 'linelist') && (
              <FieldRow label="วันที่ข้อมูล" sublabel="onset / report date" required
                value={mapping.date} onChange={v => setMapping({ ...mapping, date: v })}
                columns={localColumns} placeholder="— เลือกคอลัมน์วันที่ —"
              />
            )}

            {geoMode === 'coordinate' ? (
              <>
                <FieldRow label="ละติจูด (Lat)" sublabel="latitude พิกัด Y" required accentLeft
                  value={mapping.lat} onChange={v => setMapping({ ...mapping, lat: v })}
                  columns={localColumns} placeholder="— เลือกคอลัมน์ละติจูด —"
                />
                <FieldRow label="ลองจิจูด (Lng)" sublabel="longitude พิกัด X" required accentLeft
                  value={mapping.lng} onChange={v => setMapping({ ...mapping, lng: v })}
                  columns={localColumns} placeholder="— เลือกคอลัมน์ลองจิจูด —"
                />
                <FieldRow label="ป้ายกำกับจุด (Label)" sublabel="ชื่อสถานที่/จังหวัด"
                  value={mapping.province} onChange={v => setMapping({ ...mapping, province: v })}
                  columns={localColumns} placeholder="— เลือกคอลัมน์ชื่อสถานที่/จังหวัด (เลือกใส่) —"
                />
              </>
            ) : (
              <>
                <FieldRow label="จังหวัด" sublabel="จังหวัดต้นทาง" required
                  value={mapping.province} onChange={v => setMapping({ ...mapping, province: v })}
                  columns={localColumns} placeholder="— เลือกคอลัมน์จังหวัด —"
                />
                <FieldRowCheckbox label="อำเภอ" id="modal-dist-chk"
                  checked={useDist} onCheck={setUseDist}
                  value={mapping.district} onChange={v => setMapping({ ...mapping, district: v })}
                  columns={localColumns} placeholder="— เลือกคอลัมน์อำเภอ —"
                />
                <FieldRowCheckbox label="ตำบล" id="modal-sub-chk"
                  checked={useSub} onCheck={setUseSub}
                  value={mapping.subdistrict} onChange={v => setMapping({ ...mapping, subdistrict: v })}
                  columns={localColumns} placeholder="— เลือกคอลัมน์ตำบล —"
                />
              </>
            )}

            {/* Value field */}
            {((activeFlow === 'static') || (activeFlow === 'dynamic' && dynamicLayout === 'long') || activeFlow === 'linelist') && (
              <FieldRowCheckbox label="ยอด/ความถี่" id="modal-val-chk"
                checked={useVal} onCheck={setUseVal}
                value={mapping.value} onChange={v => setMapping({ ...mapping, value: v })}
                columns={localColumns}
                placeholder={activeFlow === 'linelist' ? '— ไม่มี (นับ 1 เคสต่อแถว) —' : '— เลือกคอลัมน์จำนวนผู้ป่วย —'}
              />
            )}

            {/* Color field */}
            {activeFlow === 'static' && (
              <FieldRowCheckbox label="ใช้สีระบุเอง" id="modal-color-chk"
                checked={useColor} onCheck={setUseColor}
                value={mapping.color} onChange={v => setMapping({ ...mapping, color: v })}
                columns={localColumns} placeholder="— ไม่กำหนดสี (ใช้เฉดสีแอป) —"
              />
            )}
          </div>
        </div>
      </div>

      {/* Right: action panel */}
      <div className="lg:col-span-2 space-y-4 flex flex-col justify-between">
        <div className="spatio-card p-5 border border-blue-500/10 shadow-lg flex-1 flex flex-col justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
              <Sparkles size={14} className="text-blue-400 animate-pulse" />
              <h4 className="text-xs font-black text-white">แสดงผลลัพธ์ลงแผนที่สด</h4>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              คำนวณสเกลขอบเขตพิกัดในความทรงจำสดทันที (Zustand dictionary) และอัปเดตเลเยอร์ Leaflet เมื่อกดปุ่มตกลง หน้าต่าง Hub นี้จะปิดตัวลงอัตโนมัติ
            </p>
          </div>

          <button
            onClick={handleLoadToMap}
            disabled={isLoadDisabled}
            className={clsx(
              'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all active:scale-95 shadow-md shadow-blue-950/20',
              isLoadDisabled
                ? 'bg-slate-850 border border-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white hover:opacity-95'
            )}
          >
            <span>ยืนยันและพล็อตแผนที่</span>
            <ArrowRight size={12} />
          </button>
        </div>

        {activeFlow === 'linelist' && (
          <div className="spatio-card p-5 border border-indigo-500/15 bg-slate-900/30 space-y-4 shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2 border-b border-indigo-950/40 pb-2">
                <Download size={14} className="text-indigo-400" />
                <h4 className="text-xs font-bold text-white">จัดกลุ่มความถี่ & แปลงสรุป Excel</h4>
              </div>
              <p className="text-[10px] text-slate-450 leading-relaxed">
                มีตาราง Line List รายบุคคลเชิงเดี่ยวอยู่ อยากแปลงความถี่เป็นแบบตารางกวาด (Matrix/Long) กดปุ่มนี้เพื่อตั้งค่าจัดกลุ่มเวลาแล้วดาวน์โหลดทันที
              </p>
            </div>

            <button
              onClick={() => setIsExportOpen(true)}
              disabled={!mapping.province || !mapping.date}
              className={clsx(
                'w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold border transition-all active:scale-95',
                (!mapping.province || !mapping.date)
                  ? 'bg-slate-950/20 border-slate-900 text-slate-650 cursor-not-allowed'
                  : 'border-indigo-500 text-indigo-300 bg-indigo-500/5 hover:bg-indigo-500 hover:text-white'
              )}
            >
              <span>แปลง & ดาวน์โหลดตาราง Excel...</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Field helpers ──

interface FieldRowProps {
  label: string
  sublabel?: string
  required?: boolean
  accentLeft?: boolean
  value: string
  onChange: (v: string) => void
  columns: string[]
  placeholder: string
}

const FieldRow: React.FC<FieldRowProps> = ({ label, sublabel, required, accentLeft, value, onChange, columns, placeholder }) => (
  <div className={clsx(
    'flex items-center gap-3 bg-slate-950/20 border border-slate-850 px-3 py-2.5 rounded-xl',
    accentLeft && 'border-l-4 border-l-blue-500'
  )}>
    <div className="w-28 shrink-0">
      <span className="text-[11px] font-semibold text-slate-200 block">
        {label} {required && <span className="text-red-400">*</span>}
      </span>
      {sublabel && <span className="text-[9px] text-slate-500 block leading-tight">{sublabel}</span>}
    </div>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="flex-1 text-[11px] px-2 py-1.5 bg-slate-900 border border-slate-700/60 rounded-lg text-white"
    >
      <option value="">{placeholder}</option>
      {columns.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  </div>
)

interface FieldRowCheckboxProps extends FieldRowProps {
  id: string
  checked: boolean
  onCheck: (v: boolean) => void
}

const FieldRowCheckbox: React.FC<FieldRowCheckboxProps> = ({ label, id, checked, onCheck, value, onChange, columns, placeholder }) => (
  <div className="flex items-center gap-3 bg-slate-950/20 border border-slate-850 px-3 py-2.5 rounded-xl">
    <div className="w-28 shrink-0 flex items-center gap-1">
      <input
        type="checkbox" id={id}
        checked={checked} onChange={e => onCheck(e.target.checked)}
        className="rounded bg-slate-800 accent-blue-500 w-3.5 h-3.5"
      />
      <label htmlFor={id} className="text-[11px] font-semibold text-slate-200 cursor-pointer">{label}</label>
    </div>
    <select
      disabled={!checked}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="flex-1 text-[11px] px-2 py-1.5 bg-slate-900 border border-slate-700/60 rounded-lg text-white disabled:opacity-40"
    >
      <option value="">{placeholder}</option>
      {columns.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  </div>
)
