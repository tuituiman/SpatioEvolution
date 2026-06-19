import React, { useRef } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { LogoWidgetConfig } from '../../store/useAppStore'
import { UploadCloud, Trash2 } from 'lucide-react'

interface Props { widgetId: string }

export const LogoInspector: React.FC<Props> = ({ widgetId }) => {
  const { widgetConfigs, setWidgetConfig, logoUrl, setLogoUrl, notify } = useAppStore()
  const config = (widgetConfigs[widgetId] ?? {}) as LogoWidgetConfig
  const setC = (patch: Partial<LogoWidgetConfig>) => setWidgetConfig(widgetId, patch as any)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { notify('error', 'รองรับเฉพาะไฟล์รูปภาพ'); return }
    const reader = new FileReader()
    reader.onload = ev => { if (ev.target?.result) { setLogoUrl(ev.target.result as string); notify('success', 'อัปโหลดโลโก้เสร็จ!') } }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-4 text-xs">
      {/* Upload */}
      <div className="bg-slate-950/30 border border-slate-800 p-3 rounded-xl space-y-3">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">🖼️ รูปโลโก้</span>

        {logoUrl ? (
          <div className="space-y-2">
            <div className="w-full h-24 rounded-lg overflow-hidden bg-slate-900 border border-slate-700 flex items-center justify-center">
              <img src={logoUrl} alt="Logo preview"
                style={{ opacity: config.opacity ?? 1 }}
                className="w-full h-full object-contain" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => fileRef.current?.click()}
                className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-slate-300 hover:text-white text-[10px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all">
                <UploadCloud size={11} /> เปลี่ยนรูป
              </button>
              <button onClick={() => setLogoUrl(null)}
                className="py-1.5 px-3 bg-red-950/30 hover:bg-red-900/30 border border-red-900/50 rounded text-red-400 hover:text-red-300 text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-all">
                <Trash2 size={11} /> ลบ
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()}
            className="w-full py-6 border-2 border-dashed border-slate-700 hover:border-blue-500/60 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-blue-400 cursor-pointer transition-all">
            <UploadCloud size={20} />
            <span className="text-[10px] font-semibold">คลิกเพื่ออัปโหลดโลโก้</span>
            <span className="text-[9px] opacity-60">PNG, JPG, SVG, WebP</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
      </div>

      {/* Display Settings */}
      {logoUrl && (
        <>
          <div className="bg-slate-950/30 border border-slate-800 p-3 rounded-xl space-y-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">⚙️ การแสดงผล</span>


            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400">ความโปร่งใส: {Math.round((config.opacity ?? 1) * 100)}%</label>
              <input type="range" min={10} max={100} value={Math.round((config.opacity ?? 1) * 100)}
                onChange={e => setC({ opacity: Number(e.target.value) / 100 })}
                className="w-full accent-blue-500 cursor-pointer" />
            </div>
          </div>

          <div className="bg-slate-950/30 border border-slate-800 p-3 rounded-xl space-y-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">🔲 ขอบรูป (Border)</span>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400">ความโค้งมน: {config.borderRadius ?? 0}px</label>
              <input type="range" min={0} max={64} value={config.borderRadius ?? 0}
                onChange={e => setC({ borderRadius: Number(e.target.value) })}
                className="w-full accent-blue-500 cursor-pointer" />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400">ความหนาเส้นขอบ: {config.borderWidth ?? 0}px</label>
              <input type="range" min={0} max={12} value={config.borderWidth ?? 0}
                onChange={e => setC({ borderWidth: Number(e.target.value) })}
                className="w-full accent-blue-500 cursor-pointer" />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[10px] font-semibold text-slate-400">สีขอบ:</label>
              <input type="color" value={config.borderColor || '#334155'}
                onChange={e => setC({ borderColor: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent" />
            </div>
          </div>

        </>
      )}
    </div>
  )
}
