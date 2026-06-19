/**
 * aggregator.test.ts — Unit Tests for aggregator.ts (pure functions only)
 * Note: buildDictionary() and calculateGlobalStats() require locationResolver.init()
 * so we test the pure helper functions independently.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  isAreaInScope,
  buildCumulativeSlice,
  buildSelectionSlice,
  clearCumulativeCache,
  type PeriodBucket,
} from '../aggregator'

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────

/**
 * สร้าง Dictionary stub สำหรับ test
 * dict[dateKey][pCode] = { _total, districts: { [aCode]: { _total, subdistricts: {} } } }
 */
function makeDictSlice(
  pCode: string,
  total: number,
  districts: Record<string, { total: number; subs?: Record<string, number> }>
) {
  const d: any = { _total: total, districts: {} }
  for (const [aCode, aData] of Object.entries(districts)) {
    d.districts[aCode] = {
      _total: aData.total,
      subdistricts: aData.subs || {},
    }
  }
  return { [pCode]: d }
}

function makePeriod(key: string, daysOffset = 0): PeriodBucket {
  const date = new Date(2024, 0, 1)
  date.setDate(date.getDate() + daysOffset)
  return { key, label: key, date }
}

// ──────────────────────────────────────────
// isAreaInScope()
// ──────────────────────────────────────────
describe('isAreaInScope()', () => {
  it('returns true when scope is all/all/all', () => {
    expect(isAreaInScope('เชียงใหม่', 'เมืองเชียงใหม่', {
      province: 'all', region: 'all', district: 'all'
    })).toBe(true)
  })

  it('returns true when province matches scope', () => {
    expect(isAreaInScope('เชียงใหม่', '', {
      province: 'เชียงใหม่', region: 'all', district: 'all'
    })).toBe(true)
  })

  it('returns false when province does not match scope', () => {
    expect(isAreaInScope('กรุงเทพมหานคร', '', {
      province: 'เชียงใหม่', region: 'all', district: 'all'
    })).toBe(false)
  })

  it('returns true when province and district both match', () => {
    expect(isAreaInScope('เชียงใหม่', 'แม่ริม', {
      province: 'เชียงใหม่', region: 'all', district: 'แม่ริม'
    })).toBe(true)
  })

  it('returns false when province matches but district does not', () => {
    expect(isAreaInScope('เชียงใหม่', 'ปากเกร็ด', {
      province: 'เชียงใหม่', region: 'all', district: 'แม่ริม'
    })).toBe(false)
  })

  it('tolerates prefix จังหวัด in scope province (via cleanName)', () => {
    // cleanName strips จังหวัด
    expect(isAreaInScope('เชียงใหม่', '', {
      province: 'จังหวัดเชียงใหม่', region: 'all', district: 'all'
    })).toBe(true)
  })

  it('works with all=all scope for any province', () => {
    const scope = { province: 'all', region: 'all', district: 'all' }
    expect(isAreaInScope('กรุงเทพมหานคร', 'พระนคร', scope)).toBe(true)
    expect(isAreaInScope('เชียงราย', 'แม่สาย', scope)).toBe(true)
  })
})

// ──────────────────────────────────────────
// buildCumulativeSlice()
// ──────────────────────────────────────────
describe('buildCumulativeSlice()', () => {
  beforeEach(() => {
    clearCumulativeCache()
  })

  it('returns cumulative totals across periods', () => {
    const dict: any = {
      'W1': makeDictSlice('50', 10, { '5001': { total: 10 } }),
      'W2': makeDictSlice('50', 20, { '5001': { total: 20 } }),
      'W3': makeDictSlice('50', 30, { '5001': { total: 30 } }),
    }
    const periods = [makePeriod('W1'), makePeriod('W2', 7), makePeriod('W3', 14)]

    const result = buildCumulativeSlice(dict, periods, 1) // cumulative up to W2
    const cumProv = result['__cumulative__']['50']
    expect(cumProv._total).toBe(30) // 10 + 20
    expect(cumProv.districts['5001']._total).toBe(30) // 10 + 20
  })

  it('returns only first period when stepIndex=0', () => {
    const dict: any = {
      'W1': makeDictSlice('50', 5, { '5001': { total: 5 } }),
      'W2': makeDictSlice('50', 10, { '5001': { total: 10 } }),
    }
    const periods = [makePeriod('W1'), makePeriod('W2', 7)]
    const result = buildCumulativeSlice(dict, periods, 0)
    expect(result['__cumulative__']['50']._total).toBe(5)
  })

  it('accumulates subdistrict data correctly', () => {
    const dict: any = {
      'W1': {
        '50': {
          _total: 10,
          districts: {
            '5001': {
              _total: 10,
              subdistricts: { '500101': 4, '500102': 6 }
            }
          }
        }
      },
      'W2': {
        '50': {
          _total: 8,
          districts: {
            '5001': {
              _total: 8,
              subdistricts: { '500101': 3, '500102': 5 }
            }
          }
        }
      }
    }
    const periods = [makePeriod('W1'), makePeriod('W2', 7)]
    const result = buildCumulativeSlice(dict, periods, 1)
    const subs = result['__cumulative__']['50'].districts['5001'].subdistricts
    expect(subs['500101']).toBe(7) // 4 + 3
    expect(subs['500102']).toBe(11) // 6 + 5
  })

  it('returns cached result on second call (memoization)', () => {
    const dict: any = {
      'W1': makeDictSlice('50', 5, { '5001': { total: 5 } }),
    }
    const periods = [makePeriod('W1')]
    const result1 = buildCumulativeSlice(dict, periods, 0)
    const result2 = buildCumulativeSlice(dict, periods, 0)
    expect(result1).toBe(result2) // same reference = cached
  })

  it('handles missing period in dict gracefully (sparse data)', () => {
    const dict: any = {
      'W1': makeDictSlice('50', 5, { '5001': { total: 5 } }),
      // W2 missing in dict intentionally
    }
    const periods = [makePeriod('W1'), makePeriod('W2', 7)]
    expect(() => buildCumulativeSlice(dict, periods, 1)).not.toThrow()
    const result = buildCumulativeSlice(dict, periods, 1)
    expect(result['__cumulative__']['50']._total).toBe(5) // only W1 data
  })
})

