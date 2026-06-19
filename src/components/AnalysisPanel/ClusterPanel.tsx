/**
 * ClusterPanel.tsx — DBSCAN Spatial Clustering Tab
 * Extracted from Analysis.tsx for cleaner code organization
 */
import { Play, Eye, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'

function hslToHex(h: number, s: number, l: number): string {
  l /= 100
  const a = (s * Math.min(l, 1 - l)) / 100
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function getClusterHex(index: number, total: number): string {
  if (index < 0) return '#475569'
  const hue = (index * 360) / Math.max(1, total)
  return hslToHex(hue, 85, 55)
}

interface ClusterPanelProps {
  hasCoords: boolean
  eps: number
  onEpsChange: (v: number) => void
  minPts: number
  onMinPtsChange: (v: number) => void
  dbscanRes: any | null
  isDBSCANApplied: boolean
  isComputing?: boolean
  computeProgress?: number
  onRun: () => void
  onApplyToMap: () => void
  onResetFromMap: () => void
}

export function ClusterPanel({
  hasCoords, eps, onEpsChange, minPts, onMinPtsChange,
  dbscanRes, isDBSCANApplied, isComputing = false, computeProgress = 0,
  onRun, onApplyToMap, onResetFromMap
}: ClusterPanelProps) {
  return (
    <div className="spatio-card p-6 border border-slate-800 space-y-6 bg-slate-900/10 shadow-2xl rounded-2xl">
      <div className="flex justify-between items-center border-b border-slate-850 pb-4">
        <div className="space-y-1">
          <h3 className="text-sm font-black text-white">การวิเคราะห์กลุ่มก้อนความหนาแน่นจุดระบาด (DBSCAN Clustering)</h3>
          <p className="text-[10px] text-slate-450">ค้นหากลุ่มก้อนการระบาดหนาแน่นตามพิกัดจุดละติจูด/ลองจิจูดจริงโดยไม่สนใจขอบเขตของอำเภอ</p>
        </div>
        <span className="spatio-badge bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] uppercase font-black tracking-wider">
          จุดพิกัดจริง (Coordinate Mode)
        </span>
      </div>

      {!hasCoords ? (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-300 text-xs flex gap-3 leading-relaxed">
          <AlertCircle className="shrink-0 mt-0.5" size={16} />
          <div>
            <span className="font-bold block">ฟีเจอร์นี้ล็อกอยู่ (Feature Locked)</span>
            ข้อมูลปัจจุบันถูกอัปโหลดมาในลักษณะสรุปยอดรายเขตการปกครอง ซึ่งไม่มีพิกัดละติจูด/ลองจิจูดรายจุด
            กรุณานำเข้าไฟล์ในรูปแบบที่ 3 หรือ 4 (จุดพิกัดจริง) ในการเรียกคำนวณการวิเคราะห์กลุ่มก้อนจุดนี้
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Parameter Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 border border-slate-850 p-4 rounded-xl bg-slate-950/20">
              <label className="text-[11px] font-bold text-slate-300 block">ระยะห่างสูงสุดในการเชื่อมกลุ่ม (Epsilon - Eps):</label>
              <div className="flex items-center gap-4 mt-2">
                <input type="range" min={5} max={150} value={eps} onChange={e => onEpsChange(Number(e.target.value))}
                  className="flex-1 accent-emerald-500 cursor-pointer" />
                <span className="text-xs font-mono font-bold bg-slate-800 text-emerald-400 border border-slate-700 px-2.5 py-1 rounded">
                  {eps} km
                </span>
              </div>
              <span className="text-[9px] text-slate-500 block leading-tight mt-1.5">
                * พิกัดจุดระบาดที่มีระยะทาง (Haversine) ห่างกันไม่เกินระยะทางนี้จะถูกมองว่าเป็นกลุ่มกระจุกตัวเดียวกัน
              </span>
            </div>

            <div className="space-y-2 border border-slate-850 p-4 rounded-xl bg-slate-950/20 flex flex-col justify-between">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block">จำนวนเคสขั้นต่ำในจุดกระจุกตัว (MinPts):</label>
                <div className="flex items-center gap-4 mt-2">
                  <input type="range" min={2} max={30} value={minPts} onChange={e => onMinPtsChange(Number(e.target.value))}
                    className="flex-1 accent-emerald-500 cursor-pointer" />
                  <span className="text-xs font-mono font-bold bg-slate-800 text-emerald-400 border border-slate-700 px-2.5 py-1 rounded">
                    {minPts} เคส
                  </span>
                </div>
              </div>

              {isComputing ? (
                <div className="w-full mt-3 space-y-2">
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${computeProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-emerald-400 text-center">กำลังคำนวณ DBSCAN... {computeProgress}%</p>
                </div>
              ) : (
                <button
                  onClick={onRun}
                  className="w-full mt-3 py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:opacity-95 text-white text-xs font-bold transition-all shadow-md active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer shadow-emerald-950/20"
                >
                  <Play size={12} />
                  <span>ประมวลผล DBSCAN Clustering (Background)</span>
                </button>
              )}
            </div>
          </div>

          {/* Results */}
          {dbscanRes && (
            <div className="space-y-6 border-t border-slate-850 pt-6 animate-fade-in">
              <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl flex items-center gap-4 shadow-inner">
                <span className="text-3xl">🧬</span>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase leading-none">สรุปสถิติผลลัพธ์กลุ่มก้อนโรค:</span>
                  <span className="text-base font-black block">
                    พบกลุ่มก้อนการแพร่กระจายตัวแบบกระจุกตัวเด่นชัดทั้งหมด <span className="text-emerald-400">{dbscanRes.numClusters} กลุ่มคลัสเตอร์</span>
                  </span>
                  <p className="text-[10px] text-slate-450 leading-relaxed">
                    จากการวิเคราะห์จุดพิกัดทั้งหมด {dbscanRes.points?.length?.toLocaleString() ?? 0} จุด
                    มีจุดที่อยู่ในกลุ่มเสี่ยง {((dbscanRes.points?.length ?? 0) - dbscanRes.noiseCount).toLocaleString()} เคส
                    และมีจุดเดี่ยวนอกกลุ่ม {dbscanRes.noiseCount} เคส
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-400 animate-bounce" />
                  <span>แผนภูมิจำแนกสีและขนาดคลัสเตอร์:</span>
                </span>
                <div className="flex gap-2">
                  {!isDBSCANApplied ? (
                    <button onClick={onApplyToMap} className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 shadow transition-all active:scale-95 cursor-pointer">
                      <Eye size={12} /><span>ลงสีกราฟคลัสเตอร์บนแผนที่</span>
                    </button>
                  ) : (
                    <button onClick={onResetFromMap} className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer">
                      <Trash2 size={12} /><span>คืนค่าจุดสีปกติ</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {dbscanRes.clusterSizes.map((size: number, idx: number) => {
                  const hexColor = getClusterHex(idx, dbscanRes.numClusters)
                  return (
                    <div key={idx} className="bg-slate-950/20 border border-slate-850 p-4 rounded-xl flex items-center justify-between gap-3 shadow">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3.5 h-3.5 rounded-full border border-white/20 block shrink-0" style={{ backgroundColor: hexColor }} />
                        <div>
                          <span className="text-xs font-black text-white block">Cluster #{idx + 1}</span>
                          <span className="text-[9px] text-slate-500 block mt-0.5">กลุ่มระบาดเฉพาะกิจ</span>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        {size} เคส
                      </span>
                    </div>
                  )
                })}
                {dbscanRes.numClusters === 0 && (
                  <div className="sm:col-span-3 text-center py-6 text-slate-500 text-xs">
                    — ไม่พบกลุ่มกระจุกตัวที่เข้าเกณฑ์เลย (โปรดลดค่า MinPts หรือขยาย Eps ขึ้น) —
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
