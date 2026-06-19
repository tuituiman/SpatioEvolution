import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { TitleWidgetConfig } from '../../store/useAppStore'

interface Props { widgetId: string }

const COLOR_PRESETS = ['#f1f5f9', '#ffffff', '#ffeb3b', '#f97316', '#22c55e', '#06b6d4', '#94a3b8', '#0f172a']

const Swatch: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
  <div className="flex gap-1.5 flex-wrap items-center">
    {COLOR_PRESETS.map(c => (
      <button key={c} onClick={() => onChange(c)}
        style={{ backgroundColor: c }}
        className={`w-5 h-5 rounded cursor-pointer border-2 transition-all ${value === c ? 'border-blue-400 scale-110' : 'border-slate-700 hover:scale-105'}`} />
    ))}
    <input type="color" value={value} onChange={e => onChange(e.target.value)}
      className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent" title="เลือกสีเอง" />
  </div>
)

const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className="bg-slate-950/30 border border-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-slate-900/50 hover:bg-slate-800/50 transition-colors cursor-pointer"
      >
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{title}</span>
        {isOpen ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
      </button>
      {isOpen && (
        <div className="p-3 pt-0 space-y-4 border-t border-slate-800/50 mt-3">
          {children}
        </div>
      )}
    </div>
  )
}
export const TitleInspector: React.FC<Props> = ({ widgetId }) => {
  const {
    widgetConfigs, setWidgetConfig,
    exportTitle, setExportTitle,
    exportSubtitle, setExportSubtitle,
    periods, currentStep
  } = useAppStore()

  const config = (widgetConfigs[widgetId] ?? {}) as TitleWidgetConfig
  const setC = (patch: Partial<TitleWidgetConfig>) => setWidgetConfig(widgetId, patch as any)
  const activePeriod = periods[currentStep]

  return (
    <div className="space-y-4 text-xs">
      {/* Text Content */}
      <CollapsibleSection title="📝 เนื้อหา" defaultOpen={true}>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">หัวข้อหลัก (Title)</label>
          <input type="text" value={exportTitle}
            onChange={e => setExportTitle(e.target.value)}
            placeholder="พิมพ์หัวข้อสถิติระบาดวิทยา..."
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1.5 text-[10px] focus:outline-none focus:border-blue-500" />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">คำบรรยาย (Subtitle)</label>
          <input type="text" value={exportSubtitle}
            onChange={e => setExportSubtitle(e.target.value)}
            placeholder="ขอบเขตเวลา พื้นที่ หรือรายละเอียดประกอบ..."
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1.5 text-[10px] focus:outline-none focus:border-blue-500" />
        </div>

      </CollapsibleSection>

      {/* Title Typography */}
      <CollapsibleSection title="🔤 ตัวอักษรหัวข้อ" defaultOpen={false}>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">ขนาด: {config.titleFontSize ?? 13}px</label>
          <input type="range" min={9} max={24} value={config.titleFontSize ?? 13}
            onChange={e => setC({ titleFontSize: Number(e.target.value) })}
            className="w-full accent-blue-500 cursor-pointer" />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-slate-400">สี</label>
          <Swatch value={config.titleColor ?? '#f1f5f9'} onChange={v => setC({ titleColor: v })} />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">ความหนา</label>
          <div className="flex gap-1.5">
            {(['normal', 'bold'] as const).map(w => (
              <button key={w} onClick={() => setC({ titleFontWeight: w })}
                className={`flex-1 py-1 rounded text-[10px] transition-all cursor-pointer ${config.titleFontWeight === w ? 'bg-blue-600 text-white font-bold' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
                style={{ fontWeight: w }}>
                {w === 'normal' ? 'ปกติ' : 'หนา'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">การจัดข้อความ</label>
          <div className="flex gap-1.5">
            {([{ id: 'left', label: '⬅ ซ้าย' }, { id: 'center', label: '↔ กลาง' }, { id: 'right', label: '➡ ขวา' }] as const).map(a => (
              <button key={a.id} onClick={() => setC({ align: a.id })}
                className={`flex-1 py-1 rounded text-[10px] transition-all cursor-pointer ${config.align === a.id ? 'bg-blue-600 text-white font-bold' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      {/* Subtitle Typography */}
      <CollapsibleSection title="🔡 ตัวอักษรคำบรรยาย" defaultOpen={false}>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">ขนาด: {config.subtitleFontSize ?? 9}px</label>
          <input type="range" min={7} max={16} value={config.subtitleFontSize ?? 9}
            onChange={e => setC({ subtitleFontSize: Number(e.target.value) })}
            className="w-full accent-blue-500 cursor-pointer" />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-slate-400">สี</label>
          <Swatch value={config.subtitleColor ?? '#94a3b8'} onChange={v => setC({ subtitleColor: v })} />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">ความหนา</label>
          <div className="flex gap-1.5">
            {(['normal', 'bold'] as const).map(w => {
              const currentWeight = config.subtitleFontWeight || 'normal'
              return (
                <button key={w} onClick={() => setC({ subtitleFontWeight: w })}
                  className={`flex-1 py-1 rounded text-[10px] transition-all cursor-pointer ${currentWeight === w ? 'bg-blue-600 text-white font-bold' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
                  style={{ fontWeight: w }}>
                  {w === 'normal' ? 'ปกติ' : 'หนา'}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">การจัดข้อความ</label>
          <div className="flex gap-1.5">
            {([{ id: 'left', label: '⬅ ซ้าย' }, { id: 'center', label: '↔ กลาง' }, { id: 'right', label: '➡ ขวา' }] as const).map(a => {
              const currentAlign = config.subtitleAlign || config.align || 'left'
              return (
                <button key={a.id} onClick={() => setC({ subtitleAlign: a.id })}
                  className={`flex-1 py-1 rounded text-[10px] transition-all cursor-pointer ${currentAlign === a.id ? 'bg-blue-600 text-white font-bold' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
                  {a.label}
                </button>
              )
            })}
          </div>
        </div>
      </CollapsibleSection>

      {/* Box Styling */}
      <CollapsibleSection title="📦 กล่องพื้นหลัง" defaultOpen={false}>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-slate-400">สีพื้นหลัง</label>
          <div className="flex gap-2 items-center">
            <Swatch value={config.bgColor ?? '#0f172a'} onChange={v => setC({ bgColor: v })} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">ความโปร่งใสพื้นหลัง: {Math.round((config.bgOpacity ?? 0) * 100)}%</label>
          <input type="range" min={0} max={100} value={Math.round((config.bgOpacity ?? 0) * 100)}
            onChange={e => setC({ bgOpacity: Number(e.target.value) / 100 })}
            className="w-full accent-blue-500 cursor-pointer" />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">มุมโค้ง: {config.borderRadius ?? 8}px</label>
          <input type="range" min={0} max={24} value={config.borderRadius ?? 8}
            onChange={e => setC({ borderRadius: Number(e.target.value) })}
            className="w-full accent-blue-500 cursor-pointer" />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">ความหนาเส้นขอบ: {config.borderWidth ?? 0}px</label>
          <input type="range" min={0} max={4} value={config.borderWidth ?? 0}
            onChange={e => setC({ borderWidth: Number(e.target.value) })}
            className="w-full accent-blue-500 cursor-pointer" />
        </div>

        {(config.borderWidth ?? 0) > 0 && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-400">สีเส้นขอบ</label>
            <Swatch value={config.borderColor ?? '#334155'} onChange={v => setC({ borderColor: v })} />
          </div>
        )}

        {/* Show logo in title box */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-800">
          <span className="text-[10px] font-semibold text-slate-400">🖼️ แสดงโลโก้ในกล่องหัวข้อ</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={config.showLogo ?? false}
              onChange={e => setC({ showLogo: e.target.checked })} className="sr-only peer" />
            <div className="w-8 h-4 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-500 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white" />
          </label>
        </div>
      </CollapsibleSection>
    </div>
  )
}
