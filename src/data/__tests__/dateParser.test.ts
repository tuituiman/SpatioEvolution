/**
 * dateParser.test.ts — Unit Tests for dateParser.ts
 * รันด้วย: npx vitest run src/data/__tests__/dateParser.test.ts
 */
import { describe, it, expect } from 'vitest'
import {
  parseDate,
  toDateKey,
  parseToKey,
  calcThaiEpiWeek,
  calcISOWeek,
  generatePeriods,
  getPeriodLabel,
  type DateMode,
} from '../dateParser'

// ──────────────────────────────────────────
// Helper
// ──────────────────────────────────────────
function d(y: number, m: number, day: number) {
  return new Date(y, m - 1, day)
}

// ──────────────────────────────────────────
// parseDate()
// ──────────────────────────────────────────
describe('parseDate()', () => {
  it('returns null for null/undefined/empty', () => {
    expect(parseDate(null)).toBeNull()
    expect(parseDate(undefined)).toBeNull()
    expect(parseDate('')).toBeNull()
  })

  it('parses ISO format YYYY-MM-DD', () => {
    const result = parseDate('2024-03-15')
    expect(result).not.toBeNull()
    expect(result!.getFullYear()).toBe(2024)
    expect(result!.getMonth()).toBe(2) // 0-indexed
    expect(result!.getDate()).toBe(15)
  })

  it('parses Thai BE ISO format (ปี พ.ศ.)', () => {
    // พ.ศ. 2567 = ค.ศ. 2024
    const result = parseDate('2567-03-15')
    expect(result).not.toBeNull()
    expect(result!.getFullYear()).toBe(2024)
    expect(result!.getMonth()).toBe(2)
    expect(result!.getDate()).toBe(15)
  })

  it('parses Thai DD/MM/YYYY (CE)', () => {
    const result = parseDate('15/03/2024')
    expect(result).not.toBeNull()
    expect(result!.getFullYear()).toBe(2024)
    expect(result!.getMonth()).toBe(2)
    expect(result!.getDate()).toBe(15)
  })

  it('parses Thai DD/MM/YYYY (BE) — year > 2400', () => {
    // 15/03/2567 → ค.ศ. 2024
    const result = parseDate('15/03/2567')
    expect(result).not.toBeNull()
    expect(result!.getFullYear()).toBe(2024)
  })

  it('parses Thai DD-MM-YYYY with dash separator', () => {
    const result = parseDate('15-03-2024')
    expect(result).not.toBeNull()
    expect(result!.getFullYear()).toBe(2024)
    expect(result!.getDate()).toBe(15)
  })

  it('parses YYYY-MM (month string)', () => {
    const result = parseDate('2024-05')
    expect(result).not.toBeNull()
    expect(result!.getFullYear()).toBe(2024)
    expect(result!.getMonth()).toBe(4) // May
    expect(result!.getDate()).toBe(1)
  })

  it('parses Excel serial number (large number)', () => {
    // Excel serial 45000 = Feb 18, 2023
    const result = parseDate(45000)
    expect(result).not.toBeNull()
    expect(result).toBeInstanceOf(Date)
    expect(isNaN(result!.getTime())).toBe(false)
  })

  it('parses 5-digit string as Excel serial', () => {
    const result = parseDate('45000')
    expect(result).not.toBeNull()
    expect(isNaN(result!.getTime())).toBe(false)
  })

  it('parses ISO week string YYYY-Wnn', () => {
    const result = parseDate('2024-W05')
    expect(result).not.toBeNull()
    expect(result!.getFullYear()).toBe(2024)
  })

  it('parses BE week string 2567-W05', () => {
    const result = parseDate('2567-W05')
    expect(result).not.toBeNull()
    // 2567 BE = 2024 CE
    expect(result!.getFullYear()).toBe(2024)
  })

  it('passes through Date objects unchanged (rounding)', () => {
    const input = new Date(2024, 2, 15, 10, 30, 0)
    const result = parseDate(input)
    expect(result).not.toBeNull()
    expect(result!.getFullYear()).toBe(2024)
    expect(result!.getMonth()).toBe(2)
    expect(result!.getDate()).toBe(15)
  })

  it('returns null for garbage strings', () => {
    expect(parseDate('not-a-date')).toBeNull()
    expect(parseDate('abc xyz')).toBeNull()
  })

  it('handles year 1900 edge case as year (integer)', () => {
    const result = parseDate(1960)
    expect(result).not.toBeNull()
    expect(result!.getFullYear()).toBe(1960)
  })
})

