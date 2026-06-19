/**
 * CorrelationPanel.tsx — Pearson + Spearman Correlation Tab
 * Extracted from Analysis.tsx for cleaner code organization
 */
import { Play, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'

interface CorrelationPanelProps {
  numericColumns: string[]
  xCol: string
  yCol: string
  onXColChange: (col: string) => void
  onYColChange: (col: string) => void
  corrRes: any | null
  onRun: () => void
}

export function CorrelationPanel({
  numericColumns, xCol, yCol, onXColChange, onYColChange, corrRes, onRun
}: CorrelationPanelProps) {
  return (
    <div className="spatio-card p-6 border border-slate-800 space-y-6 bg-slate-900/10 shadow-2xl rounded-2xl">
      <div className="flex justify-between items-center border-b border-slate-850 pb-4">
        <div className="space-y-1">
          <h3 className="text-sm font-black text-white">การทดสอบดัชนีความสัมพันธ์เชิงตัวเลขระหว่างคอลัมน์ (Correlation Matrix)</h3>
          <p className="text-[10px] text-slate-450">วิเคราะห์หาความเชื่อมโยงทิศทางของข้อมูลและน้ำหนักความสำคัญทางสถิติวิทยาศาสตร์</p>
        </div>
        <span className="spatio-badge bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] uppercase font-black tracking-wider">
          สถิติตารางร่วม (Correlation)
        </span>
      </div>

      {numericColumns.length < 2 ? (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-300 text-xs flex gap-3 leading-relaxed">
          <AlertCircle className="shrink-0 mt-0.5" size={16} />
          <div>
            <span className="font-bold block">ฟีเจอร์นี้ต้องการคอลัมน์เชิงตัวเลข</span>
            ข้อมูลปัจจุบันไม่มีคอลัมน์เชิงตัวเลขอย่างน้อย 2 คอลัมน์เพียงพอที่จะทำการหาความสัมพันธ์เชิงเปรียบเทียบร่วมกันได้
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 border border-slate-850 p-4 rounded-xl bg-slate-950/20">
              <label className="text-[11px] font-bold text-slate-350 block">เลือกดัชนี X (คอลัมน์สมมติฐานหลัก):</label>
              <select value={xCol} onChange={e => onXColChange(e.target.value)}
                className="w-full text-xs px-2.5 py-2.5 bg-slate-900 border border-slate-700/60 rounded-xl text-white mt-1 cursor-pointer focus:outline-none">
                {numericColumns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="space-y-2 border border-slate-850 p-4 rounded-xl bg-slate-950/20 flex flex-col justify-between">
              <div>
                <label className="text-[11px] font-bold text-slate-350 block">เลือกดัชนี Y (คอลัมน์ยอดเกิดโรค):</label>
                <select value={yCol} onChange={e => onYColChange(e.target.value)}
                  className="w-full text-xs px-2.5 py-2.5 bg-slate-900 border border-slate-700/60 rounded-xl text-white mt-1 cursor-pointer focus:outline-none">
                  {numericColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={onRun}
                className="w-full mt-3 py-3 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 hover:opacity-95 text-white text-xs font-bold transition-all shadow-md active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer shadow-amber-950/20">
                <Play size={12} /><span>เริ่มหาค่าความสัมพันธ์เชิงสถิติ</span>
              </button>
            </div>
          </div>

          {corrRes && (
            <div className="space-y-6 border-t border-slate-850 pt-6 animate-fade-in">
              <div className={clsx(
                "p-5 rounded-2xl border flex items-center gap-4 shadow-inner",
                corrRes.strength.includes('Positive') && "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
                corrRes.strength.includes('Negative') && "bg-red-500/10 border-red-500/30 text-red-300",
                corrRes.strength.includes('Weak') && "bg-slate-800/40 border-slate-800 text-slate-300"
              )}>
                <span className="text-3xl">📊</span>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase block leading-none">สรุปผลการวิเคราะห์ความสัมพันธ์เชิงดัชนี:</span>
                  <span className="text-base font-black block">
                    มีความสัมพันธ์{
                      corrRes.strength === 'Strong Positive' ? 'เชิงบวกระดับสูงมาก (Strong Positive)' :
                      corrRes.strength === 'Moderate Positive' ? 'เชิงบวกปานกลาง (Moderate Positive)' :
                      corrRes.strength === 'Strong Negative' ? 'เชิงลบระดับสูงมาก (Strong Negative)' :
                      corrRes.strength === 'Moderate Negative' ? 'เชิงลบปานกลาง (Moderate Negative)' :
                      'เบาบางมากหรือไม่มีความสัมพันธ์กันอย่างเด่นชัด'
                    }
                  </span>
                  <p className="text-[10px] text-slate-450 leading-relaxed max-w-xl">
                    คำนวณจากขนาดกลุ่มตัวอย่างที่สอดคล้อง {corrRes.sampleSize.toLocaleString()} แถว
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-1 text-center">
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">Pearson Correlation (r)</span>
                  <span className="text-lg font-black text-white font-mono">{corrRes.pearsonR.toFixed(4)}</span>
                </div>
                <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-1 text-center">
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">Spearman Rank (ρ)</span>
                  <span className="text-lg font-black text-white font-mono">{corrRes.spearmanRho.toFixed(4)}</span>
                </div>
                <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-1 text-center">
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">นัยสำคัญทางสถิติ (p-value)</span>
                  <span className="text-lg font-black text-white font-mono">
                    {corrRes.pValPearson < 0.05 ? 'มีนัยสำคัญ (p < 0.05)' : 'ไม่มีนัยสำคัญ (p ≥ 0.05)'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
