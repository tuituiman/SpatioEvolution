/**
 * thaiNormalizer.test.ts — Unit Tests for thaiNormalizer.ts
 */
import { describe, it, expect } from 'vitest'
import {
  repairMojibake,
  cleanName,
  expandMueang,
  buildCompoundKey,
  formatAdminName,
  repairGeoJSONProperties,
  findProvinceInProps,
  canonical,
  THAI_PROVINCES,
} from '../thaiNormalizer'

// ──────────────────────────────────────────
// repairMojibake()
// ──────────────────────────────────────────
describe('repairMojibake()', () => {
  it('returns original string if no Mojibake pattern', () => {
    expect(repairMojibake('เชียงใหม่')).toBe('เชียงใหม่')
    expect(repairMojibake('Bangkok')).toBe('Bangkok')
  })

  it('returns empty/short strings unchanged', () => {
    expect(repairMojibake('')).toBe('')
    expect(repairMojibake('a')).toBe('a')
  })

  it('handles null-like gracefully', () => {
    // Function accepts string, we test edge case
    expect(repairMojibake('normal text')).toBe('normal text')
  })
})

// ──────────────────────────────────────────
// cleanName()
// ──────────────────────────────────────────
describe('cleanName()', () => {
  it('returns empty string for null/undefined', () => {
    expect(cleanName(null)).toBe('')
    expect(cleanName(undefined)).toBe('')
  })

  it('strips Thai province prefix จังหวัด', () => {
    expect(cleanName('จังหวัดเชียงใหม่')).toBe('เชียงใหม่')
  })

  it('strips Thai district prefix อำเภอ', () => {
    expect(cleanName('อำเภอเมืองเชียงใหม่')).toBe('เมืองเชียงใหม่')
  })

  it('strips Thai subdistrict prefix ตำบล', () => {
    expect(cleanName('ตำบลศรีภูมิ')).toBe('ศรีภูมิ')
  })

  it('strips abbreviation จ.', () => {
    expect(cleanName('จ.เชียงใหม่')).toBe('เชียงใหม่')
  })

  it('strips abbreviation อ.', () => {
    expect(cleanName('อ.เมือง')).toBe('เมือง')
  })

  it('strips abbreviation ต.', () => {
    expect(cleanName('ต.ศรีภูมิ')).toBe('ศรีภูมิ')
  })

  it('strips English prefix CHANGWAT', () => {
    expect(cleanName('CHANGWAT CHIANGMAI').toLowerCase()).not.toContain('changwat')
  })

  it('strips English prefix AMPHOE', () => {
    const result = cleanName('AMPHOE MUEANG').toLowerCase()
    expect(result).not.toContain('amphoe')
  })

  it('trims whitespace', () => {
    expect(cleanName('  เชียงใหม่  ')).toBe('เชียงใหม่')
  })

  it('normalizes NFC unicode', () => {
    // Both should clean to the same result
    const a = cleanName('เชียงใหม่')
    const b = cleanName('เชียงใหม่')
    expect(a).toBe(b)
  })

  it('does not strip characters from middle of string', () => {
    // Only strips leading prefix, not embedded words
    const result = cleanName('เมืองเชียงใหม่')
    expect(result).toBe('เมืองเชียงใหม่')
  })
})

// ──────────────────────────────────────────
// expandMueang()
// ──────────────────────────────────────────
describe('expandMueang()', () => {
  it('expands bare "เมือง" to "เมือง[province]"', () => {
    expect(expandMueang('เมือง', 'เชียงใหม่')).toBe('เมืองเชียงใหม่')
  })

  it('keeps full "เมืองเชียงใหม่" unchanged', () => {
    expect(expandMueang('เมืองเชียงใหม่', 'เชียงใหม่')).toBe('เมืองเชียงใหม่')
  })

  it('does not change non-Mueang districts', () => {
    expect(expandMueang('แม่ริม', 'เชียงใหม่')).toBe('แม่ริม')
    expect(expandMueang('ปากเกร็ด', 'นนทบุรี')).toBe('ปากเกร็ด')
  })

  it('handles empty province name', () => {
    const result = expandMueang('เมือง', '')
    // Should not crash, just return 'เมือง' or 'เมือง'
    expect(result).toBeTruthy()
  })

  it('handles empty district name', () => {
    expect(expandMueang('', 'เชียงใหม่')).toBe('')
  })
})

