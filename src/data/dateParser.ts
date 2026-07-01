/**
 * dateParser.ts — Robust Multi-format Date Parser
 * SpatioEvolution Core Data Layer
 *
 * รองรับ: Excel serial, DD/MM/YYYY (BE+CE), YYYY-MM-DD, native Date
 * ✅ Pure functions — ไม่มี side effects
 */

export type DateMode = 'daily' | 'weekly' | 'weekly_epi' | 'monthly' | 'quarterly' | 'quarterly_fiscal' | 'yearly' | 'yearly_fiscal';

// ──────────────────────────────────────────
// System B.E. Calendar Detection & Core Helpers
// ──────────────────────────────────────────

/** ตรวจจับว่าเครื่องผู้ใช้ใช้ปฏิทิน พ.ศ. (Thai Buddhist Calendar) หรือไม่ */
export const isSystemBE = new Date(2000, 0, 1).getFullYear() === 2543;

/** ดึงปี ค.ศ. (C.E. Year) แบบเสถียร ไม่ขึ้นกับปฏิทินของเครื่อง */
export function getFullYearCE(d: Date): number {
  const yr = d.getFullYear();
  return isSystemBE ? yr - 543 : yr;
}

/** ตั้งค่าปี ค.ศ. (C.E. Year) ลงใน Date object ให้เสถียร */
export function setFullYearCE(d: Date, y: number): void {
  const year = isSystemBE ? y + 543 : y;
  d.setFullYear(year);
}

