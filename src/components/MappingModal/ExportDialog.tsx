/**
 * ExportDialog.tsx — Line Listing export settings overlay
 */
import React from 'react'
import { Download, X, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import type { DateMode } from '../../data/dateParser'

interface ExportDialogProps {
  exportTimeMode: DateMode
  setExportTimeMode: (m: DateMode) => void
  exportAdminFormat: 'thai' | 'code'
  setExportAdminFormat: (f: 'thai' | 'code') => void
  exportLayoutFormat: 'wide' | 'long'
  setExportLayoutFormat: (f: 'wide' | 'long') => void
  isExporting: boolean
  onExport: () => Promise<void>
  onClose: () => void
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  exportTimeMode, setExportTimeMode,
  exportAdminFormat, setExportAdminFormat,
  exportLayoutFormat, setExportLayoutFormat,
  isExporting, onExport, onClose,
}) => (
  <div className="fixed inset-0 z-[3000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
    <div className="spatio-card w-full max-w-md border border-slate-800 p-6 space-y-5 bg-slate-900 shadow-2xl relative">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg bg-slate-800 hover:bg-slate-750"
      >
        <X size={14} />
      </button>

      <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
        <Download className="text-indigo-400" size={18} />
        <h3 className="text-base font-bold text-white">ตั้งค่าการส่งออกไฟล์ข้อมูลสรุป</h3>
      </div>

      <div className="space-y-4 text-xs">
        {/* Time grouping */}
        <div>
          <label className="text-[11px] text-slate-400 block mb-1.5 font-semibold">1. จัดกลุ่มช่วงเวลาข้อมูล (Time Step):</label>
          <div className="grid grid-cols-3 gap-2">
            {(['daily', 'weekly', 'monthly'] as DateMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setExportTimeMode(mode)}
                className={clsx(
                  'py-1.5 text-center rounded border font-medium transition-all capitalize',
                  exportTimeMode === mode ? 'bg-indigo-600 border-indigo-500 text-white shadow' : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                )}
              >
                {mode === 'daily' ? 'รายวัน' : (mode === 'weekly' ? 'รายสัปดาห์' : 'รายเดือน')}
              </button>
            ))}
          </div>
        </div>

        {/* Admin name format */}
        <div>
          <label className="text-[11px] text-slate-400 block mb-1.5 font-semibold">2. รูปแบบคอลัมน์ชื่อพื้นที่ขอบเขต:</label>
          <div className="flex gap-2">
            {(['thai', 'code'] as const).map(fmt => (
              <button
                key={fmt}
                onClick={() => setExportAdminFormat(fmt)}
                className={clsx(
                  'flex-1 py-2 text-center rounded border font-medium transition-all',
                  exportAdminFormat === fmt ? 'bg-indigo-600 border-indigo-500 text-white shadow' : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                )}
              >
                {fmt === 'thai' ? 'ชื่อภาษาไทย (เช่น "เมืองเชียงใหม่")' : 'รหัสเขตปกครอง (เช่น "5001")'}
              </button>
            ))}
          </div>
        </div>

        {/* Wide vs Long layout */}
        <div>
          <label className="text-[11px] text-slate-400 block mb-1.5 font-semibold">
            3. รูปแบบตารางผลลัพธ์ Excel (Export Format Layout) *:
          </label>
          <div className="space-y-2">
            {[
              {
                val: 'wide',
                title: 'แบบตารางไขว้ (Wide Matrix Format)',
                desc: 'กางแนวนอน แถวแทนเขตพื้นที่ หัวคอลัมน์แทนแต่ละสัปดาห์/ช่วงเวลา (เหมาะสำหรับดูใน Excel)',
              },
              {
                val: 'long',
                title: 'แบบแถวเรียงอนุกรมแนวยาว (Long Format)',
                desc: 'เรียงแนวตั้ง แถวแทนคู่ของ [วันที่ + เขตพื้นที่] เหมาะสำหรับส่งต่อไปยังระบบสถิติ Tableau, PowerBI หรือ R',
              },
            ].map(({ val, title, desc }) => (
              <label
                key={val}
                onClick={() => setExportLayoutFormat(val as 'wide' | 'long')}
                className={clsx(
                  'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:bg-slate-800/40',
                  exportLayoutFormat === val ? 'border-indigo-500/70 bg-indigo-500/5 text-white' : 'border-slate-800 bg-slate-950/20 text-slate-400'
                )}
              >
                <input
                  type="radio"
                  name="modal-export-layout"
                  checked={exportLayoutFormat === val}
                  onChange={() => setExportLayoutFormat(val as 'wide' | 'long')}
                  className="mt-0.5 accent-indigo-500"
                />
                <div>
                  <span className="font-bold text-slate-100 text-[11px] block">{title}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block leading-normal">{desc}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-3 border-t border-slate-800 text-xs">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors bg-slate-950/20"
        >
          ยกเลิก
        </button>
        <button
          onClick={onExport}
          disabled={isExporting}
          className="flex-1 py-2.5 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all shadow-indigo-950/30"
        >
          {isExporting ? (
            <>
              <RefreshCw className="animate-spin" size={12} />
              <span>กำลังนำออก...</span>
            </>
          ) : (
            <>
              <Download size={12} />
              <span>ดาวน์โหลดสรุป</span>
            </>
          )}
        </button>
      </div>
    </div>
  </div>
)
