import { useAppStore } from '../store/useAppStore'
import { useTranslation } from '../hooks/useTranslation'

export function Settings() {
  const { t } = useTranslation()
  const {
    theme, setTheme,
    language, setLanguage,
    scaleStatsToRange, setScaleStatsToRange
  } = useAppStore()

  return (
    <div className="p-6 h-full overflow-auto animate-fade-in bg-spatio-bg text-spatio-text transition-colors">
      <div className="max-w-[600px] space-y-4">

        {/* Appearance Settings */}
        <div className="spatio-card bg-spatio-surface border border-spatio-border p-4 rounded-xl shadow-lg transition-colors">
          <h3 className="text-sm font-semibold mb-3">{t('settings_appearance')}</h3>
          <div className="space-y-3 text-sm text-spatio-muted">
            <div className="flex items-center justify-between">
              <span>{t('settings_theme')}</span>
              <select
                className="spatio-input w-36 text-xs transition-colors"
                value={theme}
                onChange={e => setTheme(e.target.value as any)}
              >
                <option value="dark">{t('theme_dark')}</option>
                <option value="light">{t('theme_light')}</option>
                <option value="system">{t('theme_system')}</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span>{t('settings_language')}</span>
              <select
                className="spatio-input w-36 text-xs transition-colors"
                value={language}
                onChange={e => setLanguage(e.target.value as any)}
              >
                <option value="th">{t('lang_th')}</option>
                <option value="en">{t('lang_en')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Map Statistics Settings */}
        <div className="spatio-card bg-spatio-surface border border-spatio-border p-4 rounded-xl shadow-lg transition-colors">
          <h3 className="text-sm font-semibold mb-3">{t('settings_analysis')}</h3>
          <div className="space-y-3 text-sm text-spatio-muted">
            <div className="flex items-center justify-between gap-4">
              <span className="leading-snug pr-2">{t('settings_scale_stats')}</span>
              <button
                onClick={() => setScaleStatsToRange(!scaleStatsToRange)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  scaleStatsToRange ? 'bg-spatio-primary' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    scaleStatsToRange ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="spatio-card bg-spatio-surface border border-spatio-border p-4 rounded-xl shadow-lg transition-colors flex items-center justify-between gap-6">
          <div className="flex-1">
            <h3 className="text-sm font-semibold mb-3">{t('settings_about')}</h3>
            <div className="text-xs text-spatio-muted leading-relaxed">
              <div className="whitespace-nowrap">
                {t('about_desc1')}<br />
                {t('about_desc2')}<br />
                {t('about_desc3')}<br />
                {t('about_desc4')}
              </div>
              <div className="mt-4 text-[10px] opacity-85 whitespace-normal max-w-[260px] leading-normal font-medium">
                {t('about_developed_by').includes(' : ') ? (
                  <>
                    <span className="font-bold text-spatio-text/90">{t('about_developed_by').split(' : ')[0]}:</span>
                    <div className="mt-1">{t('about_developed_by').split(' : ')[1]}</div>
                  </>
                ) : (
                  t('about_developed_by')
                )}
              </div>
            </div>
          </div>
          <div className="shrink-0 flex items-center justify-end w-[280px] h-[170px]">
            <img 
              src={`${import.meta.env.BASE_URL}SpatioEvolution_logo.png`} 
              alt="SpatioEvolution" 
              className="max-w-full max-h-full object-contain" 
            />
          </div>
        </div>

      </div>
    </div>
  )
}
