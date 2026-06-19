import React from 'react'
import { X, Download, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import type { DateMode } from '../../data/dateParser'
import { useTranslation } from '../../hooks/useTranslation'

interface ExportModalProps {
  isExportOpen: boolean
  setIsExportOpen: (open: boolean) => void
  exportTimeMode: DateMode
  setExportTimeMode: (mode: DateMode) => void
  exportAdminFormat: 'thai' | 'code'
  setExportAdminFormat: (format: 'thai' | 'code') => void
  exportLayoutFormat: 'wide' | 'long'
  setExportLayoutFormat: (format: 'wide' | 'long') => void
  isExporting: boolean
  handleExportLineListing: () => void
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isExportOpen,
  setIsExportOpen,
  exportTimeMode,
  setExportTimeMode,
  exportAdminFormat,
  setExportAdminFormat,
  exportLayoutFormat,
  setExportLayoutFormat,
  isExporting,
  handleExportLineListing
}) => {
  const { t, language } = useTranslation()

  if (!isExportOpen) return null

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="spatio-card w-full max-w-md border border-spatio-border p-6 space-y-5 bg-spatio-surface shadow-2xl relative text-spatio-text">
        <button
          onClick={() => setIsExportOpen(false)}
          className="absolute top-4 right-4 text-spatio-muted hover:text-spatio-text transition-colors p-1 rounded-lg bg-spatio-surface-alt hover:bg-spatio-border cursor-pointer"
        >
          <X size={14} />
        </button>

        <div className="flex items-center gap-2 pb-2 border-b border-spatio-border">
          <Download className="text-indigo-500 dark:text-indigo-400" size={18} />
          <h3 className="text-base font-bold text-spatio-text">{t('ex_modal_title')}</h3>
        </div>

        <div className="space-y-4 text-xs">
          {/* Time grouping */}
          <div>
            <label className="text-[11px] text-spatio-muted block mb-1.5 font-semibold">{t('ex_time_grouping')}</label>
            <div className="grid grid-cols-3 gap-2">
              {(['daily', 'weekly', 'monthly'] as DateMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setExportTimeMode(mode)}
                  className={clsx(
                    'py-1.5 text-center rounded border font-medium transition-all capitalize cursor-pointer',
                    exportTimeMode === mode 
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow' 
                      : 'bg-spatio-surface border-spatio-border text-spatio-muted hover:text-spatio-text'
                  )}
                >
                  {mode === 'daily' 
                    ? (language === 'th' ? 'รายวัน' : 'Daily') 
                    : (mode === 'weekly' 
                        ? (language === 'th' ? 'รายสัปดาห์' : 'Weekly') 
                        : (language === 'th' ? 'รายเดือน' : 'Monthly'))}
                </button>
              ))}
            </div>
          </div>

          {/* Administrative name format */}
          <div>
            <label className="text-[11px] text-spatio-muted block mb-1.5 font-semibold">{t('ex_col_format')}</label>
            <div className="flex gap-2">
              <button
                onClick={() => setExportAdminFormat('thai')}
                className={clsx(
                  'flex-1 py-2 text-center rounded border font-medium transition-all cursor-pointer',
                  exportAdminFormat === 'thai' 
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow' 
                    : 'bg-spatio-surface border-spatio-border text-spatio-muted hover:text-spatio-text'
                )}
              >
                {t('ex_admin_name')}
              </button>
              <button
                onClick={() => setExportAdminFormat('code')}
                className={clsx(
                  'flex-1 py-2 text-center rounded border font-medium transition-all cursor-pointer',
                  exportAdminFormat === 'code' 
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow' 
                    : 'bg-spatio-surface border-spatio-border text-spatio-muted hover:text-spatio-text'
                )}
              >
                {t('ex_admin_code')}
              </button>
            </div>
          </div>

          {/* Wide vs Long export format */}
          <div>
            <label className="text-[11px] text-spatio-muted block mb-1.5 font-semibold">
              {t('ex_layout_format')}
            </label>
            <div className="space-y-2">
              <label
                onClick={() => setExportLayoutFormat('wide')}
                className={clsx(
                  'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                  exportLayoutFormat === 'wide' 
                    ? 'border-indigo-600 dark:border-indigo-500/70 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-950 dark:text-white' 
                    : 'border-spatio-border bg-spatio-surface-alt text-spatio-muted hover:bg-black/5 dark:hover:bg-white/5'
                )}
              >
                <input
                  type="radio"
                  name="modal-export-layout"
                  checked={exportLayoutFormat === 'wide'}
                  onChange={() => setExportLayoutFormat('wide')}
                  className="mt-0.5 accent-indigo-500 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-spatio-text text-[11px] block">{t('tbl_wide_matrix')}</span>
                  <span className="text-[10px] text-spatio-muted mt-0.5 block leading-normal">
                    {t('ex_layout_wide')}
                  </span>
                </div>
              </label>

              <label
                onClick={() => setExportLayoutFormat('long')}
                className={clsx(
                  'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                  exportLayoutFormat === 'long' 
                    ? 'border-indigo-600 dark:border-indigo-500/70 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-950 dark:text-white' 
                    : 'border-spatio-border bg-spatio-surface-alt text-spatio-muted hover:bg-black/5 dark:hover:bg-white/5'
                )}
              >
                <input
                  type="radio"
                  name="modal-export-layout"
                  checked={exportLayoutFormat === 'long'}
                  onChange={() => setExportLayoutFormat('long')}
                  className="mt-0.5 accent-indigo-500 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-spatio-text text-[11px] block">{t('tbl_long_list')}</span>
                  <span className="text-[10px] text-spatio-muted mt-0.5 block leading-normal">
                    {t('ex_layout_long')}
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-3 border-t border-spatio-border text-xs">
          <button
            onClick={() => setIsExportOpen(false)}
            className="flex-1 py-2.5 rounded-lg border border-spatio-border text-spatio-muted hover:text-spatio-text transition-colors bg-spatio-surface cursor-pointer"
          >
            {t('ex_cancel')}
          </button>
          <button
            onClick={handleExportLineListing}
            disabled={isExporting}
            className="flex-1 py-2.5 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all shadow-indigo-950/30 cursor-pointer"
          >
            {isExporting ? (
              <>
                <RefreshCw className="animate-spin" size={12} />
                <span>กำลังนำออก...</span>
              </>
            ) : (
              <>
                <Download size={12} />
                <span>ดาวน์โหลดสรุป</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
