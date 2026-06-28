/**
 * dateParser.ts — Robust Multi-format Date Parser
 * SpatioEvolution Core Data Layer
 *
 * รองรับ: Excel serial, DD/MM/YYYY (BE+CE), YYYY-MM-DD, native Date
 * ✅ Pure functions — ไม่มี side effects
 */

export type DateMode = 'daily' | 'weekly' | 'weekly_epi' | 'monthly' | 'yearly';

// ──────────────────────────────────────────
// Core Parser
// ──────────────────────────────────────────

/** แปลงทุก format → Date object (null ถ้าไม่ได้) */
export function parseDate(value: unknown): Date | null {
  if (!value && value !== 0) return null;
  if (value instanceof Date) {
    const cloned = new Date(value.getTime());
    // ป้องกันปัญหาเลื่อนวันจากค่าทศนิยมปัดเศษของ Excel (เช่น 23:59:56 -> 00:00:00)
    // โดยปัดเศษเวลาไปยังนาทีที่ใกล้เคียงที่สุด
    const rounded = new Date(Math.round(cloned.getTime() / 60000) * 60000);
    return _validateDate(rounded);
  }
  if (typeof value === 'number') return _fromExcelSerial(value);

  const s = value.toString().trim();
  if (!s) return null;

  return (
    _tryExcelSerial(s) ??
    _tryYearStr(s) ??
    _tryISO(s) ??   // YYYY-MM-DD
    _tryMonthStr(s) ?? // YYYY-MM
    _tryThai(s) ??   // DD/MM/YYYY or DD-MM-YYYY (BE or CE)
    _tryWeekStr(s) ?? // YYYY-W01 or BE-W01
    _tryNative(s)
  );
}

/** แปลง Date → key string ตาม mode */
export function toDateKey(date: Date, mode: DateMode): string {
  switch (mode) {
    case 'daily': return _localDateStr(date);
    case 'weekly': return calcISOWeek(date);
    case 'weekly_epi': return calcThaiEpiWeek(date).label;
    case 'monthly': return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    case 'yearly': return `${date.getFullYear()}`;
    default: return _localDateStr(date);
  }
}

/** แปลง raw value → date key ในครั้งเดียว */
export function parseToKey(value: unknown, mode: DateMode): string {
  const d = parseDate(value);
  return d ? toDateKey(d, mode) : 'unknown';
}

// ──────────────────────────────────────────
// Thai Epi Week
// ──────────────────────────────────────────
export interface ThaiEpiWeekInfo {
  label: string;     // "2567-W12"
  yearBE: number;
  weekNum: number;
  startDate: Date;
}

export function calcThaiEpiWeek(date: Date): ThaiEpiWeekInfo {
  const d = new Date(date); d.setHours(0, 0, 0, 0);

  const _start = (y: number) => {
    const jan1 = new Date(y, 0, 1);
    const firstWednesday = new Date(y, 0, 1 + ((3 - jan1.getDay() + 7) % 7));
    const s = new Date(firstWednesday);
    s.setDate(s.getDate() - 3); // Sunday of the week containing the first Wednesday
    return s;
  };

  const year = d.getFullYear();
  const startThis = _start(year);
  const startNext = _start(year + 1);

  let targetYear: number, targetStart: Date;
  if (d < startThis) { targetYear = year - 1; targetStart = _start(year - 1); }
  else if (d >= startNext) { targetYear = year + 1; targetStart = startNext; }
  else { targetYear = year; targetStart = startThis; }

  const weekNum = Math.floor((d.getTime() - targetStart.getTime()) / 604800000) + 1;
  return {
    label: `${targetYear + 543}-W${String(weekNum).padStart(2, '0')}`,
    yearBE: targetYear + 543,
    weekNum,
    startDate: targetStart,
  };
}

