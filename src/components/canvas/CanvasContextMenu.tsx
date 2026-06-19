import React, { useEffect, useRef } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { Map, BarChart2, Type, List, Image as ImageIcon, Globe2 } from 'lucide-react'
import { useTranslation } from '../../hooks/useTranslation'

interface Props {
  x: number
  y: number
  onClose: () => void
}

export const CanvasContextMenu: React.FC<Props> = ({ x, y, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const { addCanvasWidget, notify } = useAppStore()
  const { language } = useTranslation()

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleAdd = (type: 'map' | 'chart' | 'title' | 'legend' | 'logo', label: string) => {
    addCanvasWidget(type)
    notify('success', language === 'th' ? `เพิ่ม ${label} แล้ว` : `Added ${label}`)
    onClose()
  }

  const menuItems = [
    { type: 'map' as const, icon: Map, label: 'แผนที่สถิติ (Main Map)' },
    { type: 'chart' as const, icon: BarChart2, label: 'กราฟ Epi-Curve' },
    { type: 'title' as const, icon: Type, label: 'กล่องหัวข้อ (Title)' },
    { type: 'legend' as const, icon: List, label: 'คำอธิบายสี (Legend)' },
    { type: 'logo' as const, icon: ImageIcon, label: 'โลโก้หน่วยงาน (Logo)' },

  ]

  // Prevent menu from going off-screen
  const safeX = Math.min(x, window.innerWidth - 250)
  const safeY = Math.min(y, window.innerHeight - 300)

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in"
      style={{ left: safeX, top: safeY }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700">
        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">เพิ่ม Object</span>
      </div>
      <div className="p-1.5 flex flex-col gap-0.5">
        {menuItems.map((item) => (
          <button
            key={item.type}
            onClick={() => handleAdd(item.type, item.label)}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-left text-sm font-medium text-slate-300 hover:text-white hover:bg-indigo-600 rounded-lg transition-colors cursor-pointer"
          >
            <item.icon size={16} className="opacity-70" />
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}
