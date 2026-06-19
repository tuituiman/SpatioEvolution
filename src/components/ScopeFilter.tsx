/**
 * ScopeFilter.tsx — กรองพื้นที่ + ซูม
 * เขตสุขภาพ 1-13 / จังหวัด / อำเภอ
 */
import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, MapPin, X, RotateCcw } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useTranslation } from '../hooks/useTranslation'
import { locationResolver } from '../data/locationResolver'

import {
  HEALTH_ZONES,
  getDistrictsInProvince,
  getSubdistrictsInDistrict,
  computeProvinceBounds,
  computeDistrictBounds,
  computeSubdistrictBounds,
} from '../data/healthZones'
import { zoomToBounds, resetZoom } from '../map/mapController'
import clsx from 'clsx'

// ──────────────────────────────────────────
// Sub-component: Select dropdown
// ──────────────────────────────────────────
interface SelectProps {
  label:    string
  value:    string
  options:  { value: string; label: string }[]
  onChange: (v: string) => void
  disabled?: boolean
}

function ScopeSelect({ label, value, options, onChange, disabled }: SelectProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-spatio-muted/70 uppercase tracking-wider px-1">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className={clsx(
            'w-full appearance-none rounded-md px-2.5 py-1.5 pr-7',
            'bg-spatio-surface border border-spatio-border text-xs text-spatio-text',
            'focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/30',
            'transition-colors cursor-pointer',
            disabled && 'opacity-40 cursor-not-allowed'
          )}
        >
          {options.map(o => (
            <option key={o.value} value={o.value} className="bg-white dark:bg-slate-900 text-black dark:text-white">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={12}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-spatio-muted pointer-events-none"
        />
      </div>
    </div>
  )
}

interface SearchableSelectProps {
  label:    string
  value:    string
  options:  { value: string; label: string }[]
  onChange: (v: string) => void
  disabled?: boolean
}

function SearchableScopeSelect({ label, value, options, onChange, disabled }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Find current label
  const selectedOption = options.find(o => o.value === value)
  const displayValue = selectedOption ? selectedOption.label : ''

  // Sync display value when it changes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery(displayValue)
    }
  }, [value, displayValue, isOpen])

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery || searchQuery === displayValue) return options
    const q = searchQuery.toLowerCase().trim()
    return options.filter(o => 
      o.label.toLowerCase().includes(q) || 
      o.value.toLowerCase().includes(q)
    )
  }, [options, searchQuery, displayValue])

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-spatio-muted/70 uppercase tracking-wider px-1">{label}</span>
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={e => {
            setSearchQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => {
            setIsOpen(true)
            setSearchQuery('')
          }}
          onBlur={() => {
            setTimeout(() => {
              setIsOpen(false)
              setSearchQuery(displayValue)
            }, 180)
          }}
          disabled={disabled}
          placeholder="พิมพ์เพื่อค้นหา..."
          className={clsx(
            'w-full rounded-md px-2.5 py-1.5 pr-7 text-left',
            'bg-spatio-surface border border-spatio-border text-xs text-spatio-text',
            'focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/30',
            'transition-colors cursor-pointer placeholder-slate-400 dark:placeholder-slate-600',
            disabled && 'opacity-40 cursor-not-allowed'
          )}
        />
        <ChevronDown
          size={12}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-spatio-muted pointer-events-none"
        />

        {isOpen && !disabled && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl py-1 z-[3000] max-h-48 overflow-y-auto flex flex-col gap-0.5 animate-fade-in">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onMouseDown={() => {
                    onChange(o.value)
                    setSearchQuery(o.label)
                    setIsOpen(false)
                  }}
                  className={clsx(
                    "w-full flex items-center px-3 py-1.5 text-xs text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer",
                    value === o.value && "bg-slate-100 dark:bg-slate-800 font-bold"
                  )}
                >
                  <span className="truncate text-slate-700 dark:text-slate-200">{o.label}</span>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-slate-400 italic">
                ไม่พบข้อมูล
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────
export function ScopeFilter() {
  const { scope, setScope, mapReady } = useAppStore()
  const [isOpen, setIsOpen] = useState(false)
  const { t, language } = useTranslation()

  // ── Zone options ──
  const zoneOptions = useMemo(() => [
    { value: 'all', label: language === 'th' ? '🌏 ทั้งประเทศ' : '🌏 Whole Country' },
    ...HEALTH_ZONES.map(z => ({
      value: String(z.id),
      label: language === 'th' ? z.label : `Health Region ${z.id}`
    })),
  ], [language])

  // ── Province options (กรองตาม zone) ──
  const provinceOptions = useMemo(() => {
    const all = { value: 'all', label: language === 'th' ? '— ทั้งหมด —' : '— All —' }
    let list: string[] = []
    if (scope.region === 'all') {
      list = HEALTH_ZONES.flatMap(z => z.provinces)
    } else {
      const zone = HEALTH_ZONES.find(z => z.id === Number(scope.region))
      list = zone?.provinces ?? []
    }
    
    const uniqueList = Array.from(new Set(list))
    
    const mapped = uniqueList.map(p => {
      const resolved = locationResolver.resolve(p, '', '')
      const label = language === 'en' ? (resolved?.pNameEn || p) : p
      return { value: p, label }
    })
    
    mapped.sort((a, b) => a.label.localeCompare(b.label))
    
    return [all, ...mapped]
  }, [scope.region, language, mapReady])

  // ── District options (ดึง real-time จาก registry) ──
  const districtOptions = useMemo(() => {
    const all = { value: 'all', label: language === 'th' ? '— ทั้งหมด —' : '— All —' }
    if (scope.province === 'all' || !mapReady) return [all]
    const districts = getDistrictsInProvince(scope.province)
    
    const mapped = districts.map(d => {
      const resolved = locationResolver.resolve(scope.province, d, '')
      const label = language === 'en' ? (resolved?.aNameEn || d) : d
      return { value: d, label }
    })
    
    mapped.sort((a, b) => a.label.localeCompare(b.label))
    
    return [all, ...mapped]
  }, [scope.province, mapReady, language])

  // ── Subdistrict options (ดึง real-time จาก registry) ──
  const subdistrictOptions = useMemo(() => {
    const all = { value: 'all', label: language === 'th' ? '— ทั้งหมด —' : '— All —' }
    if (scope.province === 'all' || scope.district === 'all' || !mapReady) return [all]
    const subdistricts = getSubdistrictsInDistrict(scope.province, scope.district)
    
    const mapped = subdistricts.map(t => {
      const resolved = locationResolver.resolve(scope.province, scope.district, t)
      const label = language === 'en' ? (resolved?.tNameEn || t) : t
      return { value: t, label }
    })
    
    mapped.sort((a, b) => a.label.localeCompare(b.label))
    
    return [all, ...mapped]
  }, [scope.province, scope.district, mapReady, language])

  // ── Handlers ──
  const handleZoneChange = (val: string) => {
    setScope({ region: val, province: 'all', district: 'all', subdistrict: 'all' })
    if (val !== 'all') {
      const zone = HEALTH_ZONES.find(z => z.id === Number(val))
      if (zone) zoomToBounds(zone.bounds)
    } else {
      resetZoom()
    }
  }

  const handleProvinceChange = (val: string) => {
    setScope({ province: val, district: 'all', subdistrict: 'all' })
    if (val !== 'all') {
      const bounds = computeProvinceBounds(val)
      if (bounds) zoomToBounds(bounds)
    } else if (scope.region !== 'all') {
      const zone = HEALTH_ZONES.find(z => z.id === Number(scope.region))
      if (zone) zoomToBounds(zone.bounds)
    } else {
      resetZoom()
    }
  }

  const handleDistrictChange = (val: string) => {
    setScope({ district: val, subdistrict: 'all' })
    if (val !== 'all' && scope.province !== 'all') {
      const bounds = computeDistrictBounds(scope.province, val)
      if (bounds) zoomToBounds(bounds, { maxZoom: 13 })
    } else if (scope.province !== 'all') {
      const bounds = computeProvinceBounds(scope.province)
      if (bounds) zoomToBounds(bounds)
    }
  }

  const handleSubdistrictChange = (val: string) => {
    setScope({ subdistrict: val })
    if (val !== 'all' && scope.province !== 'all' && scope.district !== 'all') {
      const bounds = computeSubdistrictBounds(scope.province, scope.district, val)
      if (bounds) zoomToBounds(bounds, { maxZoom: 15 })
    } else if (scope.district !== 'all' && scope.province !== 'all') {
      const bounds = computeDistrictBounds(scope.province, scope.district)
      if (bounds) zoomToBounds(bounds, { maxZoom: 13 })
    }
  }

  const handleReset = () => {
    setScope({ region: 'all', province: 'all', district: 'all', subdistrict: 'all' })
    resetZoom()
  }

  const isFiltered = scope.region !== 'all' || scope.province !== 'all' || scope.district !== 'all' || scope.subdistrict !== 'all'

  // ── Reset province/district/subdistrict when zone changes and province not in new zone ──
  useEffect(() => {
    if (scope.region !== 'all' && scope.province !== 'all') {
      const zone = HEALTH_ZONES.find(z => z.id === Number(scope.region))
      if (zone && !zone.provinces.includes(scope.province)) {
        setScope({ province: 'all', district: 'all', subdistrict: 'all' })
      }
    }
  }, [scope.region])

  return (
    <div className="spatio-glass w-full">
      {/* Header / Toggle */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-spatio-muted hover:text-spatio-text transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <MapPin size={13} className={isFiltered ? 'text-indigo-500' : 'text-spatio-muted'} />
          <span>{t('filter_scope_title')}</span>
        </span>
        <ChevronDown
          size={13}
          className={clsx('text-spatio-muted transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {/* Expanded dropdowns */}
      {isOpen && (
        <div className="px-2 pb-2 flex flex-col gap-2 border-t border-spatio-border pt-2">
          <ScopeSelect
            label={t('filter_region')}
            value={scope.region}
            options={zoneOptions}
            onChange={handleZoneChange}
          />
          <SearchableScopeSelect
            label={t('filter_province')}
            value={scope.province}
            options={provinceOptions}
            onChange={handleProvinceChange}
          />
          <ScopeSelect
            label={t('filter_district')}
            value={scope.district}
            options={districtOptions}
            onChange={handleDistrictChange}
            disabled={scope.province === 'all'}
          />
          <ScopeSelect
            label={t('filter_subdistrict')}
            value={scope.subdistrict}
            options={subdistrictOptions}
            onChange={handleSubdistrictChange}
            disabled={scope.district === 'all'}
          />

          {isFiltered && (
            <button
              onClick={handleReset}
              className="mt-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md
                         text-[11px] text-spatio-muted hover:text-spatio-text
                         bg-spatio-surface-alt hover:bg-spatio-border border border-spatio-border
                         transition-colors cursor-pointer"
            >
              <RotateCcw size={11} />
              {language === 'th' ? 'รีเซ็ตทั้งหมด' : 'Reset All'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
