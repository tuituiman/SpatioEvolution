import React, { useState, useEffect } from 'react'
import { type PageId } from '../../App'
import {
  Map, BarChart3,
  Database, Download, Settings,
  ChevronLeft, ChevronRight, Zap,
  Palette, Clock, ChevronDown
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAppStore } from '../../store/useAppStore'
import type { ColorPalette } from '../../store/useAppStore'
import { useTranslation } from '../../hooks/useTranslation'
import { COLOR_PALETTES, getNextStartValue } from '../../map/mapController'

interface NavItem {
  id: PageId
  label: string
  icon: React.ReactNode
  badge?: string
}

const NAV_ITEMS_KEYS: { id: PageId, key: any, icon: React.ReactNode, badge?: string }[] = [
  { id: 'explorer', key: 'nav_explorer', icon: <Map size={18} />, badge: 'LIVE' },
  { id: 'export', key: 'nav_export', icon: <Download size={18} /> },
  { id: 'settings', key: 'nav_settings', icon: <Settings size={18} /> },
]

interface SidebarProps {
  activePage: PageId
  onNavigate: (id: PageId) => void
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ activePage, onNavigate, collapsed, onToggle }: SidebarProps) {
  const { datasets, activeDatasetId, rawRows, periods, isZenMode, palette, setPalette, globalBreaks, setGlobalBreaks, numClasses, setNumClasses, customColors, setCustomColors, isBreaksCustomized, resetBreaks, breaksStart, setBreaksStart, showZeroAreas, setShowZeroAreas, showLegendZeroRow, setShowLegendZeroRow, colorMode, displayMode, bubbleScale, setBubbleScale, geoMode, pointRadiusBuffer, setPointRadiusBuffer } = useAppStore()
  const { t } = useTranslation()
  const activeDataset = datasets.find(d => d.id === activeDatasetId) || datasets[datasets.length - 1]
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(true)

  return (
    <aside
      className={clsx(
        'flex flex-col h-full bg-spatio-surface border-r border-spatio-border',
        'transition-all duration-300 ease-in-out shrink-0',
        isZenMode ? 'w-0 border-r-0 border-transparent opacity-0 pointer-events-none overflow-hidden' : (collapsed ? 'w-[60px]' : 'w-[220px]')
      )}
    >
      {/* Logo */}
      <div className={clsx(
        'flex items-center gap-3 px-4 py-5 border-b border-spatio-border',
        collapsed && 'justify-center px-0'
      )}>
        {collapsed ? (
          <img 
            src={`${import.meta.env.BASE_URL}SpatioEvolution_icon.png`} 
            alt="Icon" 
            className="w-8 h-8 rounded-lg object-contain" 
          />
        ) : (
          <div className="flex items-center justify-between w-full select-none">
            <img 
              src={`${import.meta.env.BASE_URL}SpatioEvolution_logo.png`} 
              alt="Logo" 
              className="w-[115px] object-contain object-left shrink-0" 
            />
            <span className="text-[9px] font-black text-spatio-muted bg-slate-500/10 border border-slate-500/20 px-1.5 py-0.5 rounded-md whitespace-nowrap leading-none shrink-0">
              v2.0
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col no-scrollbar">
        {/* Nav Items */}
        <nav className="py-3 px-2 space-y-1">
          {/* 1. Live Explorer (Primary) */}
          <button
            onClick={() => onNavigate('explorer')}
            title={collapsed ? t('nav_explorer') : undefined}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 cursor-pointer',
              collapsed ? 'justify-center' : '',
              activePage === 'explorer'
                ? 'bg-spatio-primary/15 text-spatio-primary font-bold'
                : 'text-spatio-muted hover:text-spatio-text hover:bg-black/5 dark:hover:bg-white/5'
            )}
          >
            <span className="shrink-0"><Map size={18} /></span>
            {!collapsed && (
              <span className="flex-1 text-left truncate font-semibold text-spatio-text">{t('nav_explorer')}</span>
            )}
            {!collapsed && (
              <span className="spatio-badge bg-spatio-primary/20 text-spatio-primary text-[10px]">
                LIVE
              </span>
            )}
          </button>

          {/* 2. Collapsible Tools Dropdown */}
          {collapsed ? (
            // In collapsed mode, render the rest of the icons as simple buttons
            <div className="pt-2 border-t border-slate-300/10 dark:border-slate-800/20 flex flex-col gap-1 mt-2">
              <button
                onClick={() => onNavigate('spatioevent')}
                title="วิเคราะห์รายชั่วโมง (SpatioEvent)"
                className={clsx(
                  "w-full flex items-center justify-center p-2.5 rounded-lg transition-all cursor-pointer",
                  activePage === 'spatioevent'
                    ? 'bg-rose-500/10 text-rose-500'
                    : 'text-rose-500 hover:bg-black/5 dark:hover:bg-white/5'
                )}
              >
                <Clock size={18} />
              </button>
              <button
                disabled
                title="สถิติขั้นสูง (Advanced Stats) - เร็วๆ นี้"
                className="w-full flex items-center justify-center p-2.5 rounded-lg text-slate-600 opacity-40 transition-all cursor-not-allowed"
              >
                <BarChart3 size={18} />
              </button>
              <button
                onClick={() => onNavigate('export')}
                title={t('nav_export')}
                className={clsx(
                  "w-full flex items-center justify-center p-2.5 rounded-lg transition-all cursor-pointer",
                  activePage === 'export' ? 'bg-spatio-primary/10 text-spatio-primary' : 'text-spatio-muted hover:text-spatio-text hover:bg-black/5 dark:hover:bg-white/5'
                )}
              >
                <Download size={18} />
              </button>
              <button
                onClick={() => onNavigate('settings')}
                title={t('nav_settings')}
                className={clsx(
                  "w-full flex items-center justify-center p-2.5 rounded-lg transition-all cursor-pointer",
                  activePage === 'settings' ? 'bg-spatio-primary/10 text-spatio-primary' : 'text-spatio-muted hover:text-spatio-text hover:bg-black/5 dark:hover:bg-white/5'
                )}
              >
                <Settings size={18} />
              </button>
            </div>
          ) : (
            // In expanded mode, render as a collapsible accordion
            <div className="space-y-1 mt-3">
              {/* Header Toggle Button */}
              <button
                onClick={() => setToolsOpen(!toolsOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider hover:text-slate-350 dark:hover:text-slate-350 transition-colors select-none cursor-pointer"
              >
                <span>เครื่องมือ & ตั้งค่า</span>
                <span className={clsx(
                  "transition-transform duration-250 text-slate-500 shrink-0",
                  toolsOpen ? "rotate-180" : "rotate-0"
                )}>
                  <ChevronDown size={14} />
                </span>
              </button>

              {/* Collapsible Panel with max-height transition */}
              <div className={clsx(
                "transition-all duration-300 overflow-hidden",
                toolsOpen ? "max-h-[220px] opacity-100 mt-1.5" : "max-h-0 opacity-0 pointer-events-none"
              )}>
                <div className="mx-1 p-1.5 rounded-xl border border-slate-300/10 dark:border-slate-800/30 bg-slate-100/10 dark:bg-slate-900/40 backdrop-blur-md flex flex-col gap-1 shadow-inner">
                  {/* SpatioEvent */}
                  <button
                    onClick={() => onNavigate('spatioevent')}
                    className={clsx(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all duration-150 cursor-pointer font-medium hover:translate-x-0.5 text-left",
                      activePage === 'spatioevent'
                        ? "bg-rose-500/15 text-rose-400 font-semibold animate-fade-in"
                        : "text-slate-400 dark:text-slate-300 hover:text-slate-100 hover:bg-slate-300/10 dark:hover:bg-white/5"
                    )}
                  >
                    <span className="shrink-0 text-rose-500"><Clock size={15} /></span>
                    <span className="flex-1 truncate font-semibold">วิเคราะห์รายชั่วโมง (SpatioEvent)</span>
                  </button>

                  {/* Advanced Stats */}
                  <div
                    title="สถิติขั้นสูง (Advanced Stats) - เร็วๆ นี้"
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-650 opacity-40 cursor-not-allowed font-medium"
                  >
                    <div className="flex items-center gap-3">
                      <span className="shrink-0 text-slate-600"><BarChart3 size={15} /></span>
                      <span className="truncate">สถิติขั้นสูง (Advanced Stats)</span>
                    </div>
                    <span className="text-[8px] tracking-wide font-extrabold uppercase bg-slate-800 text-slate-400 border border-slate-700/50 rounded-full px-1.5 py-0.5 shrink-0">
                      Soon
                    </span>
                  </div>

                  {/* Export */}
                  <button
                    onClick={() => onNavigate('export')}
                    className={clsx(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all duration-150 cursor-pointer font-medium hover:translate-x-0.5 text-left",
                      activePage === 'export'
                        ? "bg-spatio-primary/15 text-spatio-primary font-semibold"
                        : "text-slate-400 dark:text-slate-300 hover:text-slate-100 hover:bg-slate-300/10 dark:hover:bg-white/5"
                    )}
                  >
                    <span className="shrink-0"><Download size={15} /></span>
                    <span className="flex-1 text-left truncate">{t('nav_export')}</span>
                  </button>

                  {/* Settings */}
                  <button
                    onClick={() => onNavigate('settings')}
                    className={clsx(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all duration-150 cursor-pointer font-medium hover:translate-x-0.5 text-left",
                      activePage === 'settings'
                        ? "bg-spatio-primary/15 text-spatio-primary font-semibold"
                        : "text-slate-400 dark:text-slate-300 hover:text-slate-100 hover:bg-slate-300/10 dark:hover:bg-white/5"
                    )}
                  >
                    <span className="shrink-0"><Settings size={15} /></span>
                    <span className="flex-1 text-left truncate">{t('nav_settings')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </nav>

      {/* Class Interval Settings (อันตภาคชั้น) */}
      {!collapsed && rawRows.length > 0 && colorMode !== 'custom' && geoMode === 'admin' && (displayMode === 'choropleth' || displayMode === 'bubble') && (
        <div className="mx-2.5 my-1 p-3 rounded-xl border border-slate-300/40 bg-slate-100/35 dark:bg-slate-950/60 dark:border-slate-800/35 backdrop-blur-md flex flex-col gap-3 select-none animate-fade-in shrink-0">
          <div className="flex items-center gap-1.5 pb-2 border-b border-slate-300/50 dark:border-slate-700/50">
            <Palette size={14} className="text-indigo-400" />
            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              {t('settings_palette')} / อันตภาคชั้น
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-600 dark:text-slate-300 w-12 font-medium shrink-0">จำนวนชั้น:</span>
              <div className="flex-1 flex items-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded overflow-hidden h-6.5 select-none">
                <button
                  type="button"
                  onClick={() => numClasses > 3 && setNumClasses(numClasses - 1)}
                  disabled={numClasses <= 3}
                  className={clsx(
                    "w-8 h-full flex items-center justify-center border-r border-slate-300 dark:border-slate-700 text-xs font-bold transition-all active:bg-black/5 dark:active:bg-white/5 cursor-pointer",
                    numClasses <= 3 ? "text-slate-300 dark:text-slate-600 cursor-not-allowed" : "text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10"
                  )}
                >
                  -
                </button>
                <div className="flex-1 text-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {numClasses} ชั้น
                </div>
                <button
                  type="button"
                  onClick={() => numClasses < 8 && setNumClasses(numClasses + 1)}
                  disabled={numClasses >= 8}
                  className={clsx(
                    "w-8 h-full flex items-center justify-center border-l border-slate-300 dark:border-slate-700 text-xs font-bold transition-all active:bg-black/5 dark:active:bg-white/5 cursor-pointer",
                    numClasses >= 8 ? "text-slate-300 dark:text-slate-600 cursor-not-allowed" : "text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10"
                  )}
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 relative">
              <span className="text-[10px] text-slate-600 dark:text-slate-300 w-12 font-medium shrink-0">ชุดสี:</span>
              <div className="flex-1 relative">
                <button
                  type="button"
                  onClick={() => setPaletteOpen(!paletteOpen)}
                  className="w-full flex items-center justify-between gap-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs px-2 py-1 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer hover:border-slate-400 dark:hover:border-slate-600 transition-colors"
                  title={palette === 'Custom' ? 'Custom' : palette}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {palette === 'Custom' ? (
                      <div className="w-full h-3 rounded bg-gradient-to-r from-red-500 via-emerald-400 to-blue-500 shrink-0 shadow-sm animate-fade-in" />
                    ) : (
                      <div className="flex w-full h-3 rounded overflow-hidden shrink-0 shadow-sm animate-fade-in">
                        {(COLOR_PALETTES[palette] || []).map((color, idx) => (
                          <div key={idx} className="flex-1 h-full" style={{ backgroundColor: color }} />
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[8px] text-slate-400 dark:text-slate-500 shrink-0">▼</span>
                </button>

                {paletteOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-[1999]"
                      onClick={() => setPaletteOpen(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl py-1 z-[2000] max-h-48 overflow-y-auto flex flex-col gap-0.5 animate-fade-in">
                      {Object.keys(COLOR_PALETTES).map((p) => {
                        const colors = COLOR_PALETTES[p] || []
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              setPalette(p as ColorPalette)
                              setPaletteOpen(false)
                            }}
                            className={clsx(
                              "w-full flex items-center px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer",
                              palette === p && "bg-slate-100 dark:bg-slate-800"
                            )}
                            title={p}
                          >
                            <div className="flex w-full h-3 rounded overflow-hidden shrink-0 shadow-sm">
                              {colors.map((color, idx) => (
                                <div key={idx} className="flex-1 h-full" style={{ backgroundColor: color }} />
                              ))}
                            </div>
                          </button>
                        )
                      })}

                      <button
                        type="button"
                        onClick={() => {
                          setPalette('Custom')
                          setPaletteOpen(false)
                        }}
                        className={clsx(
                          "w-full flex items-center px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer",
                          palette === 'Custom' && "bg-slate-100 dark:bg-slate-800"
                        )}
                        title="Custom (กำหนดสีเอง)"
                      >
                        <div className="w-full h-3 rounded bg-gradient-to-r from-red-500 via-emerald-400 to-blue-500 shrink-0 shadow-sm" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {displayMode === 'bubble' && (
              <div className="w-full flex items-center gap-2 mt-1 select-none animate-fade-in border-t border-slate-300/30 dark:border-slate-700/30 pt-2 pb-1">
                <span className="text-[10px] text-slate-600 dark:text-slate-300 w-12 font-medium shrink-0">
                  {t('exp_bubble_size')}:
                </span>
                <div className="flex-1 flex items-center pr-1.5 min-w-0">
                  <input
                    type="range"
                    min="0.2"
                    max="1.8"
                    step="0.1"
                    value={bubbleScale}
                    onChange={(e) => setBubbleScale(parseFloat(e.target.value))}
                    className="w-full flex-1 min-w-0 h-1 accent-indigo-500 cursor-pointer appearance-none bg-slate-300 dark:bg-slate-700 rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:shadow"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex justify-between items-center pr-1">
                <span className="text-[9px] font-bold text-slate-700 dark:text-slate-200">กำหนดค่าช่วง (Breaks)</span>
                {isBreaksCustomized && (
                  <button
                    type="button"
                    onClick={resetBreaks}
                    className="text-[9px] font-semibold text-indigo-500 hover:text-indigo-650 dark:hover:text-indigo-400 cursor-pointer select-none transition-colors border-0 bg-transparent p-0"
                  >
                    รีเซ็ต
                  </button>
                )}
              </div>

              {/* Show Null in Legend toggle */}
              <div className="flex items-center justify-between p-1.5 rounded bg-slate-500/5 border border-spatio-border/20 mb-2">
                <span className="text-[9.5px] text-slate-600 dark:text-slate-400 font-medium">
                  แสดงพื้นที่ 0 / null ในคำอธิบาย:
                </span>
                <input
                  type="checkbox"
                  checked={showLegendZeroRow}
                  onChange={(e) => setShowLegendZeroRow(e.target.checked)}
                  className="w-3.5 h-3.5 accent-indigo-500 rounded cursor-pointer shrink-0"
                />
              </div>

              {/* Grid of breaks */}
              <div className="grid grid-cols-[16px_1fr_10px_1fr] gap-x-2 gap-y-1.5 items-center mt-1">
                {globalBreaks.map((b, i) => {
                  const rangeStart = i === 0 
                    ? breaksStart 
                    : getNextStartValue(globalBreaks[i - 1])
                  
                  return (
                    <React.Fragment key={i}>
                      {/* Column 1: Swatch / Color Picker */}
                      <div>
                        {palette === 'Custom' ? (
                          <input 
                            type="color" 
                            value={customColors[i] ?? '#cccccc'}
                            onChange={(e) => {
                              const newColors = [...customColors]
                              newColors[i] = e.target.value
                              setCustomColors(newColors)
                            }}
                            className="w-4 h-4 p-0 border-0 rounded cursor-pointer shrink-0 block"
                          />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded border border-slate-400/30 dark:border-slate-500/30 shrink-0" 
                               style={{ backgroundColor: COLOR_PALETTES[palette]?.[i] ?? COLOR_PALETTES[palette]?.[COLOR_PALETTES[palette]?.length - 1] ?? '#ccc' }} 
                          />
                        )}
                      </div>

                      {/* Column 2: Range Start (Editable for first row, read-only for others) */}
                      {i === 0 ? (
                        <input
                          type="number"
                          step="any"
                          value={breaksStart}
                          onChange={(e) => setBreaksStart(Number(e.target.value))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-md text-[10.5px] px-1 py-0.5 text-slate-700 dark:text-slate-300 text-center font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      ) : (
                        <div className="w-full bg-slate-100/50 dark:bg-slate-900/35 border border-slate-200/50 dark:border-slate-800/50 rounded-md text-[10.5px] px-1 py-0.5 text-slate-500 dark:text-slate-400 text-center font-semibold select-none truncate" title={rangeStart.toString()}>
                          {rangeStart.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 10 })}
                        </div>
                      )}

                      {/* Column 3: Separator */}
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 text-center font-medium">
                        –
                      </span>

                      {/* Column 4: Input for End Value */}
                      <input
                        type="number"
                        value={b}
                        onChange={(e) => {
                          const newBreaks = [...globalBreaks]
                          newBreaks[i] = Number(e.target.value)
                          setGlobalBreaks(newBreaks)
                        }}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-md text-[10.5px] px-1.5 py-0.5 text-slate-700 dark:text-slate-300 text-center font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </React.Fragment>
                  )
                })}

                {/* Overflow row (> maxBreak) */}
                {globalBreaks.length > 0 && (
                  <React.Fragment>
                    {/* Column 1: Swatch */}
                    <div>
                      {palette === 'Custom' ? (
                        <input
                          type="color"
                          value={customColors[globalBreaks.length] ?? '#cccccc'}
                          onChange={(e) => {
                            const newColors = [...customColors]
                            newColors[globalBreaks.length] = e.target.value
                            setCustomColors(newColors)
                          }}
                          className="w-4 h-4 p-0 border-0 rounded cursor-pointer shrink-0 block"
                        />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded border border-slate-400/30 dark:border-slate-500/30 shrink-0"
                          style={{ backgroundColor: COLOR_PALETTES[palette]?.[globalBreaks.length] ?? COLOR_PALETTES[palette]?.[COLOR_PALETTES[palette]?.length - 1] ?? '#ccc' }}
                        />
                      )}
                    </div>

                    {/* Column 2: Label for overflow */}
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 text-center font-bold font-mono block">
                      &gt;
                    </span>

                    {/* Column 3: Empty separator space */}
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 text-center font-medium"></span>

                    {/* Column 4: Label of value */}
                    <div className="w-full bg-slate-100/50 dark:bg-slate-900/35 border border-slate-200/50 dark:border-slate-800/50 rounded-md text-[10.5px] px-1.5 py-0.5 text-slate-500 dark:text-slate-400 text-center font-semibold select-none truncate" title={globalBreaks[globalBreaks.length - 1].toString()}>
                      {globalBreaks[globalBreaks.length - 1].toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 10 })}
                    </div>
                  </React.Fragment>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Community Radius Settings for Coordinate Mode */}
      {!collapsed && rawRows.length > 0 && geoMode === 'coordinate' && (
        <div className="mx-2.5 my-1 p-3 rounded-xl border border-slate-300/40 bg-slate-100/35 dark:bg-slate-950/60 dark:border-slate-800/35 backdrop-blur-md flex flex-col gap-3 select-none animate-fade-in shrink-0">
          <div className="flex items-center gap-1.5 pb-2 border-b border-slate-300/50 dark:border-slate-700/50">
            <Palette size={14} className="text-blue-400" />
            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              {t('settings_radius') || 'รัศมีรอบพิกัด'} / ขอบเขตชุมชน
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[10px] font-medium text-slate-600 dark:text-slate-300">
                <span>รัศมีขอบเขต:</span>
                <span className="font-mono font-bold text-indigo-500">
                  {pointRadiusBuffer > 0 ? `${pointRadiusBuffer.toLocaleString()} เมตร` : 'ปิด'}
                </span>
              </div>
              <div className="flex items-center pr-1.5 min-w-0">
                <input
                  type="range"
                  min="0"
                  max="5000"
                  step="100"
                  value={pointRadiusBuffer}
                  onChange={(e) => setPointRadiusBuffer(Number(e.target.value))}
                  className="w-full flex-1 min-w-0 h-1.5 accent-indigo-500 cursor-pointer appearance-none bg-slate-300 dark:bg-slate-700 rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:shadow"
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-4 gap-1 mt-1">
              {[
                { label: 'ปิด', value: 0 },
                { label: '500m', value: 500 },
                { label: '1km', value: 1000 },
                { label: '2km', value: 2000 },
              ].map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPointRadiusBuffer(p.value)}
                  className={clsx(
                    "text-[9px] font-semibold py-1 rounded transition-colors select-none cursor-pointer border text-center",
                    pointRadiusBuffer === p.value
                      ? "bg-indigo-500 text-white border-indigo-500 shadow-sm font-bold"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:bg-black/5 dark:hover:bg-white/5"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Spacer to push elements below down */}
      <div className="flex-1" />

      {/* Spatio Epidemiologist Assistant (SEA) */}
      {!collapsed ? (
        <div className="mx-2.5 my-3 p-3 rounded-xl border border-slate-300/40 bg-slate-100/35 dark:bg-slate-950/60 dark:border-slate-800/35 backdrop-blur-md flex flex-col gap-2.5 select-none animate-fade-in shrink-0">
          {/* Active Dataset Panel */}
          <div className="flex flex-col gap-1.5 pb-2.5 border-b border-slate-300/50 dark:border-slate-700/50">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                {rawRows.length > 0 ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-500"></span>
                )}
              </span>
              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                {rawRows.length > 0 ? t('status_ready') : t('status_no_data')}
              </span>
            </div>
            {rawRows.length > 0 && datasets.length > 0 ? (
              <div className="flex gap-2 items-start mt-0.5">
                <Database size={14} className="text-blue-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate" title={activeDataset?.fileName}>
                    {activeDataset?.fileName}
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-300 leading-normal mt-0.5">
                    {rawRows.length.toLocaleString()} {t('level_province') === 'จังหวัด' ? 'แถว' : 'rows'} ({periods.length} {t('level_province') === 'จังหวัด' ? 'ช่วงเวลา' : 'periods'})
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-slate-600 dark:text-slate-300 italic mt-0.5 leading-relaxed">
                {t('sidebar_import_prompt')}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Collapsed Mode Assistant Widget - Premium Floating Popover Tooltips */
        <div className="flex flex-col gap-2 py-3 border-t border-slate-300/80 dark:border-slate-800/80 items-center justify-center shrink-0">
          {/* Active Data Compact Indicator / Database Icon */}
          <div className="relative group cursor-pointer flex items-center justify-center w-8 h-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all">
            <Database size={16} className={rawRows.length > 0 ? 'text-emerald-400' : 'text-slate-500'} />
            {rawRows.length > 0 && (
              <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
            )}

            {/* Popover Floating Card */}
            <div className="absolute left-[65px] bottom-0 w-60 p-3 rounded-xl border border-slate-300/60 bg-slate-50/95 dark:border-slate-700/60 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[3000] flex flex-col gap-1.5 pointer-events-none select-none text-left">
              <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                {t('compact_active_data')}
              </div>
              {rawRows.length > 0 && datasets.length > 0 ? (
                <>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                    {activeDataset?.fileName}
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-300 leading-tight">
                    {t('compact_rows', { count: rawRows.length.toLocaleString() })}
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-300 leading-tight">
                    {t('compact_periods', { count: periods.length })}
                  </div>
                </>
              ) : (
                <div className="text-[10px] text-slate-600 dark:text-slate-400 italic">
                  {t('compact_no_data')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>

      {/* Collapse Toggle */}
      <div className="p-2 border-t border-spatio-border">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center py-2 rounded-lg
                     text-spatio-muted hover:text-spatio-text hover:bg-black/5 dark:hover:bg-white/5
                     transition-all duration-150"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  )
}
