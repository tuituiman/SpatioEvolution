/**
 * ingestWorker.ts — Web Worker: Excel Ingestion
 * ทำงานใน background thread — ไม่ block UI
 *
 * Messages IN:
 *   { type: 'LOAD', fileData: ArrayBuffer, fileName: string }
 *
 * Messages OUT:
 *   { type: 'PROGRESS', percent: number, msg: string }
 *   { type: 'DONE',     rows: Row[], columns: string[], fileName: string }
 *   { type: 'ERROR',    message: string }
 */

// SheetJS — import เป็น ES Module (รองรับ Vite module worker)
import * as XLSX from 'xlsx'
import { readCsvToWorkbook } from '../data/encoding'

// ──────────────────────────────────────────
// Thai Repair (self-contained copy for Worker)
// ──────────────────────────────────────────
const MOJIBAKE = /เธ|เธฒ|à¸|à¹|ร |รต|รบ|รจ/
const SPECIAL_MAP: Record<number, number> = {
  0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,
  0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,0x2039:0x8B,0x0152:0x8C,
  0x017D:0x8E,0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x2022:0x95,
  0x2013:0x96,0x2014:0x97,0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,
  0x0153:0x9C,0x017E:0x9E,0x0178:0x9F,
}

function repairThai(text: string): string {
  if (!text || text.length < 2 || !MOJIBAKE.test(text)) return text
  try {
    const bytes = Uint8Array.from(text, c => {
      const code = c.charCodeAt(0)
      if (code >= 0x0E00 && code <= 0x0E7F) return code - 0x0E00 + 0xA0
      return SPECIAL_MAP[code] ?? (code & 0xFF)
    })
    const fixed = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    if (/[\u0E01-\u0E7F]/.test(fixed) && !MOJIBAKE.test(fixed)) return fixed
  } catch { /* ignore */ }
  return text
}

function repairRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k in row) {
    const cleanKey = repairThai(k.toString().normalize('NFC').trim())
    const val = row[k]
    out[cleanKey] = typeof val === 'string' ? repairThai(val.normalize('NFC')) : val
  }
  return out
}

// ──────────────────────────────────────────
// Column Auto-Detector
// ──────────────────────────────────────────
function detectColumns(columns: string[], rows: Record<string, unknown>[]): Record<string, string> {
  const mapping: Record<string, string> = {
    date: '', province: '', district: '', subdistrict: '', 
    lat: '', lng: '', value: '', color: ''
  }
  const patterns: Record<string, RegExp> = {
    province:    /รหัสจังหวัด|^(จังหวัด|จ\.|province|changwat|p_code|pcode|pv_code|admin_code_2)/i,
    district:    /รหัสอำเภอ|^(อำเภอ|อ\.|district|amphur|amphoe|a_code|acode|am_code|admin_code_4)/i,
    subdistrict: /รหัสตำบล|^(ตำบล|ต\.|subdist|tambon|t_code|tcode|t_code_full|admin_code_6|admin_code$)/i,
    date:        /วัน|date|time/i,
    lat:         /^(lat|latitude|ละติจูด|พิกัด_y)/i,
    lng:         /^(lng|long|longitude|ลองจิจูด|พิกัด_x)/i,
    value:       /จำนวน|ยอด|ราย|ผู้ป่วย|case|patient|value|count|total|ปริมาณ/i,
    color:       /^(สี|color|hex)$/i,
  }

  // 1. ตรวจจากชื่อหัวตารางก่อน
  for (const col of columns) {
    for (const [key, re] of Object.entries(patterns)) {
      if (!mapping[key] && re.test(col)) mapping[key] = col
    }
  }

  // 2. ถ้ายังหาไม่เจอ หรือเพื่อความมั่นใจ ให้สุ่มตรวจข้อมูล (Value Sampling)
  if (rows.length > 0) {
    const sampleSize = Math.min(rows.length, 20)
    const samples = rows.slice(0, sampleSize)

    for (const col of columns) {
      // ข้ามคอลัมน์ที่เดาได้จากชื่อไปแล้ว (เว้นแต่จะเป็นพื้นที่)
      if (mapping.date === col || mapping.value === col) continue

      let digits2 = 0, digits4 = 0, digits6 = 0

      samples.forEach(row => {
        const val = String(row[col] || '').trim()
        if (!val) return
        if (/^\d{2}$/.test(val)) digits2++
        else if (/^\d{4}$/.test(val)) digits4++
        else if (/^\d{6}$/.test(val)) digits6++
      })

      // ถ้าเจอตัวเลขเยอะๆ ในคอลัมน์ที่ชื่อใกล้เคียง ให้เทน้ำหนักไปทางนั้น
      if (digits6 > sampleSize * 0.5 && !mapping.subdistrict) mapping.subdistrict = col
      else if (digits4 > sampleSize * 0.5 && !mapping.district) mapping.district = col
      else if (digits2 > sampleSize * 0.5) {
        // เลข 2 หลักอาจจะเป็น จังหวัด อำเภอ หรือ ตำบล (แบบย่อย) ก็ได้
        if (!mapping.province && /จ\.|จังหวัด|prov/i.test(col)) mapping.province = col
        else if (!mapping.district && /อ\.|อำเภอ|dist/i.test(col)) mapping.district = col
        else if (!mapping.subdistrict && /ต\.|ตำบล|sub/i.test(col)) mapping.subdistrict = col
      }
    }
  }

  return mapping
}

// ──────────────────────────────────────────
// Message Handler
// ──────────────────────────────────────────
self.onmessage = (e: MessageEvent) => {
  const { type, fileData, fileName } = e.data

  if (type === 'LOAD') {
    try {
      self.postMessage({ type: 'PROGRESS', percent: 10, msg: 'กำลังอ่านไฟล์...' })

      let workbook: XLSX.WorkBook
      const bytes = new Uint8Array(fileData)

      if (fileName && fileName.toLowerCase().endsWith('.csv')) {
        workbook = readCsvToWorkbook(bytes)
      } else {
        workbook = XLSX.read(bytes, { type: 'array', cellDates: true })
      }
      const sheet    = workbook.Sheets[workbook.SheetNames[0]]
      const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

      self.postMessage({ type: 'PROGRESS', percent: 40, msg: `ซ่อมภาษาไทย... (${rawRows.length} แถว)` })

      // Repair Thai encoding
      const total   = rawRows.length
      const repaired: Record<string, unknown>[] = []
      for (let i = 0; i < total; i++) {
        if (i % 2000 === 0) {
          const pct = 40 + Math.round((i / total) * 50)
          self.postMessage({ type: 'PROGRESS', percent: pct, msg: `ซ่อมภาษาไทย... ${i}/${total}` })
        }
        repaired.push(repairRow(rawRows[i]))
      }

      const columns = repaired.length > 0 ? Object.keys(repaired[0]) : []
      const guessedMapping = detectColumns(columns, repaired)

      self.postMessage({ type: 'PROGRESS', percent: 100, msg: 'เสร็จสิ้น!' })
      self.postMessage({ type: 'DONE', rows: repaired, columns, guessedMapping, fileName, rowCount: total })

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      self.postMessage({ type: 'ERROR', message: msg })
    }
  }
}

export {}   // make TypeScript treat as module
