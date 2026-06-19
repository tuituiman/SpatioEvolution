import { type PageId } from '../../App'
import { Upload, Bell } from 'lucide-react'

const PAGE_TITLES: Record<PageId, { th: string; en: string }> = {
  explorer:  { th: 'แผนที่เชิงพื้นที่', en: 'Map Explorer' },
  analysis:  { th: 'วิเคราะห์เชิงพื้นที่', en: 'Spatial Analysis' },
  export:    { th: 'ส่งออกผลลัพธ์',     en: 'Export Studio' },
  settings:  { th: 'การตั้งค่า',        en: 'Settings' },
}

interface TopBarProps {
  activePage: PageId
}

export function TopBar({ activePage }: TopBarProps) {
  const title = PAGE_TITLES[activePage]

  return (
    <header className="flex items-center justify-between px-5 py-3 border-b border-spatio-border bg-spatio-surface/50 shrink-0">
      {/* Page Title */}
      <div>
        <h1 className="text-base font-semibold text-spatio-text leading-tight">{title.th}</h1>
        <p className="text-xs text-spatio-muted">{title.en}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button className="spatio-btn-ghost text-xs gap-1.5 border border-spatio-border rounded-lg px-3 py-1.5">
          <Upload size={13} />
          <span className="hidden sm:inline">นำเข้าข้อมูล</span>
        </button>
        <button className="relative w-8 h-8 flex items-center justify-center rounded-lg text-spatio-muted hover:text-spatio-text hover:bg-white/5 transition-all">
          <Bell size={16} />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-spatio-primary to-spatio-secondary flex items-center justify-center text-white text-xs font-bold">
          U
        </div>
      </div>
    </header>
  )
}
