/**
 * encoding.ts - Utility for detecting and decoding text encodings (specifically for Thai CSV files)
 */
import * as XLSX from 'xlsx'

export function detectEncoding(bytes: Uint8Array): string {
  // Check for UTF-8 BOM: 0xEF, 0xBB, 0xBF
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return 'utf-8'
  }

  // Scan a sample of bytes for valid UTF-8 sequences
  const sampleSize = Math.min(bytes.length, 100000)
  let isUtf8 = true
  let hasHighBit = false
  let i = 0

  while (i < sampleSize) {
    const b1 = bytes[i]
    if (b1 < 0x80) {
      i++
      continue
    }

    hasHighBit = true

    // 2-byte sequence: 110xxxxx 10xxxxxx
    if ((b1 & 0xE0) === 0xC0) {
      if (i + 1 >= sampleSize) break
      const b2 = bytes[i + 1]
      if ((b2 & 0xC0) !== 0x80) {
        isUtf8 = false
        break
      }
      i += 2
    }
    // 3-byte sequence: 1110xxxx 10xxxxxx 10xxxxxx
    else if ((b1 & 0xF0) === 0xE0) {
      if (i + 2 >= sampleSize) break
      const b2 = bytes[i + 1]
      const b3 = bytes[i + 2]
      if ((b2 & 0xC0) !== 0x80 || (b3 & 0xC0) !== 0x80) {
        isUtf8 = false
        break
      }
      i += 3
    }
    // 4-byte sequence: 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
    else if ((b1 & 0xF8) === 0xF0) {
      if (i + 3 >= sampleSize) break
      const b2 = bytes[i + 1]
      const b3 = bytes[i + 2]
      const b4 = bytes[i + 3]
      if ((b2 & 0xC0) !== 0x80 || (b3 & 0xC0) !== 0x80 || (b4 & 0xC0) !== 0x80) {
        isUtf8 = false
        break
      }
      i += 4
    }
    else {
      isUtf8 = false
      break
    }
  }

  if (hasHighBit && isUtf8) {
    return 'utf-8'
  }
  if (hasHighBit) {
    // Has high-bit bytes but not valid UTF-8 -> assume Windows-874 (Thai legacy)
    return 'windows-874'
  }

  // Default to utf-8 if pure ASCII
  return 'utf-8'
}

export function readCsvToWorkbook(bytes: Uint8Array): XLSX.WorkBook {
  const encoding = detectEncoding(bytes)
  let cleanBytes = bytes
  if (encoding === 'utf-8' && bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    cleanBytes = bytes.subarray(3)
  }
  const decoded = new TextDecoder(encoding).decode(cleanBytes)
  return XLSX.read(decoded, { type: 'string', cellDates: true })
}