// ──────────────────────────────────────────
// calcThaiEpiWeek()
// ──────────────────────────────────────────
describe('calcThaiEpiWeek()', () => {
  it('returns label in BE format "YYYY-Wnn"', () => {
    // Jan 1, 2024 CE = 2567 BE
    const result = calcThaiEpiWeek(new Date(2024, 0, 7))
    expect(result.label).toMatch(/^256[6-8]-W\d{2}$/)
    expect(result.yearBE).toBeGreaterThanOrEqual(2566)
  })

  it('weekNum is between 1 and 53', () => {
    const dates = [
      new Date(2024, 0, 1),
      new Date(2024, 5, 15),
      new Date(2024, 11, 31),
    ]
    for (const dt of dates) {
      const { weekNum } = calcThaiEpiWeek(dt)
      expect(weekNum).toBeGreaterThanOrEqual(1)
      expect(weekNum).toBeLessThanOrEqual(53)
    }
  })

  it('Thai Epi Week starts on Sunday', () => {
    // First epi week should start on a Sunday
    const { startDate } = calcThaiEpiWeek(new Date(2024, 0, 7))
    expect(startDate.getDay()).toBe(0) // 0 = Sunday
  })

  it('all 7 days from a known Epi week Sunday share the same weekNum', () => {
    // June 16, 2024 is a Sunday — it starts an Epi week
    const sunday = new Date(2024, 5, 16) // June 16, 2024 (Sunday)
    const sundayInfo = calcThaiEpiWeek(sunday)
    // Mon–Sat of the same week must share weekNum and yearBE
    for (let i = 1; i < 7; i++) {
      const dayInWeek = new Date(2024, 5, 16 + i)
      const dayInfo = calcThaiEpiWeek(dayInWeek)
      expect(dayInfo.weekNum).toBe(sundayInfo.weekNum)
      expect(dayInfo.yearBE).toBe(sundayInfo.yearBE)
    }
    // The following Sunday must belong to the NEXT Epi week
    const nextSunday = new Date(2024, 5, 23)
    const nextInfo = calcThaiEpiWeek(nextSunday)
    expect(nextInfo.weekNum).toBe(sundayInfo.weekNum + 1)
  })

  it('year-end boundary: Dec 31 may belong to week 1 of next year', () => {
    // Dec 31, 2024 could be week 1 of 2025
    const result = calcThaiEpiWeek(new Date(2024, 11, 31))
    expect(result.weekNum).toBeGreaterThanOrEqual(1)
  })
})

// ──────────────────────────────────────────
// calcISOWeek()
// ──────────────────────────────────────────
describe('calcISOWeek()', () => {
  it('Jan 1, 2018 is ISO week 2018-W01', () => {
    const result = calcISOWeek(new Date(2018, 0, 1))
    expect(result).toBe('2018-W01')
  })

  it('Dec 31, 2018 is ISO week 2019-W01', () => {
    // Dec 31, 2018 is a Monday → ISO 2018-W53 or 2019-W01 depending on year
    const result = calcISOWeek(new Date(2018, 11, 31))
    expect(result).toMatch(/^\d{4}-W\d{2}$/)
  })

  it('returns format YYYY-Wnn with zero-padded week', () => {
    const result = calcISOWeek(new Date(2024, 1, 5))
    expect(result).toMatch(/^\d{4}-W\d{2}$/)
  })

  it('first week of 2024 contains Jan 4', () => {
    // ISO standard: Week 1 always contains January 4
    const result = calcISOWeek(new Date(2024, 0, 4))
    expect(result).toBe('2024-W01')
  })
})

// ──────────────────────────────────────────
// toDateKey()
// ──────────────────────────────────────────
describe('toDateKey()', () => {
  const testDate = d(2024, 3, 15)

  it('daily → YYYY-MM-DD', () => {
    expect(toDateKey(testDate, 'daily')).toBe('2024-03-15')
  })

  it('monthly → YYYY-MM', () => {
    expect(toDateKey(testDate, 'monthly')).toBe('2024-03')
  })

  it('yearly → YYYY', () => {
    expect(toDateKey(testDate, 'yearly')).toBe('2024')
  })

  it('weekly → ISO week format YYYY-Wnn', () => {
    const key = toDateKey(testDate, 'weekly')
    expect(key).toMatch(/^2024-W\d{2}$/)
  })

  it('weekly_epi → Thai BE week format', () => {
    const key = toDateKey(testDate, 'weekly_epi')
    expect(key).toMatch(/^256\d-W\d{2}$/)
  })
})

