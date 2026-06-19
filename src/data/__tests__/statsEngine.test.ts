/**
 * statsEngine.test.ts — Unit Tests for statsEngine.ts
 */
import { describe, it, expect } from 'vitest'
import { calculateArrayStats, calculateGlobalBreaks } from '../statsEngine'

// ──────────────────────────────────────────
// calculateArrayStats()
// ──────────────────────────────────────────
describe('calculateArrayStats()', () => {
  it('returns all-zero stats for empty array', () => {
    const result = calculateArrayStats([])
    expect(result.min).toBe(0)
    expect(result.max).toBe(0)
    expect(result.mean).toBe(0)
    expect(result.median).toBe(0)
    expect(result.p25).toBe(0)
    expect(result.p75).toBe(0)
  })

  it('handles single-value array', () => {
    const result = calculateArrayStats([42])
    expect(result.min).toBe(42)
    expect(result.max).toBe(42)
    expect(result.mean).toBe(42)
    expect(result.median).toBe(42)
  })

  it('calculates mean correctly', () => {
    const result = calculateArrayStats([1, 2, 3, 4, 5])
    expect(result.mean).toBe(3)
  })

  it('calculates median for odd-count array', () => {
    const result = calculateArrayStats([1, 3, 5, 7, 9])
    expect(result.median).toBe(5)
  })

  it('calculates median for even-count array (interpolated)', () => {
    // [1, 2, 3, 4] — median is 2.5 (interpolated between index 1 and 2)
    const result = calculateArrayStats([1, 2, 3, 4])
    expect(result.median).toBeCloseTo(2.5, 1)
  })

  it('calculates min and max correctly', () => {
    const result = calculateArrayStats([5, 1, 9, 3, 7])
    expect(result.min).toBe(1)
    expect(result.max).toBe(9)
  })

  it('calculates p25 and p75 correctly', () => {
    // Sorted: [1, 2, 3, 4, 5, 6, 7, 8]
    const result = calculateArrayStats([5, 1, 3, 7, 2, 8, 4, 6])
    expect(result.p25).toBeGreaterThanOrEqual(2)
    expect(result.p25).toBeLessThanOrEqual(3)
    expect(result.p75).toBeGreaterThanOrEqual(6)
    expect(result.p75).toBeLessThanOrEqual(7)
  })

  it('handles equal values', () => {
    const result = calculateArrayStats([5, 5, 5, 5])
    expect(result.min).toBe(5)
    expect(result.max).toBe(5)
    expect(result.mean).toBe(5)
    expect(result.median).toBe(5)
  })

  it('handles large dataset without crashing', () => {
    const large = Array.from({ length: 10000 }, (_, i) => i + 1)
    const result = calculateArrayStats(large)
    expect(result.min).toBe(1)
    expect(result.max).toBe(10000)
    expect(result.mean).toBeCloseTo(5000.5, 0)
  })

  it('does not mutate the original array', () => {
    const original = [3, 1, 4, 1, 5, 9, 2, 6]
    const copy = [...original]
    calculateArrayStats(original)
    expect(original).toEqual(copy)
  })

  it('p25 <= median <= p75', () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    const { p25, median, p75 } = calculateArrayStats(values)
    expect(p25).toBeLessThanOrEqual(median)
    expect(median).toBeLessThanOrEqual(p75)
  })
})

// ──────────────────────────────────────────
// calculateGlobalBreaks()
// ──────────────────────────────────────────
describe('calculateGlobalBreaks()', () => {
  it('returns default breaks for empty array', () => {
    const result = calculateGlobalBreaks([])
    expect(result).toHaveLength(5)
    expect(result[0]).toBe(1)
  })

  it('returns default breaks for all-zero values', () => {
    const result = calculateGlobalBreaks([0, 0, 0, 0])
    expect(result).toHaveLength(5)
    expect(result[0]).toBe(1)
  })

  it('returns exactly 5 breaks', () => {
    const values = [1, 5, 10, 20, 50, 100, 200, 500, 1000, 5000]
    const result = calculateGlobalBreaks(values)
    expect(result).toHaveLength(5)
  })

  it('breaks are sorted in ascending order', () => {
    const values = [1, 5, 10, 20, 50, 100, 200, 500]
    const result = calculateGlobalBreaks(values)
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i]).toBeLessThanOrEqual(result[i + 1])
    }
  })

  it('breaks are all unique (no duplicates)', () => {
    const values = [1, 10, 100, 1000, 10000, 100000]
    const result = calculateGlobalBreaks(values)
    const unique = new Set(result)
    expect(unique.size).toBe(result.length)
  })

  it('last break is >= the max positive value', () => {
    const values = [1, 5, 10, 50, 100]
    const result = calculateGlobalBreaks(values)
    // The last break should be at least the max value (may be higher if padding needed)
    expect(result[result.length - 1]).toBeGreaterThanOrEqual(100)
  })

  it('filters out zero values (percentile from positives only)', () => {
    // Many zeros + a few positives — percentiles should reflect positives
    const values = [0, 0, 0, 0, 0, 10, 20, 30, 40, 50]
    const result = calculateGlobalBreaks(values)
    expect(result[0]).toBeGreaterThan(0)
  })

  it('handles single positive value', () => {
    const result = calculateGlobalBreaks([42])
    expect(result).toHaveLength(5)
    // All breaks should be >= 42 (since there's only one value)
    expect(result[result.length - 1]).toBeGreaterThanOrEqual(42)
  })

  it('handles epidemiological-scale data (hundreds per area)', () => {
    // Simulate 77 provinces with counts 1–5000
    const values = Array.from({ length: 77 }, (_, i) => (i + 1) * 65)
    const result = calculateGlobalBreaks(values)
    expect(result).toHaveLength(5)
    expect(result[0]).toBeGreaterThan(0)
    expect(result[4]).toBeGreaterThan(result[0])
  })
})
