import { useState, useEffect } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { Explorer }    from './pages/Explorer'
import { Analysis }    from './pages/Analysis'
import { ExportStudio } from './pages/ExportStudio'
import { Settings }    from './pages/Settings'
import { locationResolver } from './data/locationResolver'
import { useAppStore } from './store/useAppStore'

export type PageId = 'explorer' | 'analysis' | 'export' | 'settings'

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('explorer')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const hydrateFromDB = useAppStore(s => s.hydrateFromDB)
  const theme = useAppStore(s => s.theme)

  useEffect(() => {
    // โหลดข้อมูลพื้นที่จิ๋ว (จังหวัด/อำเภอ/ตำบล) ทันทีที่เข้าแอป
    locationResolver.init()
    ;(window as any).setActivePage = setActivePage

    // Restore ข้อมูลจาก IndexedDB (ป้องกันข้อมูลหายเมื่อ refresh)
    hydrateFromDB()

    // รับ event จาก persistence.ts เมื่อ storage quota เต็ม
    const handleStorageQuota = (e: Event) => {
      const detail = (e as CustomEvent).detail
      useAppStore.getState().notify('error', detail?.message || '⚠️ พื้นที่จัดเก็บข้อมูลเต็ม')
    }
    window.addEventListener('spatio:storage-quota', handleStorageQuota)
    return () => window.removeEventListener('spatio:storage-quota', handleStorageQuota)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else if (theme === 'light') {
      root.classList.remove('dark')
    } else {
      // System
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }, [theme])

  return (
    <div className="flex h-full w-full bg-spatio-bg overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(p => !p)}
      />

      {/* Main Content Area — ไม่มี TopBar */}
      <main className="flex-1 overflow-hidden relative min-w-0">
        {/* Keep Explorer mounted for export so that map can be captured */}
        {(activePage === 'explorer' || activePage === 'export') && (
          <div className="w-full h-full relative">
            <Explorer isExportMode={activePage === 'export'} />
            {activePage === 'export' && <ExportStudio />}
          </div>
        )}
        {activePage === 'analysis' && <Analysis />}
        {activePage === 'settings' && <Settings />}
      </main>
    </div>
  )
}
