/**
 * DriftPanel.tsx — Spatiotemporal Centroid Drift Tab
 * Extracted from Analysis.tsx for cleaner code organization
 */
import { Play, Activity } from 'lucide-react'
import { clsx } from 'clsx'

interface DriftPanelProps {
  driftRes: any | null
  onRun: () => void
}

export function DriftPanel({ driftRes, onRun }: DriftPanelProps) {
  return (
    <div className="spatio-card p-6 border border-slate-800 space-y-6 bg-slate-900/10 shadow-2xl rounded-2xl animate-fade-in">
      <div className="flex justify-between items-center border-b border-slate-850 pb-4">
        <div className="space-y-1">
          <h3 className="text-sm font-black text-white">วิเคราะห์การเคลื่อนตัวหลั่งไหลของโรคตามมิติเวลา (Spatiotemporal Centroid Drift)</h3>
          <p className="text-[10px] text-slate-400">คำนวณจุดศูนย์กลางเฉลี่ยถ่วงน้ำหนักของความเข้มข้นของผู้ป่วยในแต่ละคาบเวลาเพื่อดูทิศทางและระยะทางเคลื่อนตัว</p>
        </div>
        <span className="spatio-badge bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[9px] uppercase font-black tracking-wider">
          มิติเวลา (Dynamic Mode)
        </span>
      </div>

      <div className="bg-slate-950/20 border border-slate-850 p-5 rounded-xl space-y-4">
        <div className="space-y-1 text-xs text-slate-400 leading-relaxed">
          <span className="font-bold text-white block">📐 หลักเกณฑ์ประมวลผลเชิงวิชาการ:</span>
          <p>ระบบจะระบุจุดพิกัด centroid ของอำเภอ/ตำบล หรือจุดพิกัดตรวจวัดจริง จากนั้นจะคูณน้ำหนักด้วยจำนวนผู้ป่วยในแต่ละสัปดาห์ เพื่อหา Weighted Spatial Mean ในแต่ละคาบเวลาแล้วนำมาลากเป็นทิศทางแนวโน้มการเคลื่อนที่</p>
        </div>
        <button
          onClick={onRun}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 via-cyan-500 to-teal-500 hover:opacity-95 text-white text-xs font-bold transition-all shadow-md active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer shadow-cyan-950/20"
        >
          <Play size={12} />
          <span>ประมวลผลและคำนวณรอยเยื้องตัวของจุดศูนย์กลางโรค</span>
        </button>
      </div>

      {driftRes && (
        <div className="space-y-6 border-t border-slate-850 pt-6 animate-fade-in">
          <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl flex items-center gap-4 shadow-inner">
            <span className="text-3xl">🧭</span>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-cyan-400 block uppercase leading-none">ผลลัพธ์แนวโน้มการเคลื่อนย้ายเชิงเวลา:</span>
              <span className="text-base font-black block">
                จุดศูนย์กลางการระบาดมีการเยื้องตัวเป็นระยะทาง <span className="text-cyan-400">{driftRes.distance.toFixed(2)} กม.</span>
              </span>
              <p className="text-[10px] text-slate-400 leading-normal font-sans">
                เคลื่อนย้ายไปทาง <span className="font-bold text-white">{driftRes.direction}</span> ครอบคลุมระยะเวลาทดสอบทั้งหมด {driftRes.sampleSize} ช่วงเวลา (สัปดาห์)
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <Activity size={13} className="text-cyan-400 animate-pulse" />
              <span>ตารางพิกัดจุดศูนย์กลางเฉลี่ยรายสัปดาห์ (Weighted Mean Centroids):</span>
            </span>

            <div className="overflow-x-auto border border-slate-800/80 rounded-xl bg-slate-950/60 max-h-[220px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-905 border-b border-slate-800 text-slate-200">
                    <th className="p-3 font-black">สัปดาห์ / คาบเวลา</th>
                    <th className="p-3 font-black text-center">ละติจูด (Lat Centroid)</th>
                    <th className="p-3 font-black text-center">ลองจิจูด (Lng Centroid)</th>
                    <th className="p-3 font-black text-right">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300 font-mono">
                  {driftRes.trajectory.map((t: any, index: number) => (
                    <tr key={index} className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-3 font-semibold text-white font-sans">{t.label}</td>
                      <td className="p-3 text-center">{t.centroid[0].toFixed(5)}</td>
                      <td className="p-3 text-center">{t.centroid[1].toFixed(5)}</td>
                      <td className="p-3 text-right">
                        <span className={clsx(
                          "px-2 py-0.5 rounded font-black text-[9px] border inline-block text-center",
                          index === 0 && "bg-blue-500/10 border-blue-500/20 text-blue-400",
                          index === driftRes.trajectory.length - 1 && "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
                          index !== 0 && index !== driftRes.trajectory.length - 1 && "bg-slate-800/40 border-slate-800 text-slate-500"
                        )}>
                          {index === 0 ? 'START' : (index === driftRes.trajectory.length - 1 ? 'LATEST' : `STEP ${index}`)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
