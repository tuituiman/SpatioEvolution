import React, { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { LegendWidgetConfig } from '../../store/useAppStore'

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

export const LegendInspector: React.FC<Props> = ({ widgetId }) => {
  const { widgetConfigs, setWidgetConfig, globalBreaks } = useAppStore()
  const config = (widgetConfigs[widgetId] ?? {}) as LegendWidgetConfig
  const setC = (patch: Partial<LegendWidgetConfig>) => setWidgetConfig(widgetId, patch as any)

  const defaultLabels = useMemo(() => {
    const list = globalBreaks.map((b, i) => {
      return i === 0 ? `1 – ${b.toLocaleString()}` : `${(globalBreaks[i - 1] + 1).toLocaleString()} – ${b.toLocaleString()}`
    })
    if (globalBreaks.length > 0) {
      list.push(`> ${globalBreaks[globalBreaks.length - 1].toLocaleString()}`)
    }
    return list
  }, [globalBreaks])

  const handleCustomLabelChange = (index: number, val: string) => {
    setC({
      customLabels: {
        ...(config.customLabels || {}),
        [index]: val
      }
    })
  }

  return (
    <div className="space-y-4 text-xs">
      {/* 1. รูปแบบ Legend */}
      <CollapsibleSection title="1️⃣ รูปแบบ Legend" defaultOpen={true}>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">ทิศทาง</label>
          <div className="flex gap-1.5">
            {([
              { id: 'vertical', label: '↕ แนวตั้ง' },
              { id: 'horizontal', label: '↔ แนวนอน' }
            ] as const).map(opt => (
              <button key={opt.id} onClick={() => setC({ orientation: opt.id })}
                className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all cursor-pointer ${config.orientation === opt.id ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">สัญลักษณ์สี</label>
          <div className="flex gap-1.5">
            {([
              { id: 'square', label: '■ สี่เหลี่ยม' },
              { id: 'circle', label: '● วงกลม' },
              { id: 'line', label: '─ เส้น' },
            ] as const).map(opt => (
              <button key={opt.id} onClick={() => setC({ swatch: opt.id })}
                className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all cursor-pointer ${config.swatch === opt.id ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      {/* 2. ชื่อ Legend */}
      <CollapsibleSection title="2️⃣ ชื่อ Legend และการปรับแต่ง" defaultOpen={false}>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">หัวข้อ (Title)</label>
          <input type="text" value={config.customTitle ?? 'คำอธิบายสัญลักษณ์'}
            onChange={e => setC({ customTitle: e.target.value })}
            placeholder="พิมพ์ชื่ออธิบายสัญลักษณ์..."
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1.5 text-[10px] focus:outline-none focus:border-blue-500" />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">ขนาดตัวอักษร: {config.titleFontSize ?? 11}px</label>
          <input type="range" min={9} max={24} value={config.titleFontSize ?? 11}
            onChange={e => setC({ titleFontSize: Number(e.target.value) })}
            className="w-full accent-blue-500 cursor-pointer" />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-slate-400">สีตัวอักษร</label>
          <Swatch value={config.titleColor ?? '#f1f5f9'} onChange={v => setC({ titleColor: v })} />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">ความหนา</label>
          <div className="flex gap-1.5">
            {(['normal', 'bold'] as const).map(w => {
              const currentWeight = config.titleFontWeight || 'bold'
              return (
                <button key={w} onClick={() => setC({ titleFontWeight: w })}
                  className={`flex-1 py-1 rounded text-[10px] transition-all cursor-pointer ${currentWeight === w ? 'bg-blue-600 text-white font-bold' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
                  style={{ fontWeight: w }}>
                  {w === 'normal' ? 'ปกติ' : 'หนา'}
                </button>
              )
            })}
          </div>
        </div>
      </CollapsibleSection>

      {/* 3. รายละเอียดข้อมูลแต่ละ Legend */}
      <CollapsibleSection title="3️⃣ รายละเอียดข้อมูล" defaultOpen={false}>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">ขนาดตัวอักษร: {config.labelFontSize ?? 10}px</label>
          <input type="range" min={7} max={16} value={config.labelFontSize ?? 10}
            onChange={e => setC({ labelFontSize: Number(e.target.value) })}
            className="w-full accent-blue-500 cursor-pointer" />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-slate-400">สีตัวอักษร</label>
          <Swatch value={config.labelColor ?? '#cbd5e1'} onChange={v => setC({ labelColor: v })} />
        </div>

        <hr className="border-slate-800" />
        
        <div className="space-y-2">
          <label className="text-[10px] font-semibold text-slate-400">แก้ไขข้อความแต่ละช่วง (เว้นว่างเพื่อใช้ค่าสถิติ)</label>
          {defaultLabels.map((lbl, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[9px] text-slate-500 w-4">{i + 1}.</span>
              <input 
                type="text" 
                value={config.customLabels?.[i] || ''}
                onChange={e => handleCustomLabelChange(i, e.target.value)}
                placeholder={lbl}
                className="flex-1 bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1 text-[10px] focus:outline-none focus:border-blue-500" 
              />
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* 4. พื้นหลังและขอบ */}
      <CollapsibleSection title="4️⃣ ตั้งค่าพื้นหลังและเส้นขอบ" defaultOpen={false}>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-slate-400">สีพื้นหลัง</label>
          <Swatch value={config.bgColor ?? '#0f172a'} onChange={v => setC({ bgColor: v })} />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">ความโปร่งใสพื้นหลัง: {Math.round((config.bgOpacity ?? 0.85) * 100)}%</label>
          <input type="range" min={0} max={100} value={Math.round((config.bgOpacity ?? 0.85) * 100)}
            onChange={e => setC({ bgOpacity: Number(e.target.value) / 100 })}
            className="w-full accent-blue-500 cursor-pointer" />
        </div>

        <hr className="border-slate-800" />

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-slate-400">สีเส้นขอบ</label>
          <Swatch value={config.borderColor ?? '#334155'} onChange={v => setC({ borderColor: v })} />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">ความหนาเส้นขอบ: {config.borderWidth ?? 1}px</label>
          <input type="range" min={0} max={10} value={config.borderWidth ?? 1}
            onChange={e => setC({ borderWidth: Number(e.target.value) })}
            className="w-full accent-blue-500 cursor-pointer" />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">ความโค้งมุม: {config.borderRadius ?? 12}px</label>
          <input type="range" min={0} max={32} value={config.borderRadius ?? 12}
            onChange={e => setC({ borderRadius: Number(e.target.value) })}
            className="w-full accent-blue-500 cursor-pointer" />
        </div>
      </CollapsibleSection>
    </div>
  )
}

