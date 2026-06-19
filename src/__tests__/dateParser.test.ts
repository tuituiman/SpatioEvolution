/**
 * dateParser.test.ts
 * Unit tests for date parsing and period grouping
 */
import { describe, it, expect } from 'vitest'
import { parseDate, toDateKey } from '../data/dateParser'

describe('parseDate', () => {
  it('parses ISO 8601 format', () => {
    const d = parseDate('2024-01-15')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2024)
    expect(d!.getMonth()).toBe(0)  // January = 0
    expect(d!.getDate()).toBe(15)
  })

  it('parses Thai Buddhist Era year (พ.ศ.)', () => {
    const d = parseDate('15/01/2567')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2024)
  })

  it('parses slash-separated date (DD/MM/YYYY)', () => {
    const d = parseDate('31/12/2023')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2023)
    expect(d!.getMonth()).toBe(11) // December = 11
    expect(d!.getDate()).toBe(31)
  })

  it('returns null for invalid date', () => {
    expect(parseDate('')).toBeNull()
    expect(parseDate('not-a-date')).toBeNull()
    expect(parseDate(null as any)).toBeNull()
  })

  it('parses year-only (YYYY)', () => {
    const d = parseDate('2023')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2023)
  })
})

describe('toDateKey', () => {
  const d = new Date(2024, 0, 15) // 15 Jan 2024

  it('returns weekly key with year prefix', () => {
    const key = toDateKey(d, 'weekly')
    expect(key).toMatch(/^2024-W/)
  })

  it('returns monthly key YYYY-MM', () => {
    const key = toDateKey(d, 'monthly')
    expect(key).toBe('2024-01')
  })

  it('returns yearly key YYYY', () => {
    const key = toDateKey(d, 'yearly')
    expect(key).toBe('2024')
  })

  it('weekly key is consistent for same week', () => {
    const monday = new Date(2024, 0, 15)
    const sunday = new Date(2024, 0, 21)
    expect(toDateKey(monday, 'weekly')).toBe(toDateKey(sunday, 'weekly'))
  })
})
