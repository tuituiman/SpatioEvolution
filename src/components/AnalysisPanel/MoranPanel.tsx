/**
 * MoranPanel.tsx — Global Moran's I + LISA Hotspot Tab
 * Extracted from Analysis.tsx for cleaner code organization
 */
import { Flame, Play, Eye, Trash2, CheckCircle2 } from 'lucide-react'
import { clsx } from 'clsx'

interface MoranPanelProps {
  distanceBand: number
  onDistanceBandChange: (v: number) => void
  adminLevel: 'province' | 'district' | 'subdistrict'
  moransRes: any | null
  isMoranApplied: boolean
  isComputing?: boolean
  computeProgress?: number
  onRun: () => void
  onApplyToMap: () => void
  onResetFromMap: () => void
}

export function MoranPanel({
  distanceBand, onDistanceBandChange,
  adminLevel, moransRes, isMoranApplied,
  isComputing = false, computeProgress = 0,
  onRun, onApplyToMap, onResetFromMap
}: MoranPanelProps) {
  return (
    <div className="spatio-card p-6 border border-slate-800 space-y-6 bg-slate-900/10 shadow-2xl rounded-2xl">
      <div className="flex justify-between items-center border-b border-slate-850 pb-4">
        <div className="space-y-1">
          <h3 className="text-sm font-black text-white">สถิติความสัมพันธ์เชิงพื้นที่เพื่อนบ้าน (Global &amp; Local Moran's I)</h3>
          <p className="text-[10px] text-slate-450">คำนวณดัชนีชี้วัดความแปรปรวนเชิงขอบเขตพื้นที่ ว่าสถิติมีความสอดคล้องหรือแยกตัวออกกัน</p>
        </div>
        <span className="spatio-badge bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] uppercase font-black tracking-wider">
          ขอบเขตพื้นที่ (Area Mode)
        </span>
      </div>

      {/* Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 border border-slate-850 p-4 rounded-xl bg-slate-950/20">
          <label className="text-[11px] font-bold text-slate-300 block">
            ขอบเขตรัศมีอิทธิพลความกว้างกลุ่มเพื่อนบ้าน (Distance Band):
          </label>
          <div className="flex items-center gap-4 mt-2">
            <input
              type="range" min={20} max={350} value={distanceBand}
              onChange={e => onDistanceBandChange(Number(e.target.value))}
              className="flex-1 accent-rose-500 cursor-pointer"
            />
            <span className="text-xs font-mono font-bold bg-slate-800 text-rose-400 border border-slate-700 px-2.5 py-1 rounded">
              {distanceBand} km
            </span>
          </div>
          <span className="text-[9px] text-slate-500 block leading-tight mt-1.5">
            * พื้นที่ที่อยู่ใกล้กันเกินระยะนี้จะถูกรวมคำนวณน้ำหนักเป็นพื้นที่รอบข้างเชิงสถิติ (Inverse Distance weights)
          </span>
        </div>

        <div className="border border-slate-850 p-4 rounded-xl bg-slate-950/20 flex flex-col justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-450 block uppercase">ระดับการปกครองที่แอกทีฟ:</span>
            <span className="text-xs font-black text-white">
              ระดับ{adminLevel === 'province' ? 'จังหวัด' : (adminLevel === 'district' ? 'อำเภอ' : 'ตำบล')}
            </span>
          </div>
          {isComputing ? (
            <div className="w-full mt-3 space-y-2">
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-rose-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${computeProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-rose-400 text-center">กำลังคำนวณ Moran's I... {computeProgress}%</p>
            </div>
          ) : (
            <button
              onClick={onRun}
              className="w-full mt-3 py-3 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-orange-500 hover:opacity-95 text-white text-xs font-bold transition-all shadow-md active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer shadow-rose-950/20"
            >
              <Play size={12} />
              <span>คำนวณ Moran's I &amp; LISA Hotspots</span>
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {moransRes && (
        <div className="space-y-6 animate-fade-in border-t border-slate-850 pt-6">
          {/* Conclusion */}
          <div className={clsx(
            "p-5 rounded-2xl border flex items-center gap-4 shadow-inner",
            moransRes.conclusion === 'Clustered' && "bg-rose-500/10 border-rose-500/30 text-rose-300",
            moransRes.conclusion === 'Dispersed' && "bg-blue-500/10 border-blue-500/30 text-blue-300",
            moransRes.conclusion === 'Random' && "bg-slate-800/40 border-slate-800 text-slate-300"
          )}>
            <span className="text-3xl">
              {moransRes.conclusion === 'Clustered' ? '🔥' : (moransRes.conclusion === 'Dispersed' ? '❄️' : '🎲')}
            </span>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider block leading-none">สรุปดัชนีทางระบาดวิทยาเชิงพื้นที่:</span>
              <span className="text-base font-black block">
                {moransRes.conclusion === 'Clustered' && 'ตรวจพบกลุ่มก้อนการระบาดกระจุกตัวอย่างเด่นชัด (High Spatial Clustering)'}
                {moransRes.conclusion === 'Dispersed' && 'ตรวจพบการระบาดกระจายตัวห่างจากกันอย่างเป็นระเบียบ (Spatial Dispersion)'}
                {moransRes.conclusion === 'Random' && 'การระบาดเป็นรูปแบบสุ่ม ไม่มีทิศทางกระจุกตัวที่สถิติมองเห็น (Random Pattern)'}
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Moran's Index (I)", value: moransRes.moranIndex.toFixed(4), color: 'text-white' },
              { label: 'Expected Value E(I)', value: moransRes.expectedValue.toFixed(4), color: 'text-slate-350' },
              { label: 'Z-Score (Standardized)', value: moransRes.zScore.toFixed(2), color: Math.abs(moransRes.zScore) > 1.96 ? 'text-rose-400' : 'text-slate-300' },
              { label: 'P-Value (2-Tailed)', value: moransRes.pValue < 0.001 ? '< 0.001' : moransRes.pValue.toFixed(4), color: moransRes.pValue < 0.05 ? 'text-emerald-400' : 'text-slate-400' },
            ].map(s => (
              <div key={s.label} className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-1 shadow-inner text-center">
                <span className="text-[9px] text-slate-400 font-bold block uppercase">{s.label}</span>
                <span className={`text-lg font-black font-mono ${s.color}`}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Apply/Reset Map */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-400 animate-bounce" />
                <span>จำแนกพื้นที่กลุ่มเสี่ยง LISA Hotspots และ Outliers:</span>
              </span>
              <div className="flex gap-2">
                {!isMoranApplied ? (
                  <button onClick={onApplyToMap} className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold flex items-center gap-1 shadow transition-all active:scale-95 cursor-pointer">
                    <Eye size={12} /><span>พล็อต Hotspots ลงแผนที่</span>
                  </button>
                ) : (
                  <button onClick={onResetFromMap} className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer">
                    <Trash2 size={12} /><span>คืนค่าแผนที่ปกติ</span>
                  </button>
                )}
              </div>
            </div>

            {/* LISA Table */}
            <div className="overflow-x-auto border border-slate-800/80 rounded-xl bg-slate-950/60 max-h-[220px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-905 border-b border-slate-800 text-slate-200">
                    <th className="p-3 font-black">ชื่อเขตพื้นที่</th>
                    <th className="p-3 font-black">รหัสพื้นที่</th>
                    <th className="p-3 font-black text-right">จำนวนผู้ป่วย</th>
                    <th className="p-3 font-black text-center">Local Moran (I_i)</th>
                    <th className="p-3 font-black text-center">ประเภท LISA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300 font-mono">
                  {moransRes.details.filter((d: any) => d.type !== 'NS').slice(0, 15).map((d: any) => (
                    <tr key={d.areaCode} className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-3 font-semibold text-white font-sans">{d.areaName}</td>
                      <td className="p-3 text-slate-500">{d.areaCode}</td>
                      <td className="p-3 text-right font-bold text-white">{d.value.toLocaleString()}</td>
                      <td className="p-3 text-center">{d.localI.toFixed(3)}</td>
                      <td className="p-3 text-center">
                        <span className={clsx(
                          "px-2 py-0.5 rounded font-black text-[9px] border inline-block w-12 text-center",
                          d.type === 'HH' && "bg-rose-500/10 border-rose-500/20 text-rose-400",
                          d.type === 'LL' && "bg-blue-500/10 border-blue-500/20 text-blue-400",
                          d.type === 'HL' && "bg-pink-500/10 border-pink-500/20 text-pink-400",
                          d.type === 'LH' && "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                        )}>
                          {d.type === 'HH' ? 'HH (Hot)' : (d.type === 'LL' ? 'LL (Cold)' : (d.type === 'HL' ? 'HL Out' : 'LH Out'))}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {moransRes.details.filter((d: any) => d.type !== 'NS').length === 0 && (
                    <tr><td colSpan={5} className="p-4 text-center text-slate-500 font-sans">— ไม่พบพื้นที่กระจุกตัว Hotspot ที่มีนัยสำคัญเชิงสถิติ (NS) —</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