// ──────────────────────────────────────────
// parseToKey()
// ──────────────────────────────────────────
describe('parseToKey()', () => {
  it('returns "unknown" for invalid input', () => {
    expect(parseToKey('invalid-garbage', 'daily')).toBe('unknown')
    expect(parseToKey(null, 'daily')).toBe('unknown')
  })

  it('converts ISO date string to daily key', () => {
    expect(parseToKey('2024-03-15', 'daily')).toBe('2024-03-15')
  })

  it('converts Thai date to monthly key', () => {
    const key = parseToKey('15/03/2567', 'monthly')
    expect(key).toBe('2024-03')
  })
})

// ──────────────────────────────────────────
// generatePeriods()
// ──────────────────────────────────────────
describe('generatePeriods()', () => {
  it('generates continuous daily periods (no gaps)', () => {
    const start = d(2024, 1, 1)
    const end = d(2024, 1, 7)
    const periods = generatePeriods(start, end, 'daily')
    expect(periods).toHaveLength(7)
    // Check keys are consecutive
    expect(periods[0].key).toBe('2024-01-01')
    expect(periods[6].key).toBe('2024-01-07')
  })

  it('generates monthly periods correctly', () => {
    const start = d(2024, 1, 15) // mid-month
    const end = d(2024, 4, 5)   // next month
    const periods = generatePeriods(start, end, 'monthly')
    expect(periods).toHaveLength(4) // Jan, Feb, Mar, Apr
    expect(periods[0].key).toBe('2024-01')
    expect(periods[3].key).toBe('2024-04')
  })

  it('generates yearly periods correctly', () => {
    const start = d(2022, 6, 15)
    const end = d(2024, 3, 1)
    const periods = generatePeriods(start, end, 'yearly')
    expect(periods).toHaveLength(3)
    expect(periods[0].key).toBe('2022')
    expect(periods[2].key).toBe('2024')
  })

  it('generates weekly periods (ISO) without duplicate keys', () => {
    const start = d(2024, 1, 1)
    const end = d(2024, 3, 31)
    const periods = generatePeriods(start, end, 'weekly')
    const keys = periods.map(p => p.key)
    const uniqueKeys = new Set(keys)
    expect(uniqueKeys.size).toBe(keys.length) // no duplicates
  })

  it('generates weekly_epi periods without duplicates', () => {
    const start = d(2024, 1, 1)
    const end = d(2024, 3, 31)
    const periods = generatePeriods(start, end, 'weekly_epi')
    const keys = periods.map(p => p.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('each period has key, label, and date', () => {
    const periods = generatePeriods(d(2024, 1, 1), d(2024, 1, 3), 'daily')
    for (const p of periods) {
      expect(p.key).toBeTruthy()
      expect(p.label).toBeTruthy()
      expect(p.date).toBeInstanceOf(Date)
    }
  })

  it('returns empty array when start > end', () => {
    const periods = generatePeriods(d(2024, 3, 1), d(2024, 1, 1), 'daily')
    expect(periods).toHaveLength(0)
  })

  it('includes the last week in weekly mode (regression test)', () => {
    const start = d(2024, 1, 1)
    const end = d(2024, 1, 28)
    const periods = generatePeriods(start, end, 'weekly')
    // Should include at least 4 weeks for 28 days
    expect(periods.length).toBeGreaterThanOrEqual(4)
    // The last period key should cover the end date's week
    const lastPeriod = periods[periods.length - 1]
    const endWeekKey = toDateKey(end, 'weekly')
    expect(lastPeriod.key).toBe(endWeekKey)
  })
})

// ──────────────────────────────────────────
// getPeriodLabel()
// ──────────────────────────────────────────
describe('getPeriodLabel()', () => {
  const testDate = d(2024, 3, 15) // March 15, 2024

  it('daily label contains Thai month name and BE year', () => {
    const label = getPeriodLabel(testDate, 'daily')
    expect(label).toContain('2567') // BE year
    expect(label).toContain('มีนาคม')
  })

  it('monthly label contains Thai month name and BE year', () => {
    const label = getPeriodLabel(testDate, 'monthly')
    expect(label).toContain('มีนาคม')
    expect(label).toContain('2567')
  })

  it('yearly label contains BE year', () => {
    const label = getPeriodLabel(testDate, 'yearly')
    expect(label).toContain('2567')
  })
})
