/**
 * statsEngine.ts — ระบบคำนวณสถิติมาตรฐาน
 * ใช้สำหรับหาค่าทางสถิติจากชุดตัวเลข (Min, Max, Mean, Median, Quantiles)
 */

import type { StatsRecord, DateDictionary, AppState } from '../store/useAppStore'
import { getDictValue } from './aggregator'

/**
 * คำนวณค่าสถิติจากชุดตัวเลข
 */
export function calculateArrayStats(values: number[]): Omit<StatsRecord, 'maxAreas' | 'totalCount'> {
  if (values.length === 0) {
    return { min: 0, max: 0, mean: 0, median: 0, p25: 0, p75: 0 }
  }

  // เรียงลำดับเพื่อหา Median / Quantiles
  const sorted = [...values].sort((a, b) => a - b)
  const sum = sorted.reduce((a, b) => a + b, 0)
  const mean = sum / sorted.length

  const getQuantile = (q: number) => {
    const pos = (sorted.length - 1) * q
    const base = Math.floor(pos)
    const rest = pos - base
    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base])
    } else {
      return sorted[base]
    }
  }

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean,
    median: getQuantile(0.5),
    p25: getQuantile(0.25),
    p75: getQuantile(0.75),
  }
}

// Mapping จังหวัด -> เขตสุขภาพ (ตัวอย่างมาตรฐาน)
const PROVINCE_TO_ZONE: Record<string, string> = {
  'เชียงใหม่': '1', 'เชียงราย': '1', 'พะเยา': '1', 'แม่ฮ่องสอน': '1', 'ลำพูน': '1', 'ลำปาง': '1', 'แพร่': '1', 'น่าน': '1',
  'พิษณุโลก': '2', 'ตาก': '2', 'เพชรบูรณ์': '2', 'สุโขทัย': '2', 'อุตรดิตถ์': '2',
  'นครสวรรค์': '3', 'กำแพงเพชร': '3', 'พิจิตร': '3', 'อุทัยธานี': '3', 'ชัยนาท': '3',
  'สระบุรี': '4', 'นนทบุรี': '4', 'ลพบุรี': '4', 'อ่างทอง': '4', 'พระนครศรีอยุธยา': '4', 'ปทุมธานี': '4', 'นครนายก': '4', 'สิงห์บุรี': '4',
  'ราชบุรี': '5', 'นครปฐม': '5', 'สุพรรณบุรี': '5', 'กาญจนบุรี': '5', 'สมุทรสาคร': '5', 'สมุทรสงคราม': '5', 'เพชรบุรี': '5', 'ประจวบคีรีขันธ์': '5',
  'ชลบุรี': '6', 'ระยอง': '6', 'จันทบุรี': '6', 'ตราด': '6', 'สมุทรปราการ': '6', 'ฉะเชิงเทรา': '6', 'ปราจีนบุรี': '6', 'สระแก้ว': '6',
  'ขอนแก่น': '7', 'ร้อยเอ็ด': '7', 'มหาสารคาม': '7', 'กาฬสินธุ์': '7',
  'อุดรธานี': '8', 'สกลนคร': '8', 'นครพนม': '8', 'เลย': '8', 'หนองคาย': '8', 'หนองบัวลำภู': '8', 'บึงกาฬ': '8',
  'นครราชสีมา': '9', 'ชัยภูมิ': '9', 'บุรีรัมย์': '9', 'สุรินทร์': '9',
  'อุบลราชธานี': '10', 'ศรีสะเกษ': '10', 'ยโสธร': '10', 'อำนาจเจริญ': '10', 'มุกดาหาร': '10',
  'สุราษฎร์ธานี': '11', 'นครศรีธรรมราช': '11', 'ชุมพร': '11', 'ระนอง': '11', 'พังงา': '11', 'ภูเก็ต': '11', 'กระบี่': '11',
  'สงขลา': '12', 'สตูล': '12', 'ตรัง': '12', 'พัทลุง': '12', 'ปัตตานี': '12', 'ยะลา': '12', 'นราธิวาส': '12',
  'กรุงเทพมหานคร': '13'
}

/**
 * คำนวณชุดจุดตัดสี (Breaks) จากข้อมูลทั้งก้อน
 * ใช้ Percentile เพื่อให้การกระจายของสีสม่ำเสมอ
 */
export function calculateGlobalBreaks(allValues: number[]): number[] {
  if (allValues.length === 0) return [1, 5, 10, 50, 100]

  // กรองค่า > 0 และเรียงลำดับเพื่อหา Percentile
  const sorted = [...allValues].filter(v => v > 0).sort((a, b) => a - b)
  if (sorted.length === 0) return [1, 5, 10, 50, 100]

  const len = sorted.length
  const breaks = [
    sorted[Math.floor(len * 0.2)] || 1,
    sorted[Math.floor(len * 0.4)] || 5,
    sorted[Math.floor(len * 0.6)] || 10,
    sorted[Math.floor(len * 0.8)] || 50,
    sorted[len - 1] || 100
  ]

  // ป้องกันค่าซ้ำ (เช่น ข้อมูล 0 เยอะมากจน P20-P40 เป็นค่าเดียวกัน)
  const unique = [...new Set(breaks)].sort((a, b) => a - b)
  while (unique.length < 5) {
    unique.push((unique[unique.length - 1] || 0) + 10)
  }
  return unique
}


