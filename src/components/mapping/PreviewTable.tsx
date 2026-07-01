import React from 'react'
import { X, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react'
import clsx from 'clsx'
import { useTranslation } from '../../hooks/useTranslation'

interface PreviewTableProps {
  previewType: 'static' | 'dynamic_wide' | 'dynamic_long' | 'linelist' | null
  setPreviewType: (type: 'static' | 'dynamic_wide' | 'dynamic_long' | 'linelist' | null) => void
}

export const PreviewTable: React.FC<PreviewTableProps> = ({ previewType, setPreviewType }) => {
  const { t, language } = useTranslation()

  if (previewType === null) return null

  const isTh = language === 'th'

  return (
    <div 
      className="fixed inset-0 z-[3100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-fade-in"
      onClick={() => setPreviewType(null)}
    >
      <div 
        className="bg-spatio-surface border border-spatio-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden relative animate-scale-up text-spatio-text"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-spatio-border bg-spatio-surface-alt flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={clsx(
              "p-2.5 rounded-xl border shadow-lg",
              previewType === 'static' && "bg-emerald-500/10 border-emerald-500/20 text-emerald-550 dark:text-emerald-400",
              (previewType === 'dynamic_wide' || previewType === 'dynamic_long') && "bg-blue-500/10 border-blue-500/20 text-blue-550 dark:text-blue-400",
              previewType === 'linelist' && "bg-indigo-500/10 border-indigo-500/20 text-indigo-550 dark:text-indigo-400"
            )}>
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-spatio-text flex items-center gap-2">
                <span>
                  {previewType === 'static' && (isTh ? 'โครงสร้างตาราง: ข้อมูลคงที่เชิงพื้นที่ (Static Map)' : 'Table Structure: Static Spatial Map')}
                  {previewType === 'dynamic_wide' && (isTh ? 'โครงสร้างตาราง: อนุกรมเวลา (Format A: Wide Matrix)' : 'Table Structure: Time Series (Format A: Wide Matrix)')}
                  {previewType === 'dynamic_long' && (isTh ? 'โครงสร้างตาราง: อนุกรมเวลา (Format B: Dynamic Long)' : 'Table Structure: Time Series (Format B: Dynamic Long)')}
                  {previewType === 'linelist' && (isTh ? 'โครงสร้างตาราง: ข้อมูลดิบรายบุคคล (Line Listing)' : 'Table Structure: Raw Line Listing')}
                </span>
              </h3>
              <p className="text-xs text-spatio-muted mt-0.5">
                {previewType === 'static' && (isTh ? 'แบบตัวอย่างตารางสำหรับพล็อตสีขอบเขตคงที่สะสม ไม่มีมิติเวลา' : 'Example structure for static cumulative boundary maps with no time dimension')}
                {(previewType === 'dynamic_wide' || previewType === 'dynamic_long') && (isTh ? 'แบบตัวอย่างตารางข้อมูลความถี่รายสัปดาห์/ช่วงเวลา เพื่อขับเคลื่อน Timeline แผนที่' : 'Example structure for weekly/periodic data to drive the map timeline')}
                {previewType === 'linelist' && (isTh ? 'แบบตัวอย่างประวัติรายเคส 1 แถวต่อผู้ป่วย เหมาะสำหรับแปลงจัดกลุ่มสรุปผลโดยตรง' : 'Example structure for case history records (1 row per patient), ideal for direct group aggregation')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setPreviewType(null)}
            className="p-2 rounded-xl text-spatio-muted hover:text-spatio-text hover:bg-spatio-border/50 transition-all border border-spatio-border bg-spatio-surface-alt cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick Format Switcher for Dynamic Map */}
        {(previewType === 'dynamic_wide' || previewType === 'dynamic_long') && (
          <div className="px-6 py-3 bg-spatio-surface-alt border-b border-spatio-border flex items-center justify-between gap-4">
            <span className="text-[11px] font-bold text-spatio-muted">{isTh ? 'สลับรูปแบบดูตัวอย่างรวดเร็ว:' : 'Quick switcher:'}</span>
            <div className="flex gap-1 bg-spatio-surface p-1 rounded-lg border border-spatio-border">
              <button
                onClick={() => setPreviewType('dynamic_wide')}
                className={clsx(
                  "px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer",
                  previewType === 'dynamic_wide' ? "bg-indigo-600 text-white" : "text-spatio-muted hover:text-spatio-text"
                )}
              >
                Format A: Wide Matrix
              </button>
              <button
                onClick={() => setPreviewType('dynamic_long')}
                className={clsx(
                  "px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer",
                  previewType === 'dynamic_long' ? "bg-indigo-600 text-white" : "text-spatio-muted hover:text-spatio-text"
                )}
              >
                Format B: Dynamic Long
              </button>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Detailed Guidelines Card */}
          <div className="bg-spatio-surface-alt border border-spatio-border p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-spatio-text">
              <AlertCircle size={14} className="text-indigo-500 dark:text-indigo-400" />
              <span>{isTh ? 'คำแนะนำในการเตรียมไฟล์ Excel/CSV (.xlsx, .xls, .csv, .ods):' : 'Guidelines for spreadsheet preparation (.xlsx, .xls, .csv, .ods):'}</span>
            </div>
            <ul className="text-[11px] text-spatio-muted list-disc list-inside space-y-1 leading-relaxed">
              <li>{isTh ? 'ชื่อหัวคอลัมน์ในบรรทัดแรกต้องชัดเจน ห้ามมีเซลล์ที่ผสาน (Merge Cells)' : 'Column headers in the first row must be clear. No merged cells allowed.'}</li>
              <li>{isTh ? 'ขอบเขตการปกครองสามารถใช้ได้ทั้ง ชื่อภาษาไทยเต็ม (เช่น "เชียงใหม่", "เมืองเชียงใหม่") หรือ รหัสเขตปกครองมาตรฐานมหาดไทย (2/4/6 หลัก)' : 'Geographic boundaries support full Thai names (e.g., "เชียงใหม่") or Ministry of Interior codes (2, 4, 6 digits).'}</li>
              <li>{isTh ? 'ระบบมีระบบ Auto-detect คอลัมน์อัจฉริยะ คอยช่วยตรวจสอบและจับคู่ฟิลด์หลังจากอัปโหลดโดยอัตโนมัติ' : 'The system has an intelligent Auto-detect feature to map spreadsheet columns after uploading.'}</li>
            </ul>
          </div>

          {/* Grid table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-spatio-text flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-550 dark:text-emerald-400" />
                <span>{isTh ? 'ตารางตัวอย่างข้อมูลจำลอง' : 'Simulated Table Reference'}</span>
              </span>
              <span className="text-[10px] text-spatio-muted">{isTh ? 'จำลองข้อมูลเพื่อเป็นต้นแบบจำลอง' : 'Sample reference template'}</span>
            </div>

            <div className="overflow-x-auto border border-spatio-border rounded-xl bg-spatio-surface-alt shadow-inner">
              {previewType === 'static' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-spatio-surface-alt border-b border-spatio-border text-spatio-text">
                      <th className="p-3.5 font-black border-r border-spatio-border/60">{t('level_province')} <span className="text-red-400 font-bold">*</span></th>
                      <th className="p-3.5 font-black border-r border-spatio-border/60">{t('level_district')}</th>
                      <th className="p-3.5 font-black border-r border-spatio-border/60">{t('level_subdistrict')}</th>
                      <th className="p-3.5 font-black border-r border-spatio-border/60">{isTh ? 'จำนวนผู้ป่วย' : 'Case Count'}</th>
                      <th className="p-3.5 font-black">{isTh ? 'สีกำหนดเอง (Hex)' : 'Custom Color (Hex)'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-spatio-border/50 text-spatio-text">
                    <tr className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="p-3.5 border-r border-spatio-border/40">
                        <span className="font-bold text-spatio-text">{isTh ? 'เชียงใหม่' : 'Chiang Mai'}</span>
                        <span className="block text-[10px] text-rose-500 font-semibold mt-0.5">{isTh ? '[จำเป็น]' : '[Required]'}</span>
                      </td>
                      <td className="p-3.5 border-r border-spatio-border/40">
                        <span>{isTh ? 'เมืองเชียงใหม่' : 'Mueang Chiang Mai'}</span>
                        <span className="block text-[10px] text-indigo-500 dark:text-indigo-400 mt-0.5">{isTh ? '[เลือกใส่ - หรือรหัส]' : '[Optional - Name or Code]'}</span>
                      </td>
                      <td className="p-3.5 border-r border-spatio-border/40">
                        <span>{isTh ? 'ศรีภูมิ' : 'Sri Phum'}</span>
                        <span className="block text-[10px] text-indigo-500 dark:text-indigo-400 mt-0.5">{isTh ? '[เลือกใส่]' : '[Optional]'}</span>
                      </td>
                      <td className="p-3.5 font-bold text-spatio-text border-r border-spatio-border/40">
                        <span>150</span>
                        <span className="block text-[10px] text-spatio-muted mt-0.5">{isTh ? '[ค่าเลขพล็อตช่วงสี]' : '[Numeric values]'}</span>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 font-mono text-[10px] rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400 font-bold">#EF4444</span>
                        <span className="block text-[10px] text-spatio-muted mt-0.5">{isTh ? '[เลือกใส่ - ฟิกซ์สีบนแผนที่]' : '[Optional - Fixes hex color]'}</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'เชียงใหม่' : 'Chiang Mai'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'เมืองเชียงใหม่' : 'Mueang Chiang Mai'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'สุเทพ' : 'Suthep'}</td>
                      <td className="p-3.5 font-bold text-spatio-text border-r border-spatio-border/40">85</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 font-mono text-[10px] rounded bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 font-bold">#F97316</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'เชียงใหม่' : 'Chiang Mai'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'แม่ริม' : 'Mae Rim'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'ริมใต้' : 'Rim Tai'}</td>
                      <td className="p-3.5 font-bold text-spatio-text border-r border-spatio-border/40">40</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 font-mono text-[10px] rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-400 font-bold">#EAB308</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'เชียงราย' : 'Chiang Rai'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'เมืองเชียงราย' : 'Mueang Chiang Rai'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'เวียง' : 'Wiang'}</td>
                      <td className="p-3.5 font-bold text-spatio-text border-r border-spatio-border/40">110</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 font-mono text-[10px] rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">#22C55E</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}

              {previewType === 'dynamic_wide' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-spatio-surface-alt border-b border-spatio-border text-spatio-text">
                      <th className="p-3.5 font-black border-r border-spatio-border/60">{t('level_province')} <span className="text-red-400 font-bold">*</span></th>
                      <th className="p-3.5 font-black border-r border-spatio-border/60">{t('level_district')}</th>
                      <th className="p-3.5 font-black border-r border-spatio-border/60">{t('level_subdistrict')}</th>
                      <th className="p-3.5 font-black text-indigo-600 dark:text-indigo-400 border-r border-spatio-border/60">2026-05-01 (W01) <span className="text-red-400 font-bold">*</span></th>
                      <th className="p-3.5 font-black text-indigo-600 dark:text-indigo-400 border-r border-spatio-border/60">2026-05-08 (W02) <span className="text-red-400 font-bold">*</span></th>
                      <th className="p-3.5 font-black text-indigo-600 dark:text-indigo-400">2026-05-15 (W03)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-spatio-border/50 text-spatio-text">
                    <tr className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="p-3.5 border-r border-spatio-border/40">
                        <span className="font-bold text-spatio-text">{isTh ? 'กรุงเทพมหานคร' : 'Bangkok'}</span>
                        <span className="block text-[10px] text-rose-500 font-semibold mt-0.5">{isTh ? '[จำเป็น]' : '[Required]'}</span>
                      </td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'พระนคร' : 'Phra Nakhon'}</td>
                      <td className="p-3.5 text-spatio-muted border-r border-spatio-border/40">-</td>
                      <td className="p-3.5 font-bold text-spatio-text border-r border-spatio-border/40">
                        <span>12</span>
                        <span className="block text-[10px] text-spatio-muted mt-0.5">{isTh ? '[ยอดช่วงที่ 1]' : '[Period 1 cases]'}</span>
                      </td>
                      <td className="p-3.5 font-bold text-spatio-text border-r border-spatio-border/40">
                        <span>18</span>
                        <span className="block text-[10px] text-spatio-muted mt-0.5">{isTh ? '[ยอดช่วงที่ 2]' : '[Period 2 cases]'}</span>
                      </td>
                      <td className="p-3.5 font-bold text-spatio-muted">24</td>
                    </tr>
                    <tr className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'กรุงเทพมหานคร' : 'Bangkok'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'ดุสิต' : 'Dusit'}</td>
                      <td className="p-3.5 text-spatio-muted border-r border-spatio-border/40">-</td>
                      <td className="p-3.5 font-bold text-spatio-text border-r border-spatio-border/40">5</td>
                      <td className="p-3.5 font-bold text-spatio-text border-r border-spatio-border/40">8</td>
                      <td className="p-3.5 font-bold text-spatio-muted">15</td>
                    </tr>
                    <tr className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'นนทบุรี' : 'Nonthaburi'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'เมืองนนทบุรี' : 'Mueang Nonthaburi'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'บางกระสอ' : 'Bang Krasor'}</td>
                      <td className="p-3.5 font-bold text-spatio-text border-r border-spatio-border/40">8</td>
                      <td className="p-3.5 font-bold text-spatio-text border-r border-spatio-border/40">4</td>
                      <td className="p-3.5 font-bold text-spatio-muted">9</td>
                    </tr>
                    <tr className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'นนทบุรี' : 'Nonthaburi'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'ปากเกร็ด' : 'Pak Kret'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'ปากเกร็ด' : 'Pak Kret'}</td>
                      <td className="p-3.5 font-bold text-spatio-text border-r border-spatio-border/40">3</td>
                      <td className="p-3.5 font-bold text-spatio-text border-r border-spatio-border/40">12</td>
                      <td className="p-3.5 font-bold text-spatio-muted">7</td>
                    </tr>
                  </tbody>
                </table>
              )}

              {previewType === 'dynamic_long' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-spatio-surface-alt border-b border-spatio-border text-spatio-text">
                      <th className="p-3.5 font-black border-r border-spatio-border/60">{isTh ? 'วันที่' : 'Date'} <span className="text-red-400 font-bold">*</span></th>
                      <th className="p-3.5 font-black border-r border-spatio-border/60">{t('level_province')} <span className="text-red-400 font-bold">*</span></th>
                      <th className="p-3.5 font-black border-r border-spatio-border/60">{t('level_district')}</th>
                      <th className="p-3.5 font-black border-r border-spatio-border/60">{t('level_subdistrict')}</th>
                      <th className="p-3.5 font-black">{isTh ? 'จำนวนผู้ป่วย' : 'Case Count'} <span className="text-red-400 font-bold">*</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-spatio-border/50 text-spatio-text">
                    <tr className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="p-3.5 border-r border-spatio-border/40">
                        <span className="font-bold text-spatio-text">2026-05-01</span>
                        <span className="block text-[10px] text-rose-500 font-semibold mt-0.5">{isTh ? '[จำเป็น - วันที่/สัปดาห์]' : '[Required - Date/Week]'}</span>
                      </td>
                      <td className="p-3.5 border-r border-spatio-border/40">
                        <span className="font-bold text-spatio-text">{isTh ? 'กรุงเทพมหานคร' : 'Bangkok'}</span>
                        <span className="block text-[10px] text-rose-500 font-semibold mt-0.5">{isTh ? '[จำเป็น]' : '[Required]'}</span>
                      </td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'พระนคร' : 'Phra Nakhon'}</td>
                      <td className="p-3.5 text-spatio-muted border-r border-spatio-border/40">-</td>
                      <td className="p-3.5 font-bold text-spatio-text">
                        <span>12</span>
                        <span className="block text-[10px] text-rose-500 font-semibold mt-0.5">{isTh ? '[จำเป็น - ยอดเคส]' : '[Required - Cases]'}</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="p-3.5 border-r border-spatio-border/40">2026-05-01</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'เชียงใหม่' : 'Chiang Mai'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'เมืองเชียงใหม่' : 'Mueang Chiang Mai'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'ศรีภูมิ' : 'Sri Phum'}</td>
                      <td className="p-3.5 font-bold text-spatio-text">5</td>
                    </tr>
                    <tr className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="p-3.5 border-r border-spatio-border/40">2026-05-08</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'กรุงเทพมหานคร' : 'Bangkok'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'พระนคร' : 'Phra Nakhon'}</td>
                      <td className="p-3.5 text-spatio-muted border-r border-spatio-border/40">-</td>
                      <td className="p-3.5 font-bold text-spatio-text">18</td>
                    </tr>
                    <tr className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="p-3.5 border-r border-spatio-border/40">2026-05-08</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'เชียงใหม่' : 'Chiang Mai'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'เมืองเชียงใหม่' : 'Mueang Chiang Mai'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'ศรีภูมิ' : 'Sri Phum'}</td>
                      <td className="p-3.5 font-bold text-spatio-text">9</td>
                    </tr>
                  </tbody>
                </table>
              )}

              {previewType === 'linelist' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-spatio-surface-alt border-b border-spatio-border text-spatio-text">
                      <th className="p-3.5 font-black border-r border-spatio-border/60">{isTh ? 'วันที่เริ่มป่วย (Onset)' : 'Onset Date'} <span className="text-red-400 font-bold">*</span></th>
                      <th className="p-3.5 font-black border-r border-spatio-border/60">{t('level_province')} <span className="text-red-400 font-bold">*</span></th>
                      <th className="p-3.5 font-black border-r border-spatio-border/60">{t('level_district')}</th>
                      <th className="p-3.5 font-black border-r border-spatio-border/60">{t('level_subdistrict')}</th>
                      <th className="p-3.5 font-black border-r border-spatio-border/60">{isTh ? 'อายุ' : 'Age'}</th>
                      <th className="p-3.5 font-black border-r border-spatio-border/60">{isTh ? 'เพศ' : 'Gender'}</th>
                      <th className="p-3.5 font-black">{isTh ? 'อาการหลัก' : 'Symptoms'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-spatio-border/50 text-spatio-text">
                    <tr className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="p-3.5 border-r border-spatio-border/40">
                        <span className="font-bold text-spatio-text">2026-05-24</span>
                        <span className="block text-[10px] text-rose-500 font-semibold mt-0.5">{isTh ? '[จำเป็น - วันที่เกิดโรค]' : '[Required - OnsetDate]'}</span>
                      </td>
                      <td className="p-3.5 border-r border-spatio-border/40">
                        <span className="font-bold text-spatio-text">{isTh ? 'เชียงใหม่' : 'Chiang Mai'}</span>
                        <span className="block text-[10px] text-rose-500 font-semibold mt-0.5">{isTh ? '[จำเป็น]' : '[Required]'}</span>
                      </td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'เมืองเชียงใหม่' : 'Mueang Chiang Mai'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'ศรีภูมิ' : 'Sri Phum'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40 text-spatio-muted">28</td>
                      <td className="p-3.5 border-r border-spatio-border/40 text-spatio-muted">{isTh ? 'ชาย' : 'Male'}</td>
                      <td className="p-3.5 text-spatio-muted font-medium">{isTh ? 'มีไข้, มีผื่นแดง' : 'Fever, rash'}</td>
                    </tr>
                    <tr className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="p-3.5 border-r border-spatio-border/40 font-semibold text-spatio-text">{isTh ? '2026-05-24' : '2026-05-24'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'เชียงใหม่' : 'Chiang Mai'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'เมืองเชียงใหม่' : 'Mueang Chiang Mai'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'สุเทพ' : 'Suthep'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40 text-spatio-muted">45</td>
                      <td className="p-3.5 border-r border-spatio-border/40 text-spatio-muted">{isTh ? 'หญิง' : 'Female'}</td>
                      <td className="p-3.5 text-spatio-muted font-medium">{isTh ? 'มีไข้, ปวดศีรษะ' : 'Fever, headache'}</td>
                    </tr>
                    <tr className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="p-3.5 border-r border-spatio-border/40 font-semibold text-spatio-text">{isTh ? '2026-05-25' : '2026-05-25'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'เชียงใหม่' : 'Chiang Mai'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'แม่ริม' : 'Mae Rim'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'ริมใต้' : 'Rim Tai'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40 text-spatio-muted">12</td>
                      <td className="p-3.5 border-r border-spatio-border/40 text-spatio-muted">{isTh ? 'ชาย' : 'Male'}</td>
                      <td className="p-3.5 text-spatio-muted font-medium">{isTh ? 'มีไข้สูง' : 'High fever'}</td>
                    </tr>
                    <tr className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="p-3.5 border-r border-spatio-border/40 font-semibold text-spatio-text">{isTh ? '2026-05-25' : '2026-05-25'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'ลำพูน' : 'Lamphun'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'เมืองลำพูน' : 'Mueang Lamphun'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40">{isTh ? 'ในเมือง' : 'Nai Mueang'}</td>
                      <td className="p-3.5 border-r border-spatio-border/40 text-spatio-muted">33</td>
                      <td className="p-3.5 border-r border-spatio-border/40 text-spatio-muted">{isTh ? 'หญิง' : 'Female'}</td>
                      <td className="p-3.5 text-spatio-muted font-medium">{isTh ? 'อ่อนเพลีย' : 'Fatigue'}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Advanced info details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="border border-spatio-border p-4 rounded-xl bg-spatio-surface-alt">
              <span className="text-xs font-bold text-spatio-text block mb-2">🏷️ {isTh ? 'คอลัมน์ที่จำเป็น (Required Columns)' : 'Required Columns'}</span>
              <div className="text-[11px] text-spatio-muted leading-relaxed space-y-1.5">
                {previewType === 'static' && (
                  <p>{isTh ? 'ต้องการคอลัมน์ จังหวัด เสมอ ส่วนอำเภอ/ตำบลและจำนวนเป็นส่วนเสริมเพื่อกำหนดรายละเอียดในการวิเคราะห์ความลึกของแผนที่' : 'Requires the Province column. District/Subdistrict and Value are optional details to refine boundary mappings.'}</p>
                )}
                {previewType === 'dynamic_wide' && (
                  <p>{isTh ? 'ต้องการคอลัมน์ จังหวัด และคอลัมน์อนุกรมเวลารายสัปดาห์แนวนอนเพื่อนำไปคำนวณการแสดงผลของ Timeline บาร์ที่เล่นเคลื่อนไหวได้' : 'Requires the Province column and multiple horizontal date columns to populate the animated timeline.'}</p>
                )}
                {previewType === 'dynamic_long' && (
                  <p>{isTh ? 'ต้องการคอลัมน์ วันที่, จังหวัด, และ จำนวนผู้ป่วย เป็นตัวเลขรายคู่ วัน+พื้นที่ เสมอ เพื่อสรุปผลตามไทม์ไลน์' : 'Requires Date, Province, and Cases columns to process and sort spatial cases sequentially.'}</p>
                )}
                {previewType === 'linelist' && (
                  <p>{isTh ? 'ต้องการคอลัมน์ วันที่ (เริ่มป่วย/รายงาน) และ จังหวัด เพื่อใช้จำแนกเคสรายคนแล้วพล็อตรวมความถี่สดบนแผนที่' : 'Requires Date (onset/report date) and Province columns to count cases individually and sum them up for display.'}</p>
                )}
              </div>
            </div>

            <div className="border border-spatio-border p-4 rounded-xl bg-spatio-surface-alt">
              <span className="text-xs font-bold text-spatio-text block mb-2">💡 {isTh ? 'ทิปส์การประมวลผลตำแหน่งพิกัด' : 'Geographic Processing Tips'}</span>
              <div className="text-[11px] text-spatio-muted leading-relaxed space-y-1.5">
                <p>{isTh ? 'ระบบใช้เทคโนโลยี LocationResolver ค้นหาพิกัดและเชื่อมโยงรหัสเขตปกครองโดยอัตโนมัติ ทำให้ผู้ใช้ไม่ต้องระบุคอลัมน์ละติจูด/ลองจิจูดเข้ามาเองในไฟล์!' : 'The system uses an intelligent LocationResolver to find geographic coords and codes automatically. You do not need to provide lat/lng in your sheets!'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-spatio-border bg-spatio-surface-alt flex justify-end">
          <button
            onClick={() => setPreviewType(null)}
            className={clsx(
              "px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all active:scale-95 cursor-pointer shadow-lg",
              previewType === 'static' && "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/10",
              (previewType === 'dynamic_wide' || previewType === 'dynamic_long') && "bg-blue-600 hover:bg-blue-500 shadow-blue-500/10",
              previewType === 'linelist' && "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/10"
            )}
          >
            {isTh ? 'เข้าใจแล้ว, ปิดหน้าต่างตัวอย่าง' : 'Got it, close preview'}
          </button>
        </div>
      </div>
    </div>
  )
}
