/**
 * PreviewLightbox.tsx — Full-screen table template preview modal
 */
import React from 'react'
import { FileSpreadsheet, X, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react'
import clsx from 'clsx'

type PreviewType = 'static' | 'dynamic_wide' | 'dynamic_long' | 'linelist'

interface PreviewLightboxProps {
  previewType: PreviewType
  onClose: () => void
  onSwitchFormat?: (t: 'dynamic_wide' | 'dynamic_long') => void
}

export const PreviewLightbox: React.FC<PreviewLightboxProps> = ({ previewType, onClose, onSwitchFormat }) => {
  const isDynamic = previewType === 'dynamic_wide' || previewType === 'dynamic_long'

  const colorClass = {
    static: { icon: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', btn: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/20' },
    dynamic_wide: { icon: 'bg-blue-500/10 border-blue-500/20 text-blue-400', btn: 'bg-blue-600 hover:bg-blue-500 shadow-blue-950/20' },
    dynamic_long: { icon: 'bg-blue-500/10 border-blue-500/20 text-blue-400', btn: 'bg-blue-600 hover:bg-blue-500 shadow-blue-950/20' },
    linelist: { icon: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400', btn: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-950/20' },
  }[previewType]

  const titleMap: Record<PreviewType, string> = {
    static: 'โครงสร้างตาราง: ข้อมูลคงที่เชิงพื้นที่ (Static Map)',
    dynamic_wide: 'โครงสร้างตาราง: อนุกรมเวลา (Format A: Wide Matrix)',
    dynamic_long: 'โครงสร้างตาราง: อนุกรมเวลา (Format B: Dynamic Long)',
    linelist: 'โครงสร้างตาราง: ข้อมูลดิบรายบุคคล (Line Listing)',
  }

  const descMap: Record<PreviewType, string> = {
    static: 'แบบตัวอย่างตารางสำหรับพล็อตสีขอบเขตคงที่สะสม ไม่มีมิติเวลา',
    dynamic_wide: 'แบบตัวอย่างตารางข้อมูลความถี่รายสัปดาห์/ช่วงเวลา เพื่อขับเคลื่อน Timeline แผนที่',
    dynamic_long: 'แบบตัวอย่างตารางข้อมูลความถี่รายสัปดาห์/ช่วงเวลา เพื่อขับเคลื่อน Timeline แผนที่',
    linelist: 'แบบตัวอย่างประวัติรายเคส 1 แถวต่อผู้ป่วย เหมาะสำหรับแปลงจัดกลุ่มสรุปผลโดยตรง',
  }

  return (
    <div
      className="fixed inset-0 z-[3100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#0b1329] border border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden relative animate-scale-up text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800/80 bg-slate-950/40 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={clsx('p-2.5 rounded-xl border shadow-lg', colorClass.icon)}>
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-white">{titleMap[previewType]}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{descMap[previewType]}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-slate-800/50 bg-slate-900"
          >
            <X size={18} />
          </button>
        </div>

        {/* Dynamic format switcher */}
        {isDynamic && onSwitchFormat && (
          <div className="px-6 py-3 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-between gap-4">
            <span className="text-[11px] font-bold text-slate-450">สลับรูปแบบดูตัวอย่างรวดเร็ว:</span>
            <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {(['dynamic_wide', 'dynamic_long'] as const).map(key => (
                <button
                  key={key}
                  onClick={() => onSwitchFormat(key)}
                  className={clsx(
                    'px-3 py-1.5 rounded text-xs font-bold transition-all',
                    previewType === key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  {key === 'dynamic_wide' ? 'Format A: Wide Matrix' : 'Format B: Dynamic Long'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-slate-950/40 border border-slate-800/70 p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <AlertCircle size={14} className="text-blue-400" />
              <span>คำแนะนำในการเตรียมไฟล์ Excel/CSV (.xlsx, .xls, .csv, .ods):</span>
            </div>
            <ul className="text-[11px] text-slate-450 list-disc list-inside space-y-1 leading-relaxed">
              <li>ชื่อหัวคอลัมน์ในบรรทัดแรกต้องชัดเจน ห้ามมีเซลล์ที่ผสาน (Merge Cells)</li>
              <li>ขอบเขตการปกครองสามารถใช้ได้ทั้ง <b className="text-white">ชื่อภาษาไทยเต็ม</b> หรือ <b className="text-white">รหัสเขตปกครองมาตรฐานมหาดไทย (2/4/6 หลัก)</b></li>
              <li>ระบบมีระบบ <b className="text-blue-400">Auto-detect คอลัมน์อัจฉริยะ</b> คอยช่วยตรวจสอบและจับคู่ฟิลด์หลังจากอัปโหลดโดยอัตโนมัติ</li>
            </ul>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-white flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-400" />
                <span>ตารางตัวอย่างข้อมูลจำลอง</span>
              </span>
              <span className="text-[10px] text-slate-500">จำลองข้อมูลเพื่อเป็นต้นแบบจำลอง</span>
            </div>

            <div className="overflow-x-auto border border-slate-800/80 rounded-xl bg-slate-950/60 shadow-inner">
              {previewType === 'static' && <StaticTable />}
              {previewType === 'dynamic_wide' && <WideTable />}
              {previewType === 'dynamic_long' && <LongTable />}
              {previewType === 'linelist' && <LineListTable />}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="border border-slate-800/60 p-4 rounded-xl bg-slate-900/30">
              <span className="text-xs font-bold text-slate-200 block mb-2">🏷️ คอลัมน์ที่จำเป็น (Required Columns)</span>
              <div className="text-[11px] text-slate-400 leading-relaxed space-y-1.5">
                {previewType === 'static' && <p>ต้องการคอลัมน์ <span className="text-white font-bold">จังหวัด</span> เสมอ ส่วนอำเภอ/ตำบลและจำนวนเป็นส่วนเสริม</p>}
                {previewType === 'dynamic_wide' && <p>ต้องการคอลัมน์ <span className="text-white font-bold">จังหวัด</span> และคอลัมน์อนุกรมเวลารายสัปดาห์แนวนอน</p>}
                {previewType === 'dynamic_long' && <p>ต้องการคอลัมน์ <span className="text-white font-bold">วันที่</span>, <span className="text-white font-bold">จังหวัด</span>, และ <span className="text-white font-bold">จำนวนผู้ป่วย</span> เสมอ</p>}
                {previewType === 'linelist' && <p>ต้องการคอลัมน์ <span className="text-white font-bold">วันที่</span> และ <span className="text-white font-bold">จังหวัด</span> เพื่อจำแนกเคสรายคน</p>}
              </div>
            </div>

            <div className="border border-slate-800/60 p-4 rounded-xl bg-slate-900/30">
              <span className="text-xs font-bold text-slate-200 block mb-2">💡 ทิปส์การประมวลผลตำแหน่งพิกัด</span>
              <div className="text-[11px] text-slate-400 leading-relaxed">
                <p>ระบบใช้เทคโนโลยี <span className="text-blue-400 font-bold">LocationResolver</span> ค้นหาพิกัดและเชื่อมโยงรหัสเขตปกครองโดยอัตโนมัติ</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-950/40 flex justify-end">
          <button
            onClick={onClose}
            className={clsx('px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all active:scale-95', colorClass.btn, 'shadow-md')}
          >
            เข้าใจแล้ว, ปิดหน้าต่างตัวอย่าง
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sample Tables ──

const th = 'p-3.5 font-black border-r border-slate-800/60'
const td = 'p-3.5 border-r border-slate-800/40'

const StaticTable = () => (
  <table className="w-full text-left text-xs border-collapse">
    <thead>
      <tr className="bg-slate-905 border-b border-slate-800 text-slate-200">
        <th className={th}>จังหวัด <span className="text-red-400">*</span></th>
        <th className={th}>อำเภอ</th>
        <th className={th}>ตำบล</th>
        <th className={th}>จำนวนผู้ป่วย</th>
        <th className="p-3.5 font-black">สีกำหนดเอง (Hex)</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-800/50 text-slate-300">
      {[
        ['เชียงใหม่', 'เมืองเชียงใหม่', 'ศรีภูมิ', '150', '#EF4444'],
        ['เชียงใหม่', 'เมืองเชียงใหม่', 'สุเทพ', '85', '#F97316'],
        ['เชียงใหม่', 'แม่ริม', 'ริมใต้', '40', '#EAB308'],
        ['เชียงราย', 'เมืองเชียงราย', 'เวียง', '110', '#22C55E'],
      ].map(([p, a, t, v, color]) => (
        <tr key={`${p}-${t}`} className="hover:bg-slate-900/30 transition-colors">
          <td className={td}><span className="font-bold text-white">{p}</span></td>
          <td className={td}>{a}</td>
          <td className={td}>{t}</td>
          <td className={td}><span className="font-bold text-white">{v}</span></td>
          <td className="p-3.5"><span className="px-2 py-0.5 font-mono text-[10px] rounded bg-slate-800 border border-slate-700 text-slate-300">{color}</span></td>
        </tr>
      ))}
    </tbody>
  </table>
)

const WideTable = () => (
  <table className="w-full text-left text-xs border-collapse">
    <thead>
      <tr className="bg-slate-905 border-b border-slate-800 text-slate-200">
        <th className={th}>จังหวัด <span className="text-red-400">*</span></th>
        <th className={th}>อำเภอ</th>
        <th className={th}>ตำบล</th>
        <th className={`${th} text-blue-400`}>2026-05-01 (W01) <span className="text-red-400">*</span></th>
        <th className={`${th} text-blue-400`}>2026-05-08 (W02) <span className="text-red-400">*</span></th>
        <th className="p-3.5 font-black text-blue-400">2026-05-15 (W03)</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-800/50 text-slate-300">
      {[
        ['กรุงเทพมหานคร', 'พระนคร', '-', '12', '18', '24'],
        ['กรุงเทพมหานคร', 'ดุสิต', '-', '5', '8', '15'],
        ['นนทบุรี', 'เมืองนนทบุรี', 'บางกระสอ', '8', '4', '9'],
        ['นนทบุรี', 'ปากเกร็ด', 'ปากเกร็ด', '3', '12', '7'],
      ].map((row, i) => (
        <tr key={i} className="hover:bg-slate-900/30 transition-colors">
          <td className={td}><span className="font-bold text-white">{row[0]}</span></td>
          <td className={td}>{row[1]}</td>
          <td className={`${td} text-slate-500`}>{row[2]}</td>
          <td className={td}><span className="font-bold text-white">{row[3]}</span></td>
          <td className={td}><span className="font-bold text-white">{row[4]}</span></td>
          <td className="p-3.5 font-bold text-slate-400">{row[5]}</td>
        </tr>
      ))}
    </tbody>
  </table>
)

const LongTable = () => (
  <table className="w-full text-left text-xs border-collapse">
    <thead>
      <tr className="bg-slate-905 border-b border-slate-800 text-slate-200">
        <th className={th}>วันที่ <span className="text-red-400">*</span></th>
        <th className={th}>จังหวัด <span className="text-red-400">*</span></th>
        <th className={th}>อำเภอ</th>
        <th className={th}>ตำบล</th>
        <th className="p-3.5 font-black">จำนวนผู้ป่วย <span className="text-red-400">*</span></th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-800/50 text-slate-300">
      {[
        ['2026-05-01', 'กรุงเทพมหานคร', 'พระนคร', '-', '12'],
        ['2026-05-01', 'เชียงใหม่', 'เมืองเชียงใหม่', 'ศรีภูมิ', '5'],
        ['2026-05-08', 'กรุงเทพมหานคร', 'พระนคร', '-', '18'],
        ['2026-05-08', 'เชียงใหม่', 'เมืองเชียงใหม่', 'ศรีภูมิ', '9'],
      ].map((row, i) => (
        <tr key={i} className="hover:bg-slate-900/30 transition-colors">
          <td className={td}><span className="font-bold text-white">{row[0]}</span></td>
          <td className={td}><span className="font-bold text-white">{row[1]}</span></td>
          <td className={td}>{row[2]}</td>
          <td className={`${td} text-slate-500`}>{row[3]}</td>
          <td className="p-3.5 font-bold text-white">{row[4]}</td>
        </tr>
      ))}
    </tbody>
  </table>
)

const LineListTable = () => (
  <table className="w-full text-left text-xs border-collapse">
    <thead>
      <tr className="bg-slate-905 border-b border-slate-800 text-slate-200">
        <th className={th}>วันที่เริ่มป่วย (Onset) <span className="text-red-400">*</span></th>
        <th className={th}>จังหวัด <span className="text-red-400">*</span></th>
        <th className={th}>อำเภอ</th>
        <th className={th}>ตำบล</th>
        <th className={th}>อายุ</th>
        <th className={th}>เพศ</th>
        <th className="p-3.5 font-black">อาการหลัก</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-800/50 text-slate-300">
      {[
        ['2026-05-24', 'เชียงใหม่', 'เมืองเชียงใหม่', 'ศรีภูมิ', '28', 'ชาย', 'มีไข้, มีผื่นแดง'],
        ['2026-05-24', 'เชียงใหม่', 'เมืองเชียงใหม่', 'สุเทพ', '45', 'หญิง', 'มีไข้, ปวดศีรษะ'],
        ['2026-05-25', 'เชียงใหม่', 'แม่ริม', 'ริมใต้', '12', 'ชาย', 'มีไข้สูง'],
        ['2026-05-25', 'ลำพูน', 'เมืองลำพูน', 'ในเมือง', '33', 'หญิง', 'อ่อนเพลีย'],
      ].map((row, i) => (
        <tr key={i} className="hover:bg-slate-900/30 transition-colors">
          <td className={td}><span className="font-bold text-white">{row[0]}</span></td>
          <td className={td}><span className="font-bold text-white">{row[1]}</span></td>
          <td className={td}>{row[2]}</td>
          <td className={td}>{row[3]}</td>
          <td className={`${td} text-slate-400`}>{row[4]}</td>
          <td className={`${td} text-slate-400`}>{row[5]}</td>
          <td className="p-3.5 text-slate-400">{row[6]}</td>
        </tr>
      ))}
    </tbody>
  </table>
)
