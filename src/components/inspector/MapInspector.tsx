import React, { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { MapWidgetConfig } from '../../store/useAppStore'
import { Map, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'
import { fitToScope, getMap } from '../../map/mapController'

interface Props { widgetId: string }

const COLOR_PRESETS = ['#ffffff', '#ffeb3b', '#f97316', '#22c55e', '#06b6d4', '#a855f7', '#f43f5e']
const STYLE_COLOR_PRESETS = ['#ffffff', '#f1f5f9', '#94a3b8', '#0f172a', '#ffeb3b', '#f97316', '#22c55e', '#06b6d4', '#a855f7', '#f43f5e']

const Swatch: React.FC<{ value: string; onChange: (v: string) => void; presets?: string[] }> = ({ value, onChange, presets = STYLE_COLOR_PRESETS }) => (
  <div className="flex gap-1.5 flex-wrap items-center">
    {presets.map(c => (
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
        className="w-full flex items-center justify-between p-3 bg-slate-900/50 hover:bg-slate-800/50 transition-colors cursor-pointer text-left"
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

export const MapInspector: React.FC<Props> = ({ widgetId }) => {
  const {
    widgetConfigs, setWidgetConfig,
    mapLabelSource, setMapLabelSource,
    mapLabelLimit, setMapLabelLimit,
    mapLabelThreshold, setMapLabelThreshold,
    mapLabelNameLevel, setMapLabelNameLevel,
    globalLabelStyle, updateGlobalLabelStyle,
    showLocationPrefix, setShowLocationPrefix,
  } = useAppStore()

  const config = (widgetConfigs[widgetId] ?? {}) as MapWidgetConfig
  const setC = (patch: Partial<MapWidgetConfig>) => setWidgetConfig(widgetId, patch as any)

  const handleAutoFit = () => {
    const scope = useAppStore.getState().scope
    const map = getMap()
    if (map) {
      map.invalidateSize()
      setTimeout(() => {
        fitToScope(scope.province, scope.district, scope.subdistrict, scope.region)
      }, 100)
    }
  }

  return (
    <div className="space-y-4 text-xs">
      {/* ── Map Layout & Interaction Controls (Option 2, 3, 4) ── */}
      <CollapsibleSection title="⚙️ การจัดวางและจัดสัดส่วน" defaultOpen={true}>
        {/* Lock Map Interaction */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
          <div className="space-y-0.5 pr-2">
            <span className="text-[10px] font-semibold text-slate-400 block">🔒 ล็อกโหมดเลื่อน/ซูมแผนที่</span>
            <span className="text-[8px] text-slate-500 block">
              {config.isLocked ?? true
                ? 'ล็อกอยู่: ซูม/เลื่อนแผนที่ด้านในได้ปกติ'
                : 'ปลดล็อก: คลิกพื้นที่แผนที่เพื่อลาก/ย่อขยายวัตถุ'}
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input type="checkbox" checked={config.isLocked ?? true}
              onChange={e => setC({ isLocked: e.target.checked })} className="sr-only peer" />
            <div className="w-8 h-4 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-500 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white" />
          </label>
        </div>

        {/* Lock Aspect Ratio */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
          <div className="space-y-0.5 pr-2">
            <span className="text-[10px] font-semibold text-slate-400 block">📐 ล็อกอัตราส่วน กว้าง-ยาว</span>
            <span className="text-[8px] text-slate-500 block">รักษาสัดส่วนกรอบแผนที่ไม่ให้เบี้ยวขณะปรับขนาด</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input type="checkbox" checked={config.lockAspectRatio ?? false}
              onChange={e => setC({ lockAspectRatio: e.target.checked })} className="sr-only peer" />
            <div className="w-8 h-4 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-500 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white" />
          </label>
        </div>

        {/* Auto Fit Scope Viewport */}
        <div className="space-y-1.5 pt-1">
          <label className="text-[10px] font-semibold text-slate-400 block">🎯 ซูมกึ่งกลางพื้นที่วิเคราะห์</label>
          <button
            onClick={handleAutoFit}
            className="w-full py-2 bg-blue-950/40 hover:bg-blue-900/60 border border-blue-800/50 hover:border-blue-600/70 rounded-lg text-blue-400 hover:text-blue-300 text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
            title="ซูมและจัดกึ่งกลางแผนที่ให้พอดีกับ Scope พื้นที่ที่กำลังเลือกวิเคราะห์อยู่"
          >
            จัดแผนที่ให้พอดีขอบเขตวิเคราะห์
          </button>
        </div>
      </CollapsibleSection>

      {/* ── Label Settings (export-specific overrides) ── */}
      <CollapsibleSection title="🏷️ ป้ายกำกับบนแผนที่" defaultOpen={false}>
        {/* Label Source */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">แสดงป้าย</label>
          <select value={mapLabelSource} onChange={e => setMapLabelSource(e.target.value as any)}
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1 text-[10px] cursor-pointer focus:outline-none">
            <option value="none">ไม่แสดง</option>
            <option value="name">ชื่อพื้นที่</option>
            <option value="value">ค่าสถิติ</option>
            <option value="name-value">ชื่อ + ค่าสถิติ</option>
          </select>
        </div>

        {/* Label font size */}
        {mapLabelSource !== 'none' && (
          <>
            {/* Label Name Level Override */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400">ระดับชื่อพื้นที่บนป้าย</label>
              <select value={mapLabelNameLevel} onChange={e => setMapLabelNameLevel(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1 text-[10px] cursor-pointer focus:outline-none">
                <option value="default">ตามระดับแผนที่ (Default)</option>
                <option value="district">ระดับอำเภอ (District)</option>
                <option value="province">ระดับจังหวัด (Province)</option>
              </select>
            </div>
            {/* Label Density Limit */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400">การจำกัดป้ายกำกับ</label>
              <select value={mapLabelLimit} onChange={e => setMapLabelLimit(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1 text-[10px] cursor-pointer focus:outline-none">
                <option value="all">แสดงทั้งหมด</option>
                <option value="top-5">แสดงเฉพาะ Top 5</option>
                <option value="top-10">แสดงเฉพาะ Top 10</option>
                <option value="top-20">แสดงเฉพาะ Top 20</option>
                <option value="threshold">กำหนดเกณฑ์ขั้นต่ำ</option>
              </select>
            </div>

            {/* Threshold Input */}
            {mapLabelLimit === 'threshold' && (
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400">เกณฑ์กรณีขั้นต่ำ (ราย)</label>
                <input
                  type="number"
                  min={0}
                  value={mapLabelThreshold}
                  onChange={e => setMapLabelThreshold(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1 text-[10px] focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400">ขนาดตัวอักษร: {globalLabelStyle.fontSize}px</label>
              <input type="range" min={7} max={18} value={globalLabelStyle.fontSize}
                onChange={e => updateGlobalLabelStyle({ fontSize: Number(e.target.value) })}
                className="w-full accent-blue-500 cursor-pointer" />
            </div>

            {/* Label color */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-400">สีตัวอักษร</label>
              <Swatch value={globalLabelStyle.color} onChange={v => updateGlobalLabelStyle({ color: v })} presets={COLOR_PRESETS} />
            </div>

            {/* Text Outline Thickness */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400">ความหนาเส้นขอบอักษร: {globalLabelStyle.textStrokeWidth ?? 1.5}px</label>
              <input type="range" min={0} max={4} step={0.5} value={globalLabelStyle.textStrokeWidth ?? 1.5}
                onChange={e => updateGlobalLabelStyle({ textStrokeWidth: Number(e.target.value) })}
                className="w-full accent-blue-500 cursor-pointer" />
            </div>

            {/* Text Outline Color */}
            <div className="space-y-1.5 pb-2 border-b border-slate-800/40">
              <label className="text-[10px] font-semibold text-slate-400">สีเส้นขอบอักษร</label>
              <Swatch value={globalLabelStyle.textStrokeColor ?? '#000000'} onChange={v => updateGlobalLabelStyle({ textStrokeColor: v })} presets={['#000000', ...COLOR_PRESETS]} />
            </div>

            {/* Show Location Prefix */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
              <div className="space-y-0.5 pr-2">
                <span className="text-[10px] font-semibold text-slate-400 block">🏷️ แสดงคำนำหน้าพื้นที่</span>
                <span className="text-[8px] text-slate-500 block">เช่น "จังหวัดลำปาง" / "เมืองลำปาง"</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input type="checkbox" checked={showLocationPrefix}
                  onChange={e => setShowLocationPrefix(e.target.checked)} className="sr-only peer" />
                <div className="w-8 h-4 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-500 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white" />
              </label>
            </div>

            {/* Show callouts */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400">เส้นชี้เป้า (Callout)</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={config.showLabelCallouts ?? true}
                  onChange={e => setC({ showLabelCallouts: e.target.checked })} className="sr-only peer" />
                <div className="w-8 h-4 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-500 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white" />
              </label>
            </div>
          </>
        )}
      </CollapsibleSection>

      {/* ── Box Card Styling for Map Widget ── */}
      <CollapsibleSection title="📦 กรอบและรูปเล่มแผนที่" defaultOpen={false}>

        {/* Border Radius */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">มุมโค้งกรอบแผนที่: {config.borderRadius ?? 12}px</label>
          <input type="range" min={0} max={36} value={config.borderRadius ?? 12}
            onChange={e => setC({ borderRadius: Number(e.target.value) })}
            className="w-full accent-blue-500 cursor-pointer" />
        </div>

        {/* Border Width */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">ความหนาเส้นขอบ: {config.borderWidth ?? 0}px</label>
          <input type="range" min={0} max={6} value={config.borderWidth ?? 0}
            onChange={e => setC({ borderWidth: Number(e.target.value) })}
            className="w-full accent-blue-500 cursor-pointer" />
        </div>

        {/* Border Color */}
        {(config.borderWidth ?? 0) > 0 && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-400">สีเส้นขอบ</label>
            <Swatch value={config.borderColor ?? '#334155'} onChange={v => setC({ borderColor: v })} />
          </div>
        )}

        {/* Box Shadow */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">มิติและเงา (Shadow)</label>
          <select value={config.boxShadow ?? 'none'} onChange={e => setC({ boxShadow: e.target.value as any })}
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1.5 text-[10px] cursor-pointer focus:outline-none">
            <option value="none">ไม่มี (None)</option>
            <option value="sm">บางเบา (Small)</option>
            <option value="md">ปานกลาง (Medium)</option>
            <option value="lg">เด่นชัด (Large)</option>
            <option value="xl">เด่นชัดพิเศษ (Extra Large)</option>
          </select>
        </div>
      </CollapsibleSection>
    </div>
  )
}
