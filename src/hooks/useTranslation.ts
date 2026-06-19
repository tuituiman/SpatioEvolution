import { useAppStore } from '../store/useAppStore'
import { th, type TranslationKey } from '../locales/th'
import { en } from '../locales/en'

const dictionaries = {
  th,
  en
}

export function useTranslation() {
  const language = useAppStore(state => state.language)
  const dict = dictionaries[language] || dictionaries.th

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    let val = dict[key] || th[key] || key
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        val = val.replace(new RegExp(`{${k}}`, 'g'), String(v))
      })
    }
    return val
  }

  return { t, language }
}