/** สร้าง Date object ใหม่ในระดับ Local Time โดยระบุปีเป็น ค.ศ. (C.E. Year) */
export function createDateCE(y: number, m: number, d: number): Date {
  const year = isSystemBE ? y + 543 : y;
  return new Date(year, m, d);
}

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
    case 'monthly': return `${getFullYearCE(date)}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    case 'quarterly': return `${getFullYearCE(date)}-Q${Math.floor(date.getMonth() / 3) + 1}`;
    case 'quarterly_fiscal': {
      const m = date.getMonth();
      const fYear = (m >= 9) ? getFullYearCE(date) + 1 : getFullYearCE(date);
      let fQuarter = 1;
      if (m >= 0 && m <= 2) fQuarter = 2;
      else if (m >= 3 && m <= 5) fQuarter = 3;
      else if (m >= 6 && m <= 8) fQuarter = 4;
      else if (m >= 9 && m <= 11) fQuarter = 1;
      return `${fYear}-FQ${fQuarter}`;
    }
    case 'yearly': return `${getFullYearCE(date)}`;
    case 'yearly_fiscal': {
      const m = date.getMonth();
      const fYear = (m >= 9) ? getFullYearCE(date) + 1 : getFullYearCE(date);
      return `${fYear}-FY`;
    }
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

export function calcThaiEpiWeek(date: Date, yearFormat: 'be' | 'ce' = 'be'): ThaiEpiWeekInfo {
  const d = new Date(date); d.setHours(0, 0, 0, 0);

  const _start = (y: number) => {
    const jan1 = createDateCE(y, 0, 1);
    const firstWednesday = createDateCE(y, 0, 1 + ((3 - jan1.getDay() + 7) % 7));
    const s = new Date(firstWednesday);
    s.setDate(s.getDate() - 3); // Sunday of the week containing the first Wednesday
    return s;
  };

  const year = getFullYearCE(d);
  const startThis = _start(year);
  const startNext = _start(year + 1);

  let targetYear: number, targetStart: Date;
  if (d < startThis) { targetYear = year - 1; targetStart = _start(year - 1); }
  else if (d >= startNext) { targetYear = year + 1; targetStart = startNext; }
  else { targetYear = year; targetStart = startThis; }

  const weekNum = Math.floor((d.getTime() - targetStart.getTime()) / 604800000) + 1;
  const displayYear = yearFormat === 'be' ? targetYear + 543 : targetYear;
  return {
    label: `${displayYear}-W${String(weekNum).padStart(2, '0')}`,
    yearBE: targetYear + 543,
    weekNum,
    startDate: targetStart,
  };
}

export function calcISOWeek(d: Date): string {
  const date = new Date(d); date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const w1 = createDateCE(getFullYearCE(date), 0, 4);
  const wn = 1 + Math.round(((date.getTime() - w1.getTime()) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
  return `${getFullYearCE(date)}-W${String(wn).padStart(2, '0')}`;
}

/** ISO Week key + label ปี พ.ศ. (ใช้แค่การแสดงผล, ไม่ใช้เป็น dict key) */
export function calcISOWeekBE(d: Date, yearFormat: 'be' | 'ce' = 'be'): string {
  const key = calcISOWeek(d);                 // e.g. "2024-W05"
  if (yearFormat === 'ce') return key;
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

export function getPeriodLabel(date: Date, mode: DateMode, yearFormat: 'be' | 'ce' = 'be', language: 'th' | 'en' = 'th'): string {
  const year = yearFormat === 'be' ? getFullYearCE(date) + 543 : getFullYearCE(date);
  switch (mode) {
    case 'daily': return `${date.getDate()} ${MONTHS_FULL[date.getMonth()]} ${year}`;
    case 'weekly': return calcISOWeekBE(date, yearFormat);    // สัปดาห์ ISO ปี พ.ศ.
    case 'weekly_epi': return calcThaiEpiWeek(date, yearFormat).label;
    case 'monthly': return `${MONTHS_FULL[date.getMonth()]} ${year}`;
    case 'quarterly': {
      const q = Math.floor(date.getMonth() / 3) + 1;
      if (language === 'th') {
        const era = yearFormat === 'be' ? 'พ.ศ.' : 'ค.ศ.';
        return `ไตรมาสที่ ${q} ${era} ${year}`;
      } else {
        const era = yearFormat === 'be' ? 'B.E.' : 'C.E.';
        return `Q${q} ${era} ${year}`;
      }
    }
    case 'quarterly_fiscal': {
      const m = date.getMonth();
      const fYear = (m >= 9) ? getFullYearCE(date) + 1 : getFullYearCE(date);
      const displayYear = yearFormat === 'be' ? fYear + 543 : fYear;
      let fQuarter = 1;
      if (m >= 0 && m <= 2) fQuarter = 2;
      else if (m >= 3 && m <= 5) fQuarter = 3;
      else if (m >= 6 && m <= 8) fQuarter = 4;
      else if (m >= 9 && m <= 11) fQuarter = 1;
      if (language === 'th') {
        return `ไตรมาสที่ ${fQuarter} (ปีงบฯ ${displayYear})`;
      } else {
        return `Fiscal Q${fQuarter} (${displayYear})`;
      }
    }
    case 'yearly': return yearFormat === 'be' ? `ปี พ.ศ. ${year}` : `Year ${year}`;
    case 'yearly_fiscal': {
      const m = date.getMonth();
      const fYear = (m >= 9) ? getFullYearCE(date) + 1 : getFullYearCE(date);
      const displayYear = yearFormat === 'be' ? fYear + 543 : fYear;
      if (language === 'th') {
        return `ปีงบประมาณ ${displayYear}`;
      } else {
        return `Fiscal Year ${displayYear}`;
      }
    }
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
export function generatePeriods(startDate: Date, endDate: Date, mode: DateMode, yearFormat: 'be' | 'ce' = 'be', language: 'th' | 'en' = 'th'): PeriodBucket[] {
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
  } else if (mode === 'quarterly' || mode === 'quarterly_fiscal') {
    const currentQStart = Math.floor(current.getMonth() / 3) * 3;
    current.setMonth(currentQStart, 1);
    const endQStart = Math.floor(end.getMonth() / 3) * 3;
    end.setMonth(endQStart, 1);
  } else if (mode === 'yearly' || mode === 'yearly_fiscal') {
    if (mode === 'yearly_fiscal') {
      if (current.getMonth() >= 9) {
        current.setMonth(9, 1);
      } else {
        setFullYearCE(current, getFullYearCE(current) - 1);
        current.setMonth(9, 1);
      }
      if (end.getMonth() >= 9) {
        end.setMonth(9, 1);
      } else {
        setFullYearCE(end, getFullYearCE(end) - 1);
        end.setMonth(9, 1);
      }
    } else {
      current.setMonth(0, 1);
      end.setMonth(0, 1);
    }
  }

  current.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    const key = toDateKey(current, mode);
    if (!seen.has(key)) {
      periods.push({ key, label: getPeriodLabel(current, mode, yearFormat, language), date: new Date(current) });
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
    } else if (mode === 'quarterly' || mode === 'quarterly_fiscal') {
      current.setMonth(current.getMonth() + 3);
      current.setDate(1);
    } else if (mode === 'yearly') {
      setFullYearCE(current, getFullYearCE(current) + 1);
      current.setMonth(0, 1);
    } else if (mode === 'yearly_fiscal') {
      setFullYearCE(current, getFullYearCE(current) + 1);
      current.setMonth(9, 1);
    }
  }
  return periods;
}

// ──────────────────────────────────────────
// Internal Helpers
// ──────────────────────────────────────────
function _validateDate(d: Date): Date | null {
  if (isNaN(d.getTime())) return null;
  // เช็คและซ่อมเฉพาะถ้าค่าปีถูกบันทึกมาตรงๆ เป็น พ.ศ. (ในแบบ CE context)
  const yr = d.getFullYear();
  if (yr > 2400) {
    d.setFullYear(yr - 543);
  }
  // ตรวจสอบและกรองปีที่กว้างเกินไป (เช่น พิมพ์ผิดเป็นปี 206 หรือ 2999)
  const ceYear = getFullYearCE(d);
  if (ceYear < 1900 || ceYear > 2100) {
    return null;
  }
  return d;
}

function _fromExcelSerial(n: number): Date | null {
  // ใช้ createDateCE แทน new Date เพื่อเลี่ยง timezone/calendar bug
  if (n > 20000) return _validateDate(createDateCE(1970, 0, 1 + Math.floor(n - 25569)));
  if (n >= 1900 && n <= 2100) return createDateCE(n, 0, 1);
  if (n >= 2443 && n <= 2643) return createDateCE(n - 543, 0, 1); // Support B.E. numeric years (1900 to 2100 CE)
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
  return _validateDate(createDateCE(y, 0, 1));
}

function _tryISO(s: string): Date | null {
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!m) return null;
  let y = parseInt(m[1]);
  if (y > 2400) y -= 543;
  return _validateDate(createDateCE(y, parseInt(m[2]) - 1, parseInt(m[3])));
}

function _tryThai(s: string): Date | null {
  const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (!m) return null;
  let y = parseInt(m[3]);
  if (y < 100) y += 2000;
  if (y > 2400) y -= 543;
  return _validateDate(createDateCE(y, parseInt(m[2]) - 1, parseInt(m[1])));
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
  return _validateDate(createDateCE(y, parseInt(m[2]) - 1, 1));
}

function _tryWeekStr(s: string): Date | null {
  const m = s.match(/^(\d{4})[-_]W(\d{1,2})$/i) || s.match(/^W(\d{1,2})$/i);
  if (!m) return null;
  let y = getFullYearCE(new Date());
  let w = 1;
  if (m.length === 3) {
    y = parseInt(m[1]);
    w = parseInt(m[2]);
  } else {
    w = parseInt(m[1]);
  }
  if (y > 2400) y -= 543;
  const d = createDateCE(y, 0, 1 + (w - 1) * 7);
  return _validateDate(d);
}

function _localDateStr(d: Date): string {
  return `${getFullYearCE(d)}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