// ──────────────────────────────────────────
// buildCompoundKey()
// ──────────────────────────────────────────
describe('buildCompoundKey()', () => {
  it('builds province-only key', () => {
    expect(buildCompoundKey('เชียงใหม่')).toBe('เชียงใหม่')
  })

  it('builds province+district key', () => {
    const key = buildCompoundKey('เชียงใหม่', 'แม่ริม')
    expect(key).toBe('เชียงใหม่|แม่ริม')
  })

  it('builds province+district+subdistrict key', () => {
    const key = buildCompoundKey('เชียงใหม่', 'แม่ริม', 'ริมใต้')
    expect(key).toBe('เชียงใหม่|แม่ริม|ริมใต้')
  })

  it('expands เมือง in compound key', () => {
    const key = buildCompoundKey('เชียงใหม่', 'เมือง')
    expect(key).toBe('เชียงใหม่|เมืองเชียงใหม่')
  })

  it('strips prefixes before building key', () => {
    const key = buildCompoundKey('จังหวัดเชียงใหม่', 'อำเภอแม่ริม', 'ตำบลริมใต้')
    expect(key).toBe('เชียงใหม่|แม่ริม|ริมใต้')
  })
})

// ──────────────────────────────────────────
// formatAdminName()
// ──────────────────────────────────────────
describe('formatAdminName()', () => {
  it('prefixes จ. for province', () => {
    expect(formatAdminName('เชียงใหม่', 'p')).toBe('จ.เชียงใหม่')
  })

  it('prefixes อ. for district', () => {
    expect(formatAdminName('แม่ริม', 'a')).toBe('อ.แม่ริม')
  })

  it('prefixes ต. for subdistrict', () => {
    expect(formatAdminName('ริมใต้', 't')).toBe('ต.ริมใต้')
  })

  it('returns empty string for empty input', () => {
    expect(formatAdminName('', 'p')).toBe('')
  })
})

// ──────────────────────────────────────────
// canonical()
// ──────────────────────────────────────────
describe('canonical()', () => {
  it('returns lowercase cleaned name', () => {
    const result = canonical('จังหวัดเชียงใหม่')
    expect(result).toBe('เชียงใหม่')
    expect(result).toBe(result.toLowerCase())
  })

  it('handles null', () => {
    expect(canonical(null)).toBe('')
  })
})

// ──────────────────────────────────────────
// repairGeoJSONProperties()
// ──────────────────────────────────────────
describe('repairGeoJSONProperties()', () => {
  it('normalizes P_code to digits only', () => {
    const result = repairGeoJSONProperties({ P_code: ' 50 ' })
    expect(result.P_code).toBe('50')
  })

  it('normalizes A_code to digits only', () => {
    const result = repairGeoJSONProperties({ A_code: '5001' })
    expect(result.A_code).toBe('5001')
  })

  it('normalizes Admin_code to digits only', () => {
    const result = repairGeoJSONProperties({ Admin_code: '500101' })
    expect(result.Admin_code).toBe('500101')
  })

  it('keeps non-string values unchanged', () => {
    const result = repairGeoJSONProperties({ count: 42, flag: true })
    expect(result.count).toBe(42)
    expect(result.flag).toBe(true)
  })

  it('returns a new object (not mutation)', () => {
    const input = { P_code: '50' }
    const result = repairGeoJSONProperties(input)
    expect(result).not.toBe(input)
  })
})

// ──────────────────────────────────────────
// findProvinceInProps()
// ──────────────────────────────────────────
describe('findProvinceInProps()', () => {
  it('finds province from P_code field', () => {
    // P_code 50 = เชียงใหม่
    const result = findProvinceInProps({ P_code: '50' })
    expect(result).toBe('เชียงใหม่')
  })

  it('finds province from Thai name value', () => {
    const result = findProvinceInProps({ PROVINCE_NAME: 'เชียงใหม่' })
    expect(result).toBe('เชียงใหม่')
  })

  it('finds กรุงเทพมหานคร', () => {
    const result = findProvinceInProps({ P_code: '10' })
    expect(result).toBe('กรุงเทพมหานคร')
  })

  it('returns empty string when no match', () => {
    const result = findProvinceInProps({ random_field: 'xyz123' })
    expect(result).toBe('')
  })
})

// ──────────────────────────────────────────
// THAI_PROVINCES constant
// ──────────────────────────────────────────
describe('THAI_PROVINCES constant', () => {
  it('has exactly 77 provinces', () => {
    expect(THAI_PROVINCES).toHaveLength(77)
  })

  it('all entries are non-empty strings', () => {
    for (const p of THAI_PROVINCES) {
      expect(typeof p).toBe('string')
      expect(p.length).toBeGreaterThan(0)
    }
  })

  it('contains เชียงใหม่', () => {
    expect(THAI_PROVINCES).toContain('เชียงใหม่')
  })

  it('contains กรุงเทพมหานคร', () => {
    expect(THAI_PROVINCES).toContain('กรุงเทพมหานคร')
  })
})
