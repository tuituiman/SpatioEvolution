import React, { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { LegendWidgetConfig } from '../../store/useAppStore'
import { getNextStartValue, getDecimalPlaces, COLOR_PALETTES } from '../../map/mapController'

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
  const { widgetConfigs, setWidgetConfig, globalBreaks, breaksStart, colorMode, palette, customColors } = useAppStore()
  const config = (widgetConfigs[widgetId] ?? {}) as LegendWidgetConfig
  const setC = (patch: Partial<LegendWidgetConfig>) => setWidgetConfig(widgetId, patch as any)

  const defaultBands = useMemo(() => {
    const colors = (palette === 'Custom' && customColors && customColors.length > 0)
      ? customColors
      : (COLOR_PALETTES[palette] ?? COLOR_PALETTES.YlOrRd)

    const allValues: number[] = [breaksStart]
    globalBreaks.forEach((b, i) => {
      allValues.push(b)
      if (i > 0) {
        allValues.push(getNextStartValue(globalBreaks[i - 1]))
      }
    })
    const maxDec = allValues.length > 0 ? Math.max(...allValues.map(getDecimalPlaces), 0) : 0

    const list = globalBreaks.map((b, i) => {
      const startVal = i === 0 ? breaksStart : getNextStartValue(globalBreaks[i - 1])
      return {
        color: colors[i] ?? colors[colors.length - 1] ?? '#ccc',
        label: `${startVal.toLocaleString(undefined, { minimumFractionDigits: maxDec, maximumFractionDigits: maxDec })} – ${b.toLocaleString(undefined, { minimumFractionDigits: maxDec, maximumFractionDigits: maxDec })}`
      }
    })
    if (globalBreaks.length > 0) {
      list.push({
        color: colors[globalBreaks.length] ?? colors[colors.length - 1] ?? '#ccc',
        label: `> ${globalBreaks[globalBreaks.length - 1].toLocaleString(undefined, { minimumFractionDigits: maxDec, maximumFractionDigits: maxDec })}`
      })
    }
    return list
  }, [globalBreaks, breaksStart, palette, customColors])

  const defaultLabels = useMemo(() => {
    return defaultBands.map(b => b.label)
  }, [defaultBands])

  const handleCustomLabelChange = (index: number, val: string) => {
    setC({
      customLabels: {
        ...(config.customLabels || {}),
        [index]: val
      }
    })
  }

  const handleCustomize = () => {
    let initialBands: Array<{ color: string; label: string }> = []
    if (colorMode !== 'custom' && defaultBands.length > 0) {
      initialBands = defaultBands.map((b, i) => ({
        color: b.color,
        label: config.customLabels?.[i] || b.label
      }))
    } else {
      initialBands = [
        { color: '#22c55e', label: 'ช่วงความเสี่ยงต่ำ' },
        { color: '#fbbf24', label: 'ช่วงความเสี่ยงปานกลาง' },
        { color: '#ef4444', label: 'ช่วงความเสี่ยงสูง' }
      ]
    }
    setC({ customBands: initialBands })
  }

  const handleRevert = () => {
    setC({ customBands: undefined })
  }

  const handleCustomBandColorChange = (index: number, newColor: string) => {
    if (!config.customBands) return
    const updated = [...config.customBands]
    updated[index] = { ...updated[index], color: newColor }
    setC({ customBands: updated })
  }

  const handleCustomBandLabelChange = (index: number, newLabel: string) => {
    if (!config.customBands) return
    const updated = [...config.customBands]
    updated[index] = { ...updated[index], label: newLabel }
    setC({ customBands: updated })
  }

  const handleCustomBandDelete = (index: number) => {
    if (!config.customBands) return
    const updated = config.customBands.filter((_, idx) => idx !== index)
    setC({ customBands: updated })
  }

  const handleCustomBandAdd = () => {
    const defaultColor = COLOR_PRESETS[0] || '#ffffff'
    const newBand = { color: defaultColor, label: `ช่วงข้อมูลใหม่` }
    const updated = [...(config.customBands || []), newBand]
    setC({ customBands: updated })
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
        
        {config.customBands ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold text-slate-400">แก้ไขช่วงสัญลักษณ์และสีเอง</label>
              <button
                onClick={handleRevert}
                className="px-2 py-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-blue-400 rounded text-[9px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                title="ยกเลิกการปรับแต่งเองและกลับไปซิงก์ข้อมูลอัตโนมัติ"
              >
                🔄 ซิงก์ค่ากับแผนที่
              </button>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {config.customBands.map((b, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-900/30 p-1.5 rounded border border-slate-800/40">
                  <span className="text-[9px] text-slate-500 w-3">{i + 1}.</span>
                  <input
                    type="color"
                    value={b.color}
                    onChange={e => handleCustomBandColorChange(i, e.target.value)}
                    className="w-6 h-5 rounded cursor-pointer border-0 bg-transparent shrink-0"
                    title="เลือกสี"
                  />
                  <input 
                    type="text" 
                    value={b.label}
                    onChange={e => handleCustomBandLabelChange(i, e.target.value)}
                    placeholder="พิมพ์ชื่อช่วง..."
                    className="flex-1 bg-slate-950 border border-slate-800/80 text-slate-200 rounded px-2 py-1 text-[10px] focus:outline-none focus:border-blue-500" 
                  />
                  <button
                    onClick={() => handleCustomBandDelete(i)}
                    className="p-1 hover:bg-red-600/20 text-slate-500 hover:text-red-500 rounded transition-colors cursor-pointer"
                    title="ลบช่วงสีนี้"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={handleCustomBandAdd}
              className="w-full py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-300 rounded text-[10px] font-semibold transition-all cursor-pointer text-center block active:scale-98"
            >
              ➕ เพิ่มช่วงสีสัญลักษณ์
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold text-slate-400">
                {colorMode === 'custom' ? 'สีกำหนดเองตามคอลัมน์สี' : 'ช่วงข้อมูลอัตโนมัติจากสถิติ'}
              </label>
              <button
                onClick={handleCustomize}
                className="px-2 py-1 bg-blue-600/90 hover:bg-blue-500 text-white rounded text-[9px] font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                ✏️ กำหนดช่วงและสีเอง
              </button>
            </div>

            {colorMode === 'custom' ? (
              <p className="text-[9px] text-slate-500 italic bg-slate-900/25 p-2 rounded border border-slate-800/40">
                ขณะนี้แผนที่แสดงสีกำหนดเองจากคอลัมน์ของตารางข้อมูล หากต้องการจัดทำคำอธิบายสีเองสำหรับออกรายงาน ให้กดปุ่มด้านบนได้เลยครับ
              </p>
            ) : (
              <div className="space-y-2">
                <label className="text-[9px] text-slate-500 block">แก้ไขเฉพาะคำอธิบายช่วง (เว้นว่างเพื่อใช้ค่าสถิติอัตโนมัติ):</label>
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
            )}
          </div>
        )}
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