export function calcISOWeek(d: Date): string {
  const date = new Date(d); date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const w1 = new Date(date.getFullYear(), 0, 4);
  const wn = 1 + Math.round(((date.getTime() - w1.getTime()) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
  return `${date.getFullYear()}-W${String(wn).padStart(2, '0')}`;
}

/** ISO Week key + label ปี พ.ศ. (ใช้แค่การแสดงผล, ไม่ใช้เป็น dict key) */
export function calcISOWeekBE(d: Date): string {
  const key = calcISOWeek(d);                 // e.g. "2024-W05"
  const [year, week] = key.split('-');
  return `${parseInt(year) + 543}-${week}`;   // e.g. "2567-W05"
}

// ──────────────────────────────────────────
// Date Range Helpers
// ──────────────────────────────────────────
export interface PeriodBucket {
  key: string;
  label: string;
  date: Date;
}

const MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export function getPeriodLabel(date: Date, mode: DateMode): string {
  const be = date.getFullYear() + 543;
  switch (mode) {
    case 'daily': return `${date.getDate()} ${MONTHS_FULL[date.getMonth()]} ${be}`;
    case 'weekly': return calcISOWeekBE(date);    // สัปดาห์ ISO ปี พ.ศ.
    case 'weekly_epi': return calcThaiEpiWeek(date).label;
    case 'monthly': return `${MONTHS_FULL[date.getMonth()]} ${be}`;
    case 'yearly': return `ปี พ.ศ. ${be}`;
  }
}

export function getWeekRange(date: Date, type: 'iso' | 'epi'): string {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  if (type === 'epi') {
    start.setDate(start.getDate() - start.getDay());
  } else {
    const day = start.getDay();
    start.setDate(start.getDate() - day + (day === 0 ? -6 : 1));
  }
  const end = new Date(start.getTime() + 6 * 86400000);
  const fmt = (d: Date) => `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  return `${fmt(start)} - ${fmt(end)}`;
}

/** สร้าง array ของ PeriodBucket ครบทุกช่วง (ไม่มีรู) */
export function generatePeriods(startDate: Date, endDate: Date, mode: DateMode): PeriodBucket[] {
  const periods: PeriodBucket[] = [];
  const seen = new Set<string>();
  
  let current = new Date(startDate); current.setHours(0, 0, 0, 0);
  let end = new Date(endDate); end.setHours(23, 59, 59, 999);

  // Align dates to the start of their respective periods to ensure boundaries are inclusive
  if (mode === 'weekly') {
    const currentDay = current.getDay();
    current.setDate(current.getDate() - currentDay + (currentDay === 0 ? -6 : 1));

    const endDay = end.getDay();
    end.setDate(end.getDate() - endDay + (endDay === 0 ? -6 : 1));
  } else if (mode === 'weekly_epi') {
    const currentDay = current.getDay();
    current.setDate(current.getDate() - currentDay);

    const endDay = end.getDay();
    end.setDate(end.getDate() - endDay);
  } else if (mode === 'monthly') {
    current.setDate(1);
    end.setDate(1);
  } else if (mode === 'yearly') {
    current.setMonth(0, 1);
    end.setMonth(0, 1);
  }

  current.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    const key = toDateKey(current, mode);
    if (!seen.has(key)) {
      periods.push({ key, label: getPeriodLabel(current, mode), date: new Date(current) });
      seen.add(key);
    }
    // ขยับ
    if (mode === 'daily') {
      current.setDate(current.getDate() + 1);
    } else if (mode === 'weekly' || mode === 'weekly_epi') {
      current.setDate(current.getDate() + 7);
    } else if (mode === 'monthly') {
      current.setMonth(current.getMonth() + 1);
      current.setDate(1);
    } else if (mode === 'yearly') {
      current.setFullYear(current.getFullYear() + 1);
      current.setMonth(0, 1);
    }
  }
  return periods;
}

// ──────────────────────────────────────────
// Internal Helpers
// ──────────────────────────────────────────
function _validateDate(d: Date): Date | null {
  if (isNaN(d.getTime())) return null;
  if (d.getFullYear() > 2400) d.setFullYear(d.getFullYear() - 543);
  return d;
}

function _fromExcelSerial(n: number): Date | null {
  if (n > 20000) return _validateDate(new Date((n - 25569) * 86400000 + 43200000));
  if (n >= 1900 && n <= 2100) return new Date(n, 0, 1);
  if (n >= 2443 && n <= 2643) return new Date(n - 543, 0, 1); // Support B.E. numeric years (1900 to 2100 CE)
  return null;
}

function _tryExcelSerial(s: string): Date | null {
  if (/^\d{5}$/.test(s)) return _fromExcelSerial(parseInt(s));
  return null;
}

function _tryYearStr(s: string): Date | null {
  const m = s.match(/^(\d{4})$/);
  if (!m) return null;
  let y = parseInt(m[1]);
  if (y > 2400) y -= 543;
  return _validateDate(new Date(y, 0, 1));
}

function _tryISO(s: string): Date | null {
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!m) return null;
  let y = parseInt(m[1]);
  if (y > 2400) y -= 543;
  return _validateDate(new Date(y, parseInt(m[2]) - 1, parseInt(m[3])));
}

function _tryThai(s: string): Date | null {
  const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (!m) return null;
  let y = parseInt(m[3]);
  if (y < 100) y += 2000;
  if (y > 2400) y -= 543;
  return _validateDate(new Date(y, parseInt(m[2]) - 1, parseInt(m[1])));
}

function _tryNative(s: string): Date | null {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : _validateDate(d);
}

function _tryMonthStr(s: string): Date | null {
  const m = s.match(/^(\d{4})[-/](\d{1,2})$/);
  if (!m) return null;
  let y = parseInt(m[1]);
  if (y > 2400) y -= 543;
  return _validateDate(new Date(y, parseInt(m[2]) - 1, 1));
}

function _tryWeekStr(s: string): Date | null {
  const m = s.match(/^(\d{4})[-_]W(\d{1,2})$/i) || s.match(/^W(\d{1,2})$/i);
  if (!m) return null;
  let y = new Date().getFullYear();
  let w = 1;
  if (m.length === 3) {
    y = parseInt(m[1]);
    w = parseInt(m[2]);
  } else {
    w = parseInt(m[1]);
  }
  if (y > 2400) y -= 543;
  const d = new Date(y, 0, 1 + (w - 1) * 7);
  return _validateDate(d);
}

function _localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
