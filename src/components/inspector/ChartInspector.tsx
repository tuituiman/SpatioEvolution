import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { ChartWidgetConfig } from '../../store/useAppStore'

interface Props { widgetId: string }

const COLOR_PRESETS = ['#3b82f6', '#f59e0b', '#ef4444', '#22c55e', '#a855f7', '#06b6d4', '#f97316', '#ffffff']

const Swatch: React.FC<{ value: string; onChange: (v: string) => void; label: string }> = ({ value, onChange, label }) => (
  <div className="space-y-1">
    <label className="text-[10px] font-semibold text-slate-400">{label}</label>
    <div className="flex gap-1.5 flex-wrap items-center">
      {COLOR_PRESETS.map(c => (
        <button key={c} onClick={() => onChange(c)}
          style={{ backgroundColor: c }}
          className={`w-5 h-5 rounded cursor-pointer border-2 transition-all ${value === c ? 'border-blue-400 scale-110' : 'border-transparent hover:scale-105'}`} />
      ))}
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent" title="เลือกสีเอง" />
    </div>
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

export const ChartInspector: React.FC<Props> = ({ widgetId }) => {
  const { widgetConfigs, setWidgetConfig, groupingMode, rawRows } = useAppStore()
  const config = (widgetConfigs[widgetId] ?? {}) as ChartWidgetConfig
  const setC = (patch: Partial<ChartWidgetConfig>) => setWidgetConfig(widgetId, patch as any)

  const hasData = rawRows.length > 0

  return (
    <div className="space-y-4 text-xs">
      {/* 1. Chart Style & Colors */}
      <CollapsibleSection title="📊 รูปแบบและสีของกราฟ" defaultOpen={true}>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">ประเภทกราฟ</label>
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { id: 'bar', label: '📊 แท่ง' },
              { id: 'line', label: '📈 เส้น' },
              { id: 'area', label: '🏔 พื้นที่' },
            ] as const).map(opt => (
              <button key={opt.id} onClick={() => setC({ chartType: opt.id })}
                className={`py-2 rounded text-[10px] font-bold transition-all cursor-pointer ${config.chartType === opt.id ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <hr className="border-slate-800" />
        <Swatch value={config.barColor ?? '#3b82f6'} onChange={v => setC({ barColor: v })} label="สีแท่ง/เส้นหลัก" />
        <Swatch value={config.barActiveColor ?? '#f59e0b'} onChange={v => setC({ barActiveColor: v })} label="สีช่วงเวลาที่เลือก" />
        <Swatch value={config.peakColor ?? '#ef4444'} onChange={v => setC({ peakColor: v })} label="สีจุดสูงสุด (Peak)" />
        <Swatch value={config.gridColor ?? ''} onChange={v => setC({ gridColor: v })} label="สีเส้น Grid" />

        <hr className="border-slate-800" />
        <div className="space-y-2.5">
          {([
            { key: 'showGrid', label: 'Grid Lines', emoji: '📏' },
            { key: 'showMaxMarker', label: 'จุดสูงสุด (MAX)', emoji: '🔺' },
            { key: 'showNowMarker', label: 'เวลาปัจจุบัน (NOW)', emoji: '📍' },
          ] as const).map(item => (
            <div key={item.key} className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400">{item.emoji} {item.label}</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox"
                  checked={(config[item.key] as boolean) ?? true}
                  onChange={e => setC({ [item.key]: e.target.checked } as any)}
                  className="sr-only peer" />
                <div className="w-8 h-4 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-500 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white" />
              </label>
            </div>
          ))}
        </div>

        {/* Global Grouping Mode info */}
        <div className="text-[9px] text-slate-500 bg-slate-900/60 rounded p-2 space-y-0.5 mt-2">
          <div>🗓 การจัดกลุ่ม: <span className="text-slate-300">{
            groupingMode === 'daily' ? 'รายวัน' :
              groupingMode === 'weekly' ? 'รายสัปดาห์ (ISO)' :
                groupingMode === 'weekly_epi' ? 'รายสัปดาห์ (EPI)' :
                  groupingMode === 'monthly' ? 'รายเดือน' :
                    groupingMode === 'quarterly' ? 'รายไตรมาส' :
                      groupingMode === 'quarterly_fiscal' ? 'รายไตรมาส (ปีงบประมาณ)' :
                        groupingMode === 'yearly_fiscal' ? 'รายปีงบประมาณ' : 'รายปี'
          }</span></div>
          <div className="opacity-60">→ เปลี่ยนได้จากหน้า Explorer</div>
        </div>
      </CollapsibleSection>

      {/* 2. Background & Box */}
      <CollapsibleSection title="🖼️ พื้นหลังและกรอบกราฟ" defaultOpen={false}>
        <Swatch value={config.bgColor ?? 'transparent'} onChange={v => setC({ bgColor: v })} label="สีพื้นหลัง (Background)" />
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">ความโปร่งใสพื้นหลัง: {config.bgOpacity ?? 1}</label>
          <input type="range" min={0} max={1} step={0.1} value={config.bgOpacity ?? 1}
            onChange={e => setC({ bgOpacity: Number(e.target.value) })}
            className="w-full accent-blue-500 cursor-pointer" />
        </div>

        <hr className="border-slate-800" />
        <Swatch value={config.borderColor ?? 'transparent'} onChange={v => setC({ borderColor: v })} label="สีเส้นขอบ (Border)" />
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">ความหนาเส้นขอบ: {config.borderWidth ?? 0}px</label>
          <input type="range" min={0} max={10} value={config.borderWidth ?? 0}
            onChange={e => setC({ borderWidth: Number(e.target.value) })}
            className="w-full accent-blue-500 cursor-pointer" />
        </div>
      </CollapsibleSection>

      {/* 3. Chart Title */}
      <CollapsibleSection title="📝 ชื่อแผนภูมิ" defaultOpen={false}>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">ชื่อแผนภูมิ (ตรงกลางบน)</label>
          <input type="text" value={config.chartTitle ?? ''}
            onChange={e => setC({ chartTitle: e.target.value })}
            placeholder="เช่น สถานการณ์โรค..."
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1.5 text-[10px] focus:outline-none focus:border-blue-500" />
        </div>

        {config.chartTitle && (
          <div className="space-y-3 pt-2">
            <Swatch value={config.chartTitleColor ?? ''} onChange={v => setC({ chartTitleColor: v })} label="สีชื่อแผนภูมิ" />
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400">ขนาดตัวอักษรชื่อ: {config.chartTitleFontSize ?? 11}px</label>
              <input type="range" min={8} max={24} value={config.chartTitleFontSize ?? 11}
                onChange={e => setC({ chartTitleFontSize: Number(e.target.value) })}
                className="w-full accent-blue-500 cursor-pointer" />
            </div>

            <hr className="border-slate-800" />
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400">ระยะขอบบน (Padding Top): {config.paddingTop ?? 35}px</label>
              <input type="range" min={10} max={100} value={config.paddingTop ?? 35}
                onChange={e => setC({ paddingTop: Number(e.target.value) })}
                className="w-full accent-indigo-500 cursor-pointer" />
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* 4. Axes & Labels */}
      <CollapsibleSection title="📐 แกนและป้ายกำกับ" defaultOpen={false}>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">ชื่อแกน Y (จำนวน)</label>
          <input type="text" value={config.yAxisLabel ?? 'จำนวนราย'}
            onChange={e => setC({ yAxisLabel: e.target.value })}
            placeholder="เช่น จำนวนราย, ผู้ป่วย..."
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1.5 text-[10px] focus:outline-none focus:border-blue-500" />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">ชื่อแกน X (เวลา)</label>
          <input type="text" value={config.xAxisLabel ?? ''}
            onChange={e => setC({ xAxisLabel: e.target.value })}
            placeholder="เช่น ช่วงเวลา, สัปดาห์..."
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1.5 text-[10px] focus:outline-none focus:border-blue-500" />
        </div>

        <hr className="border-slate-800 my-2" />

        <Swatch value={config.textColor ?? ''} onChange={v => setC({ textColor: v })} label="สีตัวอักษร (Text Color)" />

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">ขนาดตัวอักษรแกน: {config.fontSize ?? 9}px</label>
          <input type="range" min={7} max={16} value={config.fontSize ?? 9}
            onChange={e => setC({ fontSize: Number(e.target.value) })}
            className="w-full accent-blue-500 cursor-pointer" />
        </div>

        <hr className="border-slate-800 my-2" />

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">ระยะขอบซ้าย (Padding Left): {config.paddingLeft ?? 60}px</label>
          <input type="range" min={20} max={150} value={config.paddingLeft ?? 60}
            onChange={e => setC({ paddingLeft: Number(e.target.value) })}
            className="w-full accent-indigo-500 cursor-pointer" />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">ระยะขอบล่าง (Padding Bottom): {config.paddingBottom ?? 80}px</label>
          <input type="range" min={20} max={150} value={config.paddingBottom ?? 80}
            onChange={e => setC({ paddingBottom: Number(e.target.value) })}
            className="w-full accent-indigo-500 cursor-pointer" />
        </div>
      </CollapsibleSection>

      {!hasData && (
        <p className="text-[10px] text-amber-400 text-center py-2">⚠️ ยังไม่มีข้อมูล — import ข้อมูลก่อนจากหน้า Explorer</p>
      )}
    </div>
  )
}
