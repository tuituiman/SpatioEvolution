import React from 'react'
import type { PeriodBucket, DateDictionary, AdminLevel } from '../../../store/useAppStore'
import { getActiveCoordinatesSlice, mountPointLayer } from '../../../map/pointLayer'
import { locationResolver } from '../../../data/locationResolver'
import { registry } from '../../../data/registry'
import { extractCentroid, calculateDistance } from '../../../data/spatialStats'
import { useTranslation } from '../../../hooks/useTranslation'
import { Activity, AlertCircle, Play } from 'lucide-react'

interface DriftTabProps {
  periods: PeriodBucket[]
  geoMode: 'admin' | 'coordinate'
  adminLevel: AdminLevel
  dictionary: DateDictionary
  onClose: () => void
  notify: (type: 'info' | 'success' | 'error' | 'warning', msg: string) => void
  setActiveOverlayType: (type: 'moran' | 'dbscan' | 'drift' | null) => void
}

export const DriftTab: React.FC<DriftTabProps> = ({
  periods,
  geoMode,
  adminLevel,
  dictionary,
  onClose,
  notify,
  setActiveOverlayType
}) => {
  const { t } = useTranslation()

  const handleDriftAnalysis = async () => {
    if (!periods || periods.length < 2) {
      notify('error', t('ana_drift_no_ts'))
      return
    }

    notify('info', t('ana_drift_running'))
    try {
      await locationResolver.init()
      const trajectory: any[] = []

      for (const p of periods) {
        const periodKey = p.key
        const slice = dictionary[periodKey]
        if (!slice) continue

        let sumLat = 0
        let sumLng = 0
        let totalVal = 0

        if (geoMode === 'coordinate') {
          // Points
          const points = getActiveCoordinatesSlice([periodKey])
          points.forEach(pt => {
            if (pt.value > 0) {
              sumLat += pt.lat * pt.value
              sumLng += pt.lng * pt.value
              totalVal += pt.value
            }
          })
        } else {
          // Admin Boundaries
          const features = registry.getFeatures(adminLevel)
          features.forEach(f => {
            const props = f.properties
            const resolved = locationResolver.resolve(
              String(props.P_Name_T ?? props.PV_TN ?? ''),
              adminLevel === 'province' ? '' : String(props.A_Name_T ?? props.AM_TN ?? ''),
              adminLevel === 'subdistrict' ? String(props.T_Name_T ?? props.TB_TN ?? '') : ''
            )
            if (!resolved) return

            const pCode = resolved.pCode
            const aCode = resolved.aCode
            const tCode = resolved.tCode

            let val = 0
            const pData = slice[pCode]
            if (pData) {
              if (adminLevel === 'province') val = pData._total || 0
              else if (adminLevel === 'district' && aCode) val = pData.districts[aCode]?._total || 0
              else if (adminLevel === 'subdistrict' && tCode) val = pData.districts[aCode]?.subdistricts[tCode] || 0
            }

            const centroid = extractCentroid(f.geometry)
            if (centroid && val > 0) {
              sumLat += centroid[0] * val
              sumLng += centroid[1] * val
              totalVal += val
            }
          })
        }

        if (totalVal > 0) {
          trajectory.push({
            label: p.label,
            centroid: [sumLat / totalVal, sumLng / totalVal] as [number, number]
          })
        }
      }

      if (trajectory.length < 2) {
        notify('error', t('ana_drift_err'))
        return
      }

      // Store trajectory on window for pointLayer to access and render
      (window as any).driftRes = { trajectory };
      setActiveOverlayType('drift');
      
      // Mount layer to update map display
      mountPointLayer();

      onClose()

      const first = trajectory[0]
      const last = trajectory[trajectory.length - 1]
      const dist = calculateDistance(first.centroid[0], first.centroid[1], last.centroid[0], last.centroid[1])

      let direction = t('ana_drift_east')
      const latDiff = last.centroid[0] - first.centroid[0]
      const lngDiff = last.centroid[1] - first.centroid[1]
      if (latDiff > 0 && lngDiff > 0) direction = t('ana_drift_northeast')
      else if (latDiff > 0 && lngDiff < 0) direction = t('ana_drift_northwest')
      else if (latDiff < 0 && lngDiff > 0) direction = t('ana_drift_southeast')
      else if (latDiff < 0 && lngDiff < 0) direction = t('ana_drift_southwest')
      else if (latDiff > 0) direction = t('ana_drift_north')
      else if (latDiff < 0) direction = t('ana_drift_south')
      else if (lngDiff < 0) direction = t('ana_drift_southwest_down')

      notify('success', t('ana_drift_success', { dist: dist.toFixed(2), dir: direction, periods: trajectory.length }))
    } catch (e: any) {
      notify('error', t('ana_moran_err', { msg: e.message }))
    }
  }

  return (
    <div className="space-y-5 animate-fade-in text-spatio-text">
      <div className="space-y-1">
        <span className="text-[10px] font-black text-cyan-500 dark:text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
          <Activity size={12} />
          <span>{t('ana_drift_title')}</span>
        </span>
        <p className="text-[10px] text-spatio-muted leading-relaxed">
          {t('ana_drift_desc_tab')}
        </p>
      </div>

      {periods.length < 2 ? (
        <div className="p-4 rounded-xl border border-amber-550/20 bg-amber-50 dark:bg-amber-950/10 text-amber-800 dark:text-amber-300 text-xs flex gap-2 leading-relaxed">
          <AlertCircle className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" size={16} />
          <span>{t('ana_drift_no_ts')}</span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-spatio-surface/40 border border-spatio-border p-4 rounded-xl shadow-inner text-xs text-spatio-muted space-y-1.5">
            <span className="font-bold text-spatio-text block">{t('ana_drift_rule_title')}</span>
            <span>{t('ana_drift_rule_1')}</span>
            <span>{t('ana_drift_rule_2')}</span>
          </div>

          <button
            onClick={handleDriftAnalysis}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 via-cyan-500 to-teal-500 hover:opacity-95 text-white text-xs font-bold transition-all shadow-md active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer shadow-cyan-950/20"
          >
            <Play size={12} />
            <span>{t('ana_drift_btn')}</span>
          </button>
        </div>
      )}
    </div>
  )
}
