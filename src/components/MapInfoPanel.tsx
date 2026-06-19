/**
 * MapInfoPanel.tsx — Legend + Stats panel (bottom-right)
 * แสดง: ตำนานสี (Legend) + สถิติ (Max, Min, Mean, Median, P25, P75)
 */
import { useAppStore } from '../store/useAppStore'
import { COLOR_PALETTES, getNextStartValue } from '../map/mapController'
import { useTranslation } from '../hooks/useTranslation'
import { MapPin } from 'lucide-react'

// ──────────────────────────────────────────
// Statistics Calculator
// ──────────────────────────────────────────

function fmt(v: number) {
  return Math.round(v).toLocaleString()
}

// ──────────────────────────────────────────
// Legend Panel
// ──────────────────────────────────────────
function LegendPanel({ breaks, palette }: { breaks: number[]; palette: string }) {
  const { t } = useTranslation()
  const { breaksStart, showLegendZeroRow, showZeroAreas } = useAppStore()
  if (breaks.length === 0) return null
  const colors = COLOR_PALETTES[palette] ?? COLOR_PALETTES.YlOrRd

  const bands: { color: string; label: string }[] = breaks.map((b, i) => {
    const startVal = i === 0 ? breaksStart : getNextStartValue(breaks[i - 1])
    return {
      color: colors[i] ?? colors[colors.length - 1],
      label: `${startVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 10 })} – ${b.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 10 })}`,
    }
  })
  bands.push({
    color: colors[breaks.length] ?? colors[colors.length - 1],
    label: `> ${breaks[breaks.length - 1].toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 10 })}`,
  })

  return (
    <div className="spatio-glass p-2">
      <span className="block text-[10px] text-spatio-muted uppercase tracking-wider mb-1.5">
        {t('info_legend')}
      </span>
      {bands.map((b, i) => (
        <div key={i} className="flex items-center gap-1.5 mb-1 last:mb-0">
          <div className="w-3.5 h-2.5 rounded-sm shrink-0 shadow-sm" style={{ background: b.color }} />
          <span className="text-[10.5px] text-spatio-text leading-none">{b.label}</span>
        </div>
      ))}
      {showLegendZeroRow && (
        <div className="flex items-center gap-1.5 mt-1.5 border-t border-spatio-border/20 pt-1.5">
          <div 
            className="w-3.5 h-2.5 rounded-sm shrink-0 border border-spatio-border" 
            style={{ backgroundColor: showZeroAreas ? '#f8fafc' : 'transparent' }}
          />
          <span className="text-[10px] text-spatio-muted leading-none">{t('info_no_data_short')}</span>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────
// Stats Row
// ──────────────────────────────────────────
function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-0.5 border-b border-spatio-border last:border-0">
      <span className="text-[10px] text-spatio-muted leading-none">{label}</span>
      <span className="text-[10px] text-spatio-text font-medium tabular-nums leading-none">{value}</span>
    </div>
  )
}

function handlePeakLocationClick(locationStr: string) {
  if (!locationStr || locationStr === '—') return

  const parts = locationStr.split(',').map(p => p.trim())

  let province = 'all'
  let district = 'all'
  let subdistrict = 'all'

  if (parts.length === 3) {
    subdistrict = parts[0].replace(/^(ตำบล|ต\.)/, '').trim()
    district = parts[1].replace(/^(อำเภอ|อ\.)/, '').trim()
    province = parts[2].replace(/^(จังหวัด|จ\.)/, '').trim()
  } else if (parts.length === 2) {
    district = parts[0].replace(/^(อำเภอ|อ\.)/, '').trim()
    province = parts[1].replace(/^(จังหวัด|จ\.)/, '').trim()
  } else if (parts.length === 1) {
    province = parts[0].replace(/^(จังหวัด|จ\.)/, '').trim()
  }

  import('../map/mapController').then(({ fitToScope }) => {
    fitToScope(province, district, subdistrict)
  })
}

// ──────────────────────────────────────────
// Stats Panel
// ──────────────────────────────────────────
function StatsPanel() {
  const { isCumulative, globalStats } = useAppStore()
  const { t, language } = useTranslation()

  if (!globalStats) return null

  return (
    <div className="spatio-glass p-2 min-w-[180px] w-[180px]">
      <span className="block text-[9.5px] text-spatio-muted uppercase tracking-wider mb-1.5">
        {t('info_current_stats')}{' '}
        <span className="text-spatio-muted/60 text-[8px]">
          ({globalStats.count})
        </span>
      </span>

      <div className="mb-1.5 flex flex-col gap-0.5">
        <StatRow label={t('info_max')} value={fmt(globalStats.max)} />
        <StatRow label={t('info_min')} value={fmt(globalStats.min)} />
        <StatRow label={t('info_mean')} value={fmt(globalStats.mean)} />
        <StatRow label={t('info_median')} value={fmt(globalStats.median)} />
        <StatRow label="P25" value={fmt(globalStats.p25)} />
        <StatRow label="P75" value={fmt(globalStats.p75)} />
      </div>

      <div className="pt-1.5 mt-1.5 border-t border-spatio-border bg-indigo-500/5 -mx-2 px-2 pb-0.5">
        <div className="flex items-center gap-1 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-[9px] text-indigo-650 dark:text-indigo-400 uppercase tracking-tight font-semibold">
            {t('info_peak_overall')}
          </span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-[8.5px] text-spatio-muted">{t('info_peak_value')}</span>
          <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold tabular-nums">
            {fmt(globalStats.peak.value)}
          </span>
        </div>
        <div
          className="text-[9.5px] text-spatio-muted leading-tight mt-1 hover:text-indigo-650 dark:hover:text-indigo-400 hover:underline cursor-pointer transition-all active:scale-95"
          title={language === 'th' ? 'คลิกเพื่อซูมไปยังพื้นที่นี้' : 'Click to zoom to this location'}
          onClick={() => handlePeakLocationClick(globalStats.peak.location)}
        >
          <span className="text-spatio-text font-medium block whitespace-normal mt-0.5 flex items-center gap-1 select-none">
            <MapPin size={10} className="text-indigo-500 animate-bounce shrink-0" />
            <span>{globalStats.peak.location}</span>
          </span>
        </div>
        {!isCumulative && (
          <div className="text-[9.5px] text-spatio-muted leading-tight mt-0.5">
            {t('info_date')}{' '}
            <span className="text-spatio-text font-medium">{globalStats.peak.date}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────
// Main Export
// ──────────────────────────────────────────
export function MapInfoPanel({ periodsReady, isColorOnly = false }: {
  periodsReady: boolean
  isColorOnly?: boolean
}) {
  const { palette, colorMode, globalBreaks } = useAppStore()
  const { t } = useTranslation()
  const breaks = globalBreaks

  const isCustomColor = colorMode === 'custom'
  // color-only mode: ไม่แสดง legend (ไม่มี breaks) และไม่แสดงสถิติ
  const showLegend = periodsReady && !isColorOnly && !isCustomColor && breaks.length > 0
  const showStats = periodsReady && !isColorOnly

  if (!showLegend && !showStats && !isCustomColor) return null

  return (
    <div className="flex flex-col gap-1.5 w-[180px]">
      {isCustomColor && (
        <div className="spatio-glass p-2 min-w-[180px] w-[180px]">
          <span className="block text-[10px] text-spatio-muted uppercase tracking-wider mb-1.5">
            {t('info_legend')}
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3.5 rounded bg-gradient-to-r from-red-500 via-emerald-400 to-blue-500 shrink-0 shadow-sm" />
            <span className="text-[10.5px] text-spatio-text">{t('info_custom_colors')}</span>
          </div>
        </div>
      )}
      {showLegend && <LegendPanel breaks={breaks} palette={palette} />}
      {showStats && <StatsPanel />}
    </div>
  )
}
