import React from 'react'
import { useAppStore } from '../../store/useAppStore'
import { MapInspector } from './MapInspector'
import { ChartInspector } from './ChartInspector'
import { TitleInspector } from './TitleInspector'
import { LegendInspector } from './LegendInspector'
import { LogoInspector } from './LogoInspector'
import { X, Layers, Trash2 } from 'lucide-react'

export const WidgetInspectorPanel: React.FC = () => {
  const {
    selectedWidgetId, setSelectedWidgetId,
    canvasWidgets, deleteCanvasWidget,
    notify,
    bringWidgetToFront, sendWidgetToBack,
    bringWidgetForward, sendWidgetBackward,
  } = useAppStore()

  const activeWidget = canvasWidgets.find(w => w.id === selectedWidgetId)

  const WIDGET_LABELS: Record<string, string> = {
    map: '🗺️ แผนที่สถิติ',
    chart: '📊 กราฟ Epi-Curve',
    title: '📝 กล่องหัวข้อ',
    legend: '🏷️ คำอธิบายสี',
    'logo': '🖼️ โลโก้หน่วยงาน',
  }

  if (!selectedWidgetId || !activeWidget) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 px-4 text-center">
        <span className="text-3xl opacity-40">🎯</span>
        <div>
          <h4 className="text-xs font-bold text-slate-300">ยังไม่ได้เลือก object</h4>
          <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
            คลิกที่ widget ใดบน canvas ด้านขวา<br />เพื่อเปิด inspector ตั้งค่าเฉพาะ object นั้น
          </p>
        </div>
      </div>
    )
  }

  const handleDelete = () => {
    deleteCanvasWidget(activeWidget.id)
    notify('info', `ลบ ${WIDGET_LABELS[activeWidget.type] || activeWidget.type} แล้ว`)
  }

  return (
    <div className="space-y-3 text-xs animate-fade-in">


      {/* Layer Order Controls */}
      <div className="bg-slate-950/30 border border-slate-800 p-2.5 rounded-xl">
        <div className="flex items-center gap-1 mb-2">
          <Layers size={10} className="text-slate-500" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">เลเยอร์</span>
          <span className="ml-auto text-[9px] text-slate-600 font-mono">z:{activeWidget.zIndex}</span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {([
            { label: 'หน้าสุด', action: () => bringWidgetToFront(activeWidget.id), icon: '⤴' },
            { label: 'ขึ้น', action: () => bringWidgetForward(activeWidget.id), icon: '↑' },
            { label: 'ลง', action: () => sendWidgetBackward(activeWidget.id), icon: '↓' },
            { label: 'หลังสุด', action: () => sendWidgetToBack(activeWidget.id), icon: '⤵' },
          ]).map(btn => (
            <button key={btn.label} onClick={btn.action}
              className="py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[10px] font-bold text-center cursor-pointer transition-all active:scale-95">
              <div>{btn.icon}</div>
              <div className="text-[8px] mt-0.5 opacity-70">{btn.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Inspector by type ── */}
      {activeWidget.type === 'map' && <MapInspector widgetId={activeWidget.id} />}
      {activeWidget.type === 'chart' && <ChartInspector widgetId={activeWidget.id} />}
      {activeWidget.type === 'title' && <TitleInspector widgetId={activeWidget.id} />}
      {activeWidget.type === 'legend' && <LegendInspector widgetId={activeWidget.id} />}
      {activeWidget.type === 'logo' && <LogoInspector widgetId={activeWidget.id} />}

      {/* Delete */}
      <div className="pt-1 border-t border-slate-800/60">
        <button onClick={handleDelete}
          className="w-full py-2 bg-red-950/20 hover:bg-red-900/30 border border-red-900/40 hover:border-red-700/60 rounded-lg text-red-400 hover:text-red-300 text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.99]">
          <Trash2 size={11} /> ลบ {WIDGET_LABELS[activeWidget.type] || 'Object'} นี้
        </button>
      </div>
    </div>
  )
}
