import { type DateMode } from '../data/dateParser'

export interface DateModeInfo {
  label: string
  labelEn: string
  translationKey: string
}

export const DATE_MODE_CONFIG: Record<DateMode, DateModeInfo> = {
  daily: {
    label: 'รายวัน',
    labelEn: 'Daily',
    translationKey: 'exp_time_daily'
  },
  weekly: {
    label: 'รายสัปดาห์ (ISO)',
    labelEn: 'Weekly (ISO)',
    translationKey: 'exp_time_weekly_iso'
  },
  weekly_epi: {
    label: 'รายสัปดาห์ (EPI)',
    labelEn: 'Weekly (EPI)',
    translationKey: 'exp_time_weekly_epi'
  },
  monthly: {
    label: 'รายเดือน',
    labelEn: 'Monthly',
    translationKey: 'exp_time_monthly'
  },
  quarterly: {
    label: 'รายไตรมาส',
    labelEn: 'Quarterly',
    translationKey: 'exp_time_quarterly'
  },
  quarterly_fiscal: {
    label: 'รายไตรมาส (ปีงบประมาณ)',
    labelEn: 'Quarterly (Fiscal)',
    translationKey: 'exp_time_quarterly_fiscal'
  },
  yearly: {
    label: 'รายปี',
    labelEn: 'Yearly',
    translationKey: 'exp_time_yearly'
  },
  yearly_fiscal: {
    label: 'รายปีงบประมาณ',
    labelEn: 'Yearly (Fiscal)',
    translationKey: 'exp_time_yearly_fiscal'
  }
}

export function getDateModeLabel(mode: DateMode, isTh: boolean = true): string {
  const config = DATE_MODE_CONFIG[mode]
  if (!config) return mode
  return isTh ? config.label : config.labelEn
}
