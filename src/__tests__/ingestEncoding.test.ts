import { describe, it, expect } from 'vitest'
import { detectEncoding } from '../data/encoding'

describe('detectEncoding', () => {
  it('detects UTF-8 BOM correctly', () => {
    const bytes = new Uint8Array([0xEF, 0xBB, 0xBF, 0x61, 0x62, 0x63]) // BOM + "abc"
    expect(detectEncoding(bytes)).toBe('utf-8')
  })

  it('detects pure ASCII as utf-8', () => {
    const bytes = new TextEncoder().encode('hello world')
    expect(detectEncoding(bytes)).toBe('utf-8')
  })

  it('detects valid UTF-8 with Thai characters', () => {
    // "ภาษาไทย" in UTF-8
    const bytes = new TextEncoder().encode('ภาษาไทย')
    expect(detectEncoding(bytes)).toBe('utf-8')
  })

  it('detects Windows-874 / TIS-620 legacy encoding', () => {
    // In TIS-620, "ภาษาไทย" uses single byte characters like:
    // 0xC0 (ภ), 0xD2 (า), 0xCB (ษ), 0xD2 (า), 0xCD (ไ), 0xCE (ท), 0xDF (ย)
    // None of these are followed by valid UTF-8 continuation bytes (0x80 to 0xBF)
    const bytes = new Uint8Array([0xC0, 0xD2, 0xCB, 0xD2, 0xCD, 0xCE, 0xDF])
    expect(detectEncoding(bytes)).toBe('windows-874')
  })
})