// ──────────────────────────────────────────
// buildSelectionSlice()
// ──────────────────────────────────────────
describe('buildSelectionSlice()', () => {
  it('merges only selected periods', () => {
    const dict: any = {
      'W1': makeDictSlice('50', 10, { '5001': { total: 10 } }),
      'W2': makeDictSlice('50', 20, { '5001': { total: 20 } }),
      'W3': makeDictSlice('50', 30, { '5001': { total: 30 } }),
    }
    const periods = [makePeriod('W1'), makePeriod('W2', 7), makePeriod('W3', 14)]
    const selected = new Set(['W1', 'W3']) // skip W2

    const result = buildSelectionSlice(dict, periods, selected)
    const merged = result['__selection__']['50']
    expect(merged._total).toBe(40) // 10 + 30
  })

  it('returns empty selection when no periods selected', () => {
    const dict: any = {
      'W1': makeDictSlice('50', 10, { '5001': { total: 10 } }),
    }
    const periods = [makePeriod('W1')]
    const result = buildSelectionSlice(dict, periods, new Set())
    expect(result['__selection__']).toEqual({})
  })

  it('handles selecting all periods', () => {
    const dict: any = {
      'W1': makeDictSlice('10', 5, { '1001': { total: 5 } }),
      'W2': makeDictSlice('10', 8, { '1001': { total: 8 } }),
      'W3': makeDictSlice('10', 12, { '1001': { total: 12 } }),
    }
    const periods = [makePeriod('W1'), makePeriod('W2', 7), makePeriod('W3', 14)]
    const selected = new Set(['W1', 'W2', 'W3'])
    const result = buildSelectionSlice(dict, periods, selected)
    expect(result['__selection__']['10']._total).toBe(25) // 5+8+12
  })

  it('merges subdistricts from selected periods', () => {
    const dict: any = {
      'W1': {
        '50': {
          _total: 10, districts: {
            '5001': { _total: 10, subdistricts: { '500101': 6, '500102': 4 } }
          }
        }
      },
      'W2': {
        '50': {
          _total: 15, districts: {
            '5001': { _total: 15, subdistricts: { '500101': 9, '500102': 6 } }
          }
        }
      }
    }
    const periods = [makePeriod('W1'), makePeriod('W2', 7)]
    const selected = new Set(['W1', 'W2'])
    const result = buildSelectionSlice(dict, periods, selected)
    const subs = result['__selection__']['50'].districts['5001'].subdistricts
    expect(subs['500101']).toBe(15) // 6+9
    expect(subs['500102']).toBe(10) // 4+6
  })

  it('handles missing dict keys gracefully (sparse data)', () => {
    const dict: any = {
      'W1': makeDictSlice('50', 5, { '5001': { total: 5 } }),
    }
    const periods = [makePeriod('W1'), makePeriod('W2', 7)]
    const selected = new Set(['W1', 'W2']) // W2 not in dict
    expect(() => buildSelectionSlice(dict, periods, selected)).not.toThrow()
    const result = buildSelectionSlice(dict, periods, selected)
    expect(result['__selection__']['50']._total).toBe(5)
  })
})
