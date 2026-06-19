import React from 'react'
import type { DataKeys } from '../../../store/useAppStore'
import { getActiveCoordinatesSlice } from '../../../map/pointLayer'
import { calculateDistance } from '../../../data/spatialStats'
import { BarChart2, AlertCircle, Play } from 'lucide-react'
import { useTranslation } from '../../../hooks/useTranslation'

interface InterpolationTabProps {
  dataKeys: DataKeys
  idwPower: number
  setIdwPower: (v: number) => void
  idwRadius: number
  setIdwRadius: (v: number) => void
  onClose: () => void
  notify: (type: 'info' | 'success' | 'error' | 'warning', msg: string) => void
}

export const InterpolationTab: React.FC<InterpolationTabProps> = ({
  dataKeys,
  idwPower,
  setIdwPower,
  idwRadius,
  setIdwRadius,
  onClose,
  notify
}) => {
  const { t } = useTranslation()

  const handleIDWInterpolation = () => {
    const slice = getActiveCoordinatesSlice()
    const valid = slice.filter(s => s.value > 0)
    if (valid.length < 3) {
      notify('error', t('ana_idw_no_data'))
      return
    }

    notify('info', t('ana_idw_progress'))
    
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180
    valid.forEach(p => {
      if (p.lat < minLat) minLat = p.lat
      if (p.lat > maxLat) maxLat = p.lat
      if (p.lng < minLng) minLng = p.lng
      if (p.lng > maxLng) maxLng = p.lng
    })

    const samples: any[] = []
    const latStep = (maxLat - minLat) / 3
    const lngStep = (maxLng - minLng) / 3

    let idx = 1
    for (let r = 0; r < 3; r++) {
      const qLat = minLat + r * latStep + latStep/2
      for (let c = 0; c < 3; c++) {
        const qLng = minLng + c * lngStep + lngStep/2
        let num = 0, den = 0, closest = Infinity, val = 0

        for (const pt of valid) {
          const dist = calculateDistance(pt.lat, pt.lng, qLat, qLng)
          if (dist < closest) closest = dist
          if (dist === 0) { val = pt.value; break }
          if (dist > idwRadius) continue

          const w = 1 / Math.pow(dist, idwPower)
          num += w * pt.value
          den += w
        }

        if (closest > 0 && den > 0) val = num / den
        samples.push({ id: idx++, lat: qLat, lng: qLng, value: val })
      }
    }

    onClose()
    notify('success', t('ana_idw_success', { val: samples[4]?.value.toFixed(1) || '—' }))
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="space-y-1">
        <span className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
          <BarChart2 size={12} />
          <span>{t('ana_idw_header')}</span>
        </span>
        <p className="text-[10px] text-spatio-muted leading-relaxed">
          {t('ana_idw_desc_tab')}
        </p>
      </div>

      {(!dataKeys.lat || !dataKeys.value) ? (
        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-50 dark:bg-amber-950/10 text-amber-800 dark:text-amber-300 text-xs flex gap-2 leading-relaxed">
          <AlertCircle className="shrink-0 mt-0.5" size={16} />
          <span>{t('ana_idw_no_coords')}</span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-spatio-surface-alt border border-spatio-border p-4 rounded-xl space-y-4 shadow-inner">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-spatio-text block">{t('ana_idw_power')}</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={1}
                  max={4}
                  value={idwPower}
                  onChange={e => setIdwPower(Number(e.target.value))}
                  className="flex-1 accent-indigo-500 cursor-pointer"
                />
                <span className="text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 px-2.5 py-0.5 rounded">
                  p = {idwPower}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-spatio-text block">{t('ana_idw_radius')}</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={50}
                  max={250}
                  value={idwRadius}
                  onChange={e => setIdwRadius(Number(e.target.value))}
                  className="flex-1 accent-indigo-500 cursor-pointer"
                />
                <span className="text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 px-2.5 py-0.5 rounded">
                  {idwRadius}km
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleIDWInterpolation}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-500 hover:opacity-95 text-white text-xs font-bold transition-all shadow-md active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer shadow-indigo-950/20"
          >
            <Play size={12} />
            <span>{t('ana_idw_run')}</span>
          </button>
        </div>
      )}
    </div>
  )
}

