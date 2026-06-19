/**
 * UploadTab.tsx — 3 upload cards: Static / Dynamic / Line Listing
 */
import React from 'react'
import { Upload, MapPin, Activity, Users, Sparkles } from 'lucide-react'
import type { FlowType, MappingState } from './hooks/useMappingState'

interface UploadTabProps {
  handleFileDrop: MappingState['handleFileDrop']
  handleFileChange: MappingState['handleFileChange']
  setPreviewType: MappingState['setPreviewType']
}

interface FlowCardProps {
  flow: FlowType
  color: 'emerald' | 'blue' | 'indigo'
  icon: React.ReactNode
  title: string
  description: string
  previewKey: 'static' | 'dynamic_wide' | 'linelist'
  handleFileDrop: UploadTabProps['handleFileDrop']
  handleFileChange: UploadTabProps['handleFileChange']
  setPreviewType: UploadTabProps['setPreviewType']
}

const FlowCard: React.FC<FlowCardProps> = ({
  flow, color, icon, title, description, previewKey,
  handleFileDrop, handleFileChange, setPreviewType
}) => {
  const colorMap = {
    emerald: {
      border: 'border-t-emerald-500',
      iconBg: 'bg-emerald-500/10 border-emerald-500/20',
      iconText: 'text-emerald-400',
      btn: 'text-emerald-400 hover:text-emerald-300 bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/20',
      dropBorder: 'hover:border-emerald-500/50',
      uploadColor: 'text-emerald-500',
      hoverBg: 'hover:bg-emerald-600',
    },
    blue: {
      border: 'border-t-blue-500',
      iconBg: 'bg-blue-500/10 border-blue-500/20',
      iconText: 'text-blue-400',
      btn: 'text-blue-400 hover:text-blue-300 bg-blue-500/5 hover:bg-blue-500/10 border-blue-500/20',
      dropBorder: 'hover:border-blue-500/50',
      uploadColor: 'text-blue-500',
      hoverBg: 'hover:bg-blue-600',
    },
    indigo: {
      border: 'border-t-indigo-500',
      iconBg: 'bg-indigo-500/10 border-indigo-500/20',
      iconText: 'text-indigo-400',
      btn: 'text-indigo-400 hover:text-indigo-300 bg-indigo-500/5 hover:bg-indigo-500/10 border-indigo-500/20',
      dropBorder: 'hover:border-indigo-500/50',
      uploadColor: 'text-indigo-500',
      hoverBg: 'hover:bg-indigo-600',
    },
  }
  const c = colorMap[color]

  return (
    <div className={`spatio-card p-5 border-t-4 ${c.border} bg-slate-950/20 flex flex-col justify-between gap-4`}>
      <div className="space-y-2.5">
        <div className={`w-10 h-10 rounded-xl ${c.iconBg} border flex items-center justify-center shadow-lg`}>
          <span className={c.iconText}>{icon}</span>
        </div>
        <div>
          <h4 className="text-sm font-bold text-white">{title}</h4>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{description}</p>
        </div>

        <button
          onClick={() => setPreviewType(previewKey)}
          className={`text-[11px] font-bold flex items-center gap-1.5 transition-all px-2.5 py-1.5 rounded-lg border w-fit mt-1 shadow-sm active:scale-95 ${c.btn}`}
        >
          <Sparkles size={12} />
          <span>💡 ดูโครงสร้างตารางตัวอย่าง (แบบขยายใหญ่)</span>
        </button>
      </div>

      <div
        onDragOver={e => e.preventDefault()}
        onDrop={e => handleFileDrop(e, flow)}
        className={`border border-dashed border-slate-800 ${c.dropBorder} rounded-xl p-4 bg-slate-950/40 flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer transition-all duration-300 group`}
      >
        <Upload size={16} className={`${c.uploadColor} group-hover:scale-110 transition-transform`} />
        <span className="text-[9px] text-slate-400">ลากไฟล์มาวาง หรือ</span>
        <label className={`spatio-btn px-3 py-1 bg-slate-800 ${c.hoverBg} hover:text-white text-[9px] font-semibold rounded cursor-pointer transition-all`}>
          เลือกไฟล์
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleFileChange(e, flow)} />
        </label>
      </div>
    </div>
  )
}

export const UploadTab: React.FC<UploadTabProps> = ({
  handleFileDrop, handleFileChange, setPreviewType
}) => (
  <div className="space-y-6 animate-fade-in">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <FlowCard
        flow="static"
        color="emerald"
        icon={<MapPin size={20} />}
        title="1. ข้อมูลคงที่เชิงพื้นที่ (Static Map)"
        description="ข้อมูลภาพนิ่งแสดงผลสีขอบเขตแบบสีคงที่สะสม ไม่มีปุ่ม Timeline เคลื่อนไหวเชิงมิติเวลา"
        previewKey="static"
        handleFileDrop={handleFileDrop}
        handleFileChange={handleFileChange}
        setPreviewType={setPreviewType}
      />
      <FlowCard
        flow="dynamic"
        color="blue"
        icon={<Activity size={20} />}
        title="2. ข้อมูลอนุกรมเวลา (Dynamic Map)"
        description="ข้อมูลการระบาดรายสัปดาห์/เดือน/ปี ขับเคลื่อนปุ่มเล่นภาพเคลื่อนไหว รองรับทั้งตารางไขว้ (Wide) และอนุกรมแนวตั้ง (Long)"
        previewKey="dynamic_wide"
        handleFileDrop={handleFileDrop}
        handleFileChange={handleFileChange}
        setPreviewType={setPreviewType}
      />
      <FlowCard
        flow="linelist"
        color="indigo"
        icon={<Users size={20} />}
        title="3. ข้อมูลดิบรายบุคคล (Line Listing)"
        description="ตารางดิบประวัติผู้ป่วยรายคน (1 แถว = 1 เคส) เหมาะสำหรับแปลงสรุปความถี่ยอด Excel Matrix หรือสั่งรวมยอดแล้วพล็อตแผนที่สด"
        previewKey="linelist"
        handleFileDrop={handleFileDrop}
        handleFileChange={handleFileChange}
        setPreviewType={setPreviewType}
      />
    </div>
  </div>
)
