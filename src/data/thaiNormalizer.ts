/**
 * thaiNormalizer.ts — Pure Thai Text Normalization Functions
 * SpatioEvolution Core Data Layer
 *
 * ✅ Pure functions — ไม่มี side effects, ทดสอบได้ 100%
 * ✅ ใช้ได้ทั้งใน Main Thread และ Web Worker
 */

// ──────────────────────────────────────────
// Mojibake Repair (V5 Stable)
// ──────────────────────────────────────────
const MOJIBAKE_PATTERN = /เธ|เธฒ|à¸|à¹|ร |รต|รบ|รจ/;

const SPECIAL_BYTE_MAP: Record<number, number> = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
  0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
  0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
  0x017E: 0x9E, 0x0178: 0x9F,
};

/** ซ่อมอักขระภาษาไทยที่เพี้ยน (Mojibake) */
export function repairMojibake(text: string): string {
  if (!text || text.length < 2) return text;
  if (!MOJIBAKE_PATTERN.test(text)) return text;

  try {
    const bytes = Uint8Array.from(text, (c) => {
      const code = c.charCodeAt(0);
      if (code >= 0x0E00 && code <= 0x0E7F) return code - 0x0E00 + 0xA0;
      return SPECIAL_BYTE_MAP[code] ?? (code & 0xFF);
    });
    const fixed = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (/[\u0E01-\u0E7F]/.test(fixed) && !MOJIBAKE_PATTERN.test(fixed)) return fixed;
  } catch { /* ignore */ }

  return text;
}

// ──────────────────────────────────────────
// Prefix Stripping
// ──────────────────────────────────────────
const THAI_ADMIN_PREFIXES = /จังหวัด|อำเภอ|ตำบล|เขต|แขวง|จ\.|อ\.|ต\./g;

const ENG_ADMIN_PREFIXES = /CHANGWAT|AMPHOE|AMPHUR|TAMBON|DISTRICT|SUBDISTRICT/gi;
const GARBAGE_CHARS = /[\uFFFD\u0000-\u001F]/g;

/** ทำความสะอาดชื่อสถานที่ — NFC + repair + ตัด prefix */
export function cleanName(raw: string | null | undefined): string {
  if (!raw) return '';
  let s = raw.toString().normalize('NFC');
  s = repairMojibake(s);
  return s
    .replace(THAI_ADMIN_PREFIXES, '')
    .replace(ENG_ADMIN_PREFIXES, '')
    .replace(GARBAGE_CHARS, '')
    .replace(/^(จังหวัด|อำเภอ|เขต|ตำบล|แขวง)/, '')
    .trim()
}

/** รายชื่อ 77 จังหวัดมาตรฐาน (Cleaned) */
export const THAI_PROVINCES = [
  'เชียงใหม่', 'ลำพูน', 'ลำปาง', 'แม่ฮ่องสอน', 'เชียงราย', 'พะเยา', 'แพร่', 'น่าน',
  'พิษณุโลก', 'ตาก', 'สุโขทัย', 'เพชรบูรณ์', 'อุตรดิตถ์',
  'นครสวรรค์', 'กำแพงเพชร', 'พิจิตร', 'อุทัยธานี', 'ชัยนาท',
  'สระบุรี', 'นนทบุรี', 'ปทุมธานี', 'พระนครศรีอยุธยา', 'ลพบุรี', 'สิงห์บุรี', 'อ่างทอง', 'นครนายก',
  'ราชบุรี', 'นครปฐม', 'สุพรรณบุรี', 'กาญจนบุรี', 'สมุทรสาคร', 'สมุทรสงคราม', 'เพชรบุรี', 'ประจวบคีรีขันธ์',
  'ชลบุรี', 'สมุทรปราการ', 'ฉะเชิงเทรา', 'ระยอง', 'จันทบุรี', 'ตราด', 'ปราจีนบุรี', 'สระแก้ว',
  'ขอนแก่น', 'มหาสารคาม', 'กาฬสินธุ์', 'ร้อยเอ็ด',
  'อุดรธานี', 'สกลนคร', 'นครพนม', 'เลย', 'หนองคาย', 'หนองบัวลำภู', 'บึงกาฬ',
  'นครราชสีมา', 'ชัยภูมิ', 'บุรีรัมย์', 'สุรินทร์',
  'อุบลราชธานี', 'ศรีสะเกษ', 'ยโสธร', 'อำนาจเจริญ', 'มุกดาหาร',
  'สุราษฎร์ธานี', 'นครศรีธรรมราช', 'ภูเก็ต', 'กระบี่', 'พังงา', 'ระนอง', 'ชุมพร',
  'สงขลา', 'สตูล', 'ตรัง', 'พัทลุง', 'ปัตตานี', 'ยะลา', 'นราธิวาส', 'กรุงเทพมหานคร'
].map(p => cleanName(p));

