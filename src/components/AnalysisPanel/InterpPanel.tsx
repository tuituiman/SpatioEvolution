/**
 * InterpPanel.tsx — IDW Spatial Interpolation Tab
 * Extracted from Analysis.tsx for cleaner code organization
 */
import { Play, CheckCircle2, AlertCircle } from 'lucide-react'

interface InterpPanelProps {
  hasCoords: boolean
  hasValue: boolean
  idwPower: number
  onIdwPowerChange: (v: number) => void
  idwRadius: number
  onIdwRadiusChange: (v: number) => void
  interpolatedPoints: any[] | null
  onRun: () => void
}

export function InterpPanel({
  hasCoords, hasValue, idwPower, onIdwPowerChange, idwRadius, onIdwRadiusChange,
  interpolatedPoints, onRun
}: InterpPanelProps) {
  return (
    <div className="spatio-card p-6 border border-slate-800 space-y-6 bg-slate-900/10 shadow-2xl rounded-2xl">
      <div className="flex justify-between items-center border-b border-slate-850 pb-4">
        <div className="space-y-1">
          <h3 className="text-sm font-black text-white">การประมาณค่าต่อเติมพื้นผิวเชิงพื้นที่ (Spatial Interpolation IDW)</h3>
          <p className="text-[10px] text-slate-450">ประมาณค่าต่อเนื่องให้กับพื้นที่ว่างเปล่าที่ไม่มีเครื่องวัด โดยอิงน้ำหนักถ่วงกลับตามระยะทางสิ่งแวดล้อม</p>
        </div>
        <span className="spatio-badge bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[9px] uppercase font-black tracking-wider">
          จุดพิกัดค่าที่วัดได้ (Measurement Mode)
        </span>
      </div>

      {(!hasCoords || !hasValue) ? (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-300 text-xs flex gap-3 leading-relaxed">
          <AlertCircle className="shrink-0 mt-0.5" size={16} />
          <div>
            <span className="font-bold block">ฟีเจอร์นี้ล็อกอยู่ (Feature Locked)</span>
            ฟีเจอร์ IDW Surface จะแอกทีฟเฉพาะเมื่อมีข้อมูลสถานีที่มีพิกัด Lat/Lng จริง และค่าสถิติสิ่งแวดล้อมที่วัดได้ (เช่น ปริมาณน้ำฝน/อุณหภูมิ) กรุณาใช้ไฟล์ในรูปแบบที่ 5 หรือ 6 เพื่อเริ่มคำนวณการระบายสีพื้นหลังแนวราบนี้
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 border border-slate-850 p-4 rounded-xl bg-slate-950/20">
              <label className="text-[11px] font-bold text-slate-300 block">ค่ายกกำลังถ่วงน้ำหนักระยะทาง (Power Parameter - p):</label>
              <div className="flex items-center gap-4 mt-2">
                <input type="range" min={1} max={5} value={idwPower} onChange={e => onIdwPowerChange(Number(e.target.value))}
                  className="flex-1 accent-indigo-500 cursor-pointer" />
                <span className="text-xs font-mono font-bold bg-slate-800 text-indigo-400 border border-slate-700 px-2.5 py-1 rounded">
                  p = {idwPower}
                </span>
              </div>
              <span className="text-[9px] text-slate-500 block leading-tight mt-1.5">
                * ค่ายิ่งสูง ระยะห่างจะถ่วงน้ำหนักลงเร็วมาก ทำให้ค่าระเบิดเฉพาะจุดตรวจวัดเท่านั้น
              </span>
            </div>

            <div className="space-y-2 border border-slate-850 p-4 rounded-xl bg-slate-950/20 flex flex-col justify-between">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block">รัศมีค้นหาสถานีตรวจวัดสูงสุด (Search Radius):</label>
                <div className="flex items-center gap-4 mt-2">
                  <input type="range" min={30} max={300} value={idwRadius} onChange={e => onIdwRadiusChange(Number(e.target.value))}
                    className="flex-1 accent-indigo-500 cursor-pointer" />
                  <span className="text-xs font-mono font-bold bg-slate-800 text-indigo-400 border border-slate-700 px-2.5 py-1 rounded">
                    {idwRadius} km
                  </span>
                </div>
              </div>
              <button onClick={onRun}
                className="w-full mt-3 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-500 hover:opacity-95 text-white text-xs font-bold transition-all shadow-md active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer shadow-indigo-950/20">
                <Play size={12} /><span>จำลองและประมาณค่าผืนแผ่น IDW</span>
              </button>
            </div>
          </div>

          {interpolatedPoints && (
            <div className="space-y-4 border-t border-slate-850 pt-6 animate-fade-in">
              <div className="space-y-1">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-400 animate-bounce" />
                  <span>ตารางผลการสุ่มจุดประมาณค่าพื้นผิวต่อเนื่อง:</span>
                </span>
                <p className="text-[10px] text-slate-450 leading-relaxed">
                  ประมาณการกระจายอิทธิพลครอบคลุมพื้นที่อย่างสม่ำเสมอ เพื่อนำไปซ้อนวิเคราะห์การเกิดระบาดในเขตตำบล
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {interpolatedPoints.slice(0, 4).map((p: any) => (
                  <div key={p.id} className="bg-slate-950/30 border border-slate-850 p-4 rounded-xl flex justify-between items-center">
                    <div>
                      <span className="text-xs font-black text-white block">สุ่มพิกัดโซน #{p.id}</span>
                      <span className="text-[9px] text-slate-500 block mt-0.5">พิกัด: {p.lat.toFixed(4)}, {p.lng.toFixed(4)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-indigo-400 block font-mono bg-indigo-950/40 border border-indigo-900/40 px-2 py-0.5 rounded">
                        ค่าประมาณ: {p.value.toFixed(2)}
                      </span>
                      <span className="text-[9px] text-slate-500 block mt-0.5 font-mono">สถานีใกล้สุด: {p.closestDist.toFixed(1)} km</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
