import React from 'react'
import { calculateCorrelation } from '../../../data/spatialStats'
import { useTranslation } from '../../../hooks/useTranslation'
import { TrendingUp, AlertCircle, Play } from 'lucide-react'

interface CorrelationTabProps {
  xCol: string
  setXCol: (v: string) => void
  yCol: string
  setYCol: (v: string) => void
  numericColumns: string[]
  rawRows: any[]
  onClose: () => void
  notify: (type: 'info' | 'success' | 'error' | 'warning', msg: string) => void
}

export const CorrelationTab: React.FC<CorrelationTabProps> = ({
  xCol,
  setXCol,
  yCol,
  setYCol,
  numericColumns,
  rawRows,
  onClose,
  notify
}) => {
  const { t } = useTranslation()

  const handleCorrelationAnalysis = () => {
    if (!xCol || !yCol) return
    const xArr: number[] = []
    const yArr: number[] = []
    rawRows.forEach((r: any) => {
      const vx = parseFloat(String(r[xCol] || '').replace(/,/g, '').trim())
      const vy = parseFloat(String(r[yCol] || '').replace(/,/g, '').trim())
      if (!isNaN(vx) && !isNaN(vy)) {
        xArr.push(vx)
        yArr.push(vy)
      }
    })

    const res = calculateCorrelation(xArr, yArr)
    if (!res) {
      notify('error', t('ana_corr_data_err'))
      return
    }

    onClose()
    notify('success', t('ana_corr_success', { r: res.pearsonR.toFixed(3), strength: res.strength, count: res.sampleSize }))
  }

  return (
    <div className="space-y-5 animate-fade-in text-spatio-text">
      <div className="space-y-1">
        <span className="text-[10px] font-black text-amber-500 dark:text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
          <TrendingUp size={12} />
          <span>{t('ana_corr_title')}</span>
        </span>
        <p className="text-[10px] text-spatio-muted leading-relaxed">
          {t('ana_corr_desc_tab')}
        </p>
      </div>

      {numericColumns.length < 2 ? (
        <div className="p-4 rounded-xl border border-amber-550/20 bg-amber-50 dark:bg-amber-950/10 text-amber-800 dark:text-amber-300 text-xs flex gap-2 leading-relaxed">
          <AlertCircle className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" size={16} />
          <span>{t('ana_corr_suit')}</span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-spatio-surface/40 border border-spatio-border p-4 rounded-xl space-y-3.5 shadow-inner">
            <div className="space-y-1">
              <label className="text-[10px] text-spatio-muted font-bold">{t('ana_corr_select_x')}</label>
              <select
                value={xCol}
                onChange={e => setXCol(e.target.value)}
                className="w-full text-xs px-2.5 py-2.5 bg-spatio-bg border border-spatio-border rounded-xl text-spatio-text cursor-pointer focus:outline-none"
              >
                {numericColumns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-spatio-muted font-bold">{t('ana_corr_select_y')}</label>
              <select
                value={yCol}
                onChange={e => setYCol(e.target.value)}
                className="w-full text-xs px-2.5 py-2.5 bg-spatio-bg border border-spatio-border rounded-xl text-spatio-text cursor-pointer focus:outline-none"
              >
                {numericColumns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <button
            onClick={handleCorrelationAnalysis}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 hover:opacity-95 text-white text-xs font-bold transition-all shadow-md active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer shadow-amber-950/20"
          >
            <Play size={12} />
            <span>{t('ana_corr_run')}</span>
          </button>
        </div>
      )}
    </div>
  )
}