/** Mapping รหัสจังหวัด (DOPA/ISO) เป็นชื่อจังหวัด */
export const PROVINCE_CODE_MAP: Record<string, string> = {
  "10": "กรุงเทพมหานคร", "11": "สมุทรปราการ", "12": "นนทบุรี", "13": "ปทุมธานี", "14": "พระนครศรีอยุธยา",
  "15": "อ่างทอง", "16": "ลพบุรี", "17": "สิงห์บุรี", "18": "ชัยนาท", "19": "สระบุรี",
  "20": "ชลบุรี", "21": "ระยอง", "22": "จันทบุรี", "23": "ตราด", "24": "ฉะเชิงเทรา", "25": "ปราจีนบุรี", "26": "นครนายก", "27": "สระแก้ว",
  "30": "นครราชสีมา", "31": "บุรีรัมย์", "32": "สุรินทร์", "33": "ศรีสะเกษ", "34": "อุบลราชธานี", "35": "ยโสธร", "36": "ชัยภูมิ", "37": "อำนาจเจริญ", "38": "บึงกาฬ", "39": "หนองบัวลำภู",
  "40": "ขอนแก่น", "41": "อุดรธานี", "42": "เลย", "43": "หนองคาย", "44": "มหาสารคาม", "45": "ร้อยเอ็ด", "46": "กาฬสินธุ์", "47": "สกลนคร", "48": "นครพนม", "49": "มุกดาหาร",
  "50": "เชียงใหม่", "51": "ลำพูน", "52": "ลำปาง", "53": "อุตรดิตถ์", "54": "แพร่", "55": "น่าน", "56": "พะเยา", "57": "เชียงราย", "58": "แม่ฮ่องสอน",
  "60": "นครสวรรค์", "61": "อุทัยธานี", "62": "กำแพงเพชร", "63": "ตาก", "64": "สุโขทัย", "65": "พิษณุโลก", "66": "พิจิตร", "67": "เพชรบูรณ์",
  "70": "ราชบุรี", "71": "กาญจนบุรี", "72": "สุพรรณบุรี", "73": "นครปฐม", "74": "สมุทรสาคร", "75": "สมุทรสงคราม", "76": "เพชรบุรี", "77": "ประจวบคีรีขันธ์",
  "80": "นครศรีธรรมราช", "81": "กระบี่", "82": "พังงา", "83": "ภูเก็ต", "84": "สุราษฎร์ธานี", "85": "ระนอง", "86": "ชุมพร",
  "90": "สงขลา", "91": "สตูล", "92": "ตรัง", "93": "พัทลุง", "94": "ปัตตานี", "95": "ยะลา", "96": "นราธิวาส"
};

/** 
 * ค้นหาชื่อจังหวัดจากทุกๆ properties 
 * แบบโหดพิเศษ: เช็คทั้งรหัสจังหวัด (ที่ไม่มีวันเพี้ยน) และชื่อไทย (ลอจิกเสริมเกราะ)
 */
export function findProvinceInProps(props: Record<string, unknown>): string {
  // 1. ลองหาจากรหัสจังหวัดก่อน (มั่นใจที่สุด เพราะตัวเลขไม่เพี้ยนตาม Encoding)
  const pCodeFields = ['P_code', 'PV_CODE', 'CHANGWAT_CODE', 'p_code', 'PROVINCE_CODE'];
  for (const f of pCodeFields) {
    if (props[f]) {
      const code = String(props[f]).replace(/\D/g, '').slice(0, 2);
      if (PROVINCE_CODE_MAP[code]) return cleanName(PROVINCE_CODE_MAP[code]);
    }
  }

  // 2. ถ้าหาโค้ดไม่เจอ ค่อยหาจากชื่อไทย
  for (const val of Object.values(props)) {
    if (typeof val !== 'string') continue
    const onlyThai = val.replace(/[^\u0E00-\u0E7F]/g, '').trim()
    if (onlyThai) {
      for (const p of THAI_PROVINCES) {
        if (onlyThai === p || onlyThai.includes(p)) return p
      }
    }
    const cleaned = cleanName(val).replace(/[^\u0E00-\u0E7F]/g, '')
    if (cleaned) {
      for (const p of THAI_PROVINCES) {
        if (cleaned === p || cleaned.includes(p)) return p
      }
    }
  }
  return ''
}

/** สร้าง Canonical Form สำหรับ matching (lowercase + no space) */
export function canonical(raw: string | null | undefined): string {
  return cleanName(raw).toLowerCase();
}

/** ขยายชื่อ "เมือง" → "เมือง[จังหวัด]" */
export function expandMueang(distName: string, provName: string): string {
  if (!distName || !provName) return distName;
  const d = cleanName(distName);
  const p = cleanName(provName);
  if (d === 'เมือง' || d === `เมือง${p}`) return `เมือง${p}`;
  return d;
}

/** สร้าง Compound Key สำหรับ matching (จ.|อ.|ต.) */
export function buildCompoundKey(prov: string, dist?: string, sub?: string): string {
  const cp = cleanName(prov);
  const ca = dist ? expandMueang(dist, prov) : '';
  const cs = sub ? cleanName(sub) : '';

  if (cs && ca && cp) return `${cp}|${ca}|${cs}`;
  if (ca && cp) return `${cp}|${ca}`;
  return cp;
}

/** เพิ่มคำนำหน้าสำหรับแสดงผล */
export function formatAdminName(name: string, type: 'p' | 'a' | 't'): string {
  if (!name) return '';
  const prefixes = { p: 'จ.', a: 'อ.', t: 'ต.' };
  const cleaned = name.replace(/^(จังหวัด|อำเภอ|ตำบล|จ\.|อ\.|ต\.)/, '').trim();
  return prefixes[type] + cleaned;
}

/** ซ่อมภาษาไทยใน GeoJSON properties (in-place) */
export function repairGeoJSONProperties(
  props: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key in props) {
    const val = props[key];
    result[key] = typeof val === 'string' ? repairMojibake(val) : val;
  }
  // Normalize codes
  if (typeof result.P_code === 'string') result.P_code = result.P_code.replace(/\D/g, '');
  if (typeof result.A_code === 'string') result.A_code = result.A_code.replace(/\D/g, '');
  if (typeof result.Admin_code === 'string') result.Admin_code = result.Admin_code.replace(/\D/g, '');
  return result;
}
