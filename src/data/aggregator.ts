import { cleanName, expandMueang, findProvinceInProps, PROVINCE_CODE_MAP } from './thaiNormalizer'
import { getProvincesInZone, isPointInScope, resolveLocationByCoordinates } from './healthZones'
import { registry } from './registry'
import { locationResolver } from './locationResolver'
import { parseDate, toDateKey, getPeriodLabel, generatePeriods } from './dateParser'
import { useAppStore } from '../store/useAppStore'

export type DateDictionary = Record<string, any>

export interface PeriodBucket {
  key: string
  label: string
  date: Date
}

export const STATIC_KEY = '__static__'

/** ดึงกุญแจสถานที่แบบใหม่: ใช้รหัสมาตรฐานจาก LocationResolver */
export function getLocKeys(props: any, level: 'province' | 'district' | 'subdistrict') {
  const language = useAppStore.getState().language
  const cacheKey = `_spatioKeys_${language}`

  // 1. ถ้าเคยแกะแล้ว (Cache) ให้คืนค่าทันที
  if (props[cacheKey] && props._spatioKeysLevel === level) {
    return props[cacheKey]
  }

  let code = ''
  if (level === 'subdistrict') {
    code = String(props.Admin_code ?? props.T_code_full ?? props.t_code_full ?? props.T_code ?? props.t_code ?? '').replace(/\D/g, '').padStart(6, '0')
  } else if (level === 'district') {
    const full = String(props.A_code_full ?? props.PA_Code ?? props.pa_code ?? '').replace(/\D/g, '')
    if (full.length === 4) {
      code = full
    } else {
      const p = String(props.P_code ?? props.PV_CODE ?? props.CHANGWAT_CODE ?? props.p_code ?? '').replace(/\D/g, '').padStart(2, '0')
      const a = String(props.A_code ?? props.AM_CODE ?? props.AMPHOE_CODE ?? props.a_code ?? '').replace(/\D/g, '').padStart(2, '0')
      code = (p && a) ? p + a : ''
    }
  } else {
    code = String(props.P_code ?? props.PV_CODE ?? props.CHANGWAT_CODE ?? props.p_code ?? '').replace(/\D/g, '').padStart(2, '0')
  }

  const resolved = locationResolver.getByCode(code)
  
  let p = ''
  let a = ''
  let t = ''
  
  if (resolved) {
    if (language === 'en') {
      p = resolved.pNameEn || resolved.pName
      a = resolved.aNameEn || resolved.aName
      t = resolved.tNameEn || resolved.tName
    } else {
      p = resolved.pName
      a = resolved.aName
      t = resolved.tName
    }
  } else {
    p = findProvinceInProps(props)
  }

  const result = resolved ? {
    p, a, t,
    pCode: resolved.pCode, aCode: resolved.aCode, tCode: resolved.tCode
  } : {
    p, a: '', t: '', pCode: code.slice(0, 2), aCode: code.length >= 4 ? code.slice(0, 4) : '', tCode: code.length >= 6 ? code : ''
  }

  // 2. ฝัง Cache ไว้ในตัวข้อมูลเลย
  try {
    props[cacheKey] = result
    props._spatioKeysLevel = level
  } catch { /* ignore */ }

  return result
}

/** ตรวจสอบ Scope (ใช้ชื่อที่ล้างแล้ว) */
export function isAreaInScope(p: string, a: string, scope: { province: string; region: string; district: string }) {
  let scopeProvinces: Set<string> | null = null
  let scopeDistrict: string | null = null
  if (scope.province !== 'all') {
    scopeProvinces = new Set([cleanName(scope.province)])
    if (scope.district !== 'all') scopeDistrict = scope.district
  } else if (scope.region !== 'all') {
    const list = getProvincesInZone(Number(scope.region))
    scopeProvinces = new Set(list.map(prov => cleanName(prov)))
  }

  const cp = cleanName(p)
  const ca = cleanName(a)

  const inProv = !scopeProvinces || scopeProvinces.has(cp)
  // หากไม่มีชื่ออำเภอ (เช่น ระดับจังหวัด) หรือไม่มีตัวกรองระดับอำเภอ ให้ถือว่าตรงตาม Scope
  const inDist = !scopeDistrict || !ca || ca === cleanName(scopeDistrict)
  return inProv && inDist
}

/** 1. Build dictionary: แปลงทุกอย่างให้เป็นรหัสพื้นที่ */
export async function buildDictionary(rows: any[], keys: any, mode: 'daily' | 'weekly' | 'weekly_epi' | 'monthly' | 'yearly') {
  const dict: DateDictionary = {}
  const periodsMap = new Map<string, PeriodBucket>()

  // ต้องรอให้ Resolver พร้อมใช้งาน
  await locationResolver.init()

  rows.forEach(row => {
    const dateVal = row[keys.date]
    if (dateVal === undefined || dateVal === null || dateVal === '') return

    const d = parseDate(dateVal)
    if (!d) return

    const key = toDateKey(d, mode)
    const yearFormat = useAppStore.getState().yearFormat || 'ce'
    const label = getPeriodLabel(d, mode, yearFormat)

    if (!periodsMap.has(key)) {
      periodsMap.set(key, { key, label, date: d })
    }

    // --- การ Resolve พื้นที่ ---
    const rawP = String(row[keys.province] || '')
    const rawA = String(row[keys.district] || '')
    const rawT = String(row[keys.subdistrict] || '')
    
    let val = 1
    if (keys.value) {
      const rawVal = row[keys.value]
      if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
        const parsed = parseFloat(String(rawVal).replace(/,/g, '').trim())
        val = isNaN(parsed) ? 0 : parsed
      } else {
        val = 0
      }
    }

    // ในโหมดพิกัดจริง: ลองใช้รูปปิด Polygon วิเคราะห์ก่อนเพื่อให้ได้ อำเภอ/จังหวัด ที่ตรงตามพิกัด Lat/Lng 100%
    let pKey = '99'
    let aKey = ''
    let tKey = ''

    if (keys.lat && keys.lng) {
      const lat = parseFloat(String(row[keys.lat] || '').trim())
      const lng = parseFloat(String(row[keys.lng] || '').trim())
      if (!isNaN(lat) && !isNaN(lng)) {
        const resolvedCoord = resolveLocationByCoordinates(lat, lng)
        if (resolvedCoord) {
          pKey = resolvedCoord.pCode
          aKey = resolvedCoord.aCode
          tKey = resolvedCoord.tCode
        }
      }
    }

    // หากวิเคราะห์พิกัดไม่สำเร็จ หรือไม่พบจังหวัด ให้ถอยกลับมาใช้คอลัมน์ชื่อสถานที่
    if (pKey === '99' && !aKey) {
      const resolved = locationResolver.resolve(rawP, rawA, rawT)
      if (resolved) {
        pKey = resolved.pCode
        aKey = resolved.aCode
        tKey = resolved.tCode
      }
    }

    if (val <= 0 && !(keys.color && row[keys.color])) return

    if (!dict[key]) dict[key] = {}
    if (!dict[key][pKey]) dict[key][pKey] = { _total: 0, districts: {} }
    dict[key][pKey]._total += val

    if (aKey) {
      if (!dict[key][pKey].districts[aKey]) dict[key][pKey].districts[aKey] = { _total: 0, subdistricts: {} }
      dict[key][pKey].districts[aKey]._total += val
      if (tKey) {
        dict[key][pKey].districts[aKey].subdistricts[tKey] = (dict[key][pKey].districts[aKey].subdistricts[tKey] || 0) + val
      }
    }

    if (keys.color && row[keys.color]) {
      const colorVal = String(row[keys.color]).trim()
      if (colorVal) {
        dict[key][pKey].color = colorVal
        if (aKey && dict[key][pKey].districts[aKey]) {
          dict[key][pKey].districts[aKey].color = colorVal
        }
      }
    }
  })

  const sortedRawPeriods = Array.from(periodsMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime())
  let periods: PeriodBucket[] = sortedRawPeriods
  if (sortedRawPeriods.length > 0) {
    const minDate = sortedRawPeriods[0].date
    const maxDate = sortedRawPeriods[sortedRawPeriods.length - 1].date
    const yearFormat = useAppStore.getState().yearFormat || 'ce'
    periods = generatePeriods(minDate, maxDate, mode, yearFormat)
  }
  return { dictionary: dict, periods }
}

/** 1.5 Build dictionary from Wide Format (Matrix): หัวคอลัมน์กางแนวนอน */
export async function buildWideDictionary(rows: any[], keys: any, timeCols: string[]) {
  const dict: DateDictionary = {}
  const periodsMap = new Map<string, PeriodBucket>()

  await locationResolver.init()

  // Parse time headers first
  timeCols.forEach(col => {
    // Try parsing as standard date
    const d = parseDate(col)
    if (d && !isNaN(d.getTime())) {
      const key = toDateKey(d, 'weekly')
      const yearFormat = useAppStore.getState().yearFormat || 'ce'
      const label = getPeriodLabel(d, 'weekly', yearFormat)
      periodsMap.set(col, { key: col, label, date: d })
    } else {
      // Handle week formatting W01, 2026-W05, 2567-W05
      const mWeek = col.match(/(\d{4})[-_]W(\d{1,2})/i) || col.match(/W(\d{1,2})/i)
      let y = new Date().getFullYear()
      let w = 1
      if (mWeek) {
        if (mWeek.length === 3) {
          y = parseInt(mWeek[1])
          w = parseInt(mWeek[2])
        } else {
          w = parseInt(mWeek[1])
        }
      }
      if (y > 2400) y -= 543
      const date = new Date(y, 0, 1 + (w - 1) * 7)
      periodsMap.set(col, { key: col, label: col, date })
    }
  })

  rows.forEach(row => {
    const rawP = String(row[keys.province] || '')
    const rawA = String(row[keys.district] || '')
    const rawT = String(row[keys.subdistrict] || '')

    // ในโหมดพิกัดจริง: ลองใช้รูปปิด Polygon วิเคราะห์ก่อนเพื่อให้ได้ อำเภอ/จังหวัด ที่ตรงตามพิกัด Lat/Lng 100%
    let pKey = '99'
    let aKey = ''
    let tKey = ''

    if (keys.lat && keys.lng) {
      const lat = parseFloat(String(row[keys.lat] || '').trim())
      const lng = parseFloat(String(row[keys.lng] || '').trim())
      if (!isNaN(lat) && !isNaN(lng)) {
        const resolvedCoord = resolveLocationByCoordinates(lat, lng)
        if (resolvedCoord) {
          pKey = resolvedCoord.pCode
          aKey = resolvedCoord.aCode
          tKey = resolvedCoord.tCode
        }
      }
    }

    // หากวิเคราะห์พิกัดไม่สำเร็จ หรือไม่พบจังหวัด ให้ถอยกลับมาใช้คอลัมน์ชื่อสถานที่
    if (pKey === '99' && !aKey) {
      const resolved = locationResolver.resolve(rawP, rawA, rawT)
      if (resolved) {
        pKey = resolved.pCode
        aKey = resolved.aCode
        tKey = resolved.tCode
      }
    }

    timeCols.forEach(col => {
      const bucket = periodsMap.get(col)
      if (!bucket) return
      const key = bucket.key

      const rawVal = row[col]
      let val = 0
      if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
        const parsed = parseFloat(String(rawVal).replace(/,/g, '').trim())
        val = isNaN(parsed) ? 0 : parsed
      }

      if (val <= 0) return

      if (!dict[key]) dict[key] = {}
      if (!dict[key][pKey]) dict[key][pKey] = { _total: 0, districts: {} }
      dict[key][pKey]._total += val

      if (aKey) {
        if (!dict[key][pKey].districts[aKey]) dict[key][pKey].districts[aKey] = { _total: 0, subdistricts: {} }
        dict[key][pKey].districts[aKey]._total += val
        if (tKey) {
          dict[key][pKey].districts[aKey].subdistricts[tKey] = (dict[key][pKey].districts[aKey].subdistricts[tKey] || 0) + val
        }
      }
    })
  })

  const periods = Array.from(periodsMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime())
  return { dictionary: dict, periods }
}

/** 2. Build dictionary for static data */
export async function buildStaticDictionary(rows: any[], keys: any) {
  const dict: DateDictionary = { [STATIC_KEY]: {} }
  await locationResolver.init()

  rows.forEach(row => {
    const rawP = String(row[keys.province] || '')
    const rawA = String(row[keys.district] || '')
    const rawT = String(row[keys.subdistrict] || '')
    
    let val = 1
    if (keys.value) {
      const rawVal = row[keys.value]
      if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
        const parsed = parseFloat(String(rawVal).replace(/,/g, '').trim())
        val = isNaN(parsed) ? 0 : parsed
      } else {
        val = 0
      }
    }

    // ในโหมดพิกัดจริง: ลองใช้รูปปิด Polygon วิเคราะห์ก่อนเพื่อให้ได้ อำเภอ/จังหวัด ที่ตรงตามพิกัด Lat/Lng 100%
    let pKey = '99'
    let aKey = ''
    let tKey = ''

    if (keys.lat && keys.lng) {
      const lat = parseFloat(String(row[keys.lat] || '').trim())
      const lng = parseFloat(String(row[keys.lng] || '').trim())
      if (!isNaN(lat) && !isNaN(lng)) {
        const resolvedCoord = resolveLocationByCoordinates(lat, lng)
        if (resolvedCoord) {
          pKey = resolvedCoord.pCode
          aKey = resolvedCoord.aCode
          tKey = resolvedCoord.tCode
        }
      }
    }

    // หากวิเคราะห์พิกัดไม่สำเร็จ หรือไม่พบจังหวัด ให้ถอยกลับมาใช้คอลัมน์ชื่อสถานที่
    if (pKey === '99' && !aKey) {
      const resolved = locationResolver.resolve(rawP, rawA, rawT)
      if (resolved) {
        pKey = resolved.pCode
        aKey = resolved.aCode
        tKey = resolved.tCode
      }
    }

    if (val <= 0 && !(keys.color && row[keys.color])) return

    if (!dict[STATIC_KEY][pKey]) dict[STATIC_KEY][pKey] = { _total: 0, districts: {} }
    dict[STATIC_KEY][pKey]._total += val

    if (aKey) {
      if (!dict[STATIC_KEY][pKey].districts[aKey]) dict[STATIC_KEY][pKey].districts[aKey] = { _total: 0, subdistricts: {} }
      dict[STATIC_KEY][pKey].districts[aKey]._total += val
      if (tKey) {
        dict[STATIC_KEY][pKey].districts[aKey].subdistricts[tKey] = (dict[STATIC_KEY][pKey].districts[aKey].subdistricts[tKey] || 0) + val
      }
    }

    if (keys.color && row[keys.color]) {
      const colorVal = String(row[keys.color]).trim()
      if (colorVal) {
        dict[STATIC_KEY][pKey].color = colorVal
        if (aKey && dict[STATIC_KEY][pKey].districts[aKey]) {
          dict[STATIC_KEY][pKey].districts[aKey].color = colorVal
        }
      }
    }
  })
  return { dictionary: dict, periods: [{ key: STATIC_KEY, label: 'ข้อมูลทั้งหมด', date: new Date() }] }
}

/** 3. Helper to get value: ใช้รหัส (Code) เท่านั้นเพื่อความแม่นยำ 100% */
export function getDictValue(
  dict: any,
  key: string,
  p: string,
  a: string,
  t: string,
  level: 'province' | 'district' | 'subdistrict',
  pCode?: string,
  aCode?: string,
  tCode?: string
): number {
  const slice = dict[key]
  if (!slice) return 0

  if (level === 'province') {
    return slice[pCode || '']?._total || 0
  }

  const pData = slice[pCode || '']
  if (!pData) return 0

  if (level === 'district') {
    return pData.districts[aCode || '']?._total || 0
  }

  const aData = pData.districts[aCode || '']
  if (!aData) return 0

  return aData.subdistricts[tCode || ''] || 0
}

/** ดึงสีโดยตรงจาก Dictionary (ถ้ามีระบุไว้) */
export function getDictColor(
  dict: any,
  key: string,
  p: string,
  a: string,
  t: string,
  level: 'province' | 'district' | 'subdistrict',
  pCode?: string,
  aCode?: string,
  tCode?: string
): string | null {
  const slice = dict[key]
  if (!slice) return null

  if (level === 'province') {
    return slice[pCode || '']?.color || null
  } else if (level === 'district') {
    return slice[pCode || '']?.districts[aCode || '']?.color || null
  } else if (level === 'subdistrict') {
    return slice[pCode || '']?.districts[aCode || '']?.subdistrictColors?.[tCode || ''] || null
  }

  return null
}


/** สร้างเนื้อหา Tooltip มาตรฐาน */
export function makeTooltip(p: string, a: string, t: string, val: number, level: string): string {
  const language = useAppStore.getState().language
  
  let title = ''
  if (language === 'en') {
    title = p
    if (level === 'district') title = `${a}, ${p}`
    if (level === 'subdistrict') title = `${t}, ${a}, ${p}`
  } else {
    const cp = p.replace(/^(จังหวัด|จ\.)/, '').trim()
    const ca = a.replace(/^(อำเภอ|อ\.)/, '').trim()
    const ct = t.replace(/^(ตำบล|ต\.)/, '').trim()
    title = `จ.${cp}`
    if (level === 'district') title = `อ.${ca}, ${title}`
    if (level === 'subdistrict') title = `ต.${ct}, อ.${ca}, ${title}`
  }

  return `
    <div class="flex flex-col gap-1 font-sans">
      <div class="font-bold text-spatio-text border-b border-spatio-border/50 pb-1 mb-1">${title}</div>
      <div class="flex items-center justify-between gap-4">
        <span class="text-spatio-muted">Value:</span>
        <span class="font-mono font-bold text-spatio-text">${val.toLocaleString()}</span>
      </div>
    </div>
  `
}

function getWeekNumber(d: Date, type: 'iso' | 'epi'): number {
  const date = new Date(d.getTime())
  date.setHours(0, 0, 0, 0)
  if (type === 'iso') {
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7)
    const week1 = new Date(date.getFullYear(), 0, 4)
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)
  } else {
    const startOfYear = new Date(date.getFullYear(), 0, 1)
    const days = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000)
    return Math.floor((days + startOfYear.getDay()) / 7) + 1
  }
}

// ระบบ Memoization สำหรับข้อมูลสะสม
let _cumulativeCache = new Map<string, any>()
export function clearCumulativeCache() { _cumulativeCache = new Map<string, any>() }

/** 4. Accumulate data (พร้อมระบบ Memoization เพื่อความเร็วสูง) */
export function buildCumulativeSlice(dict: DateDictionary, periods: PeriodBucket[], stepIndex: number) {
  // สร้าง Unique Key สำหรับการ Cache (อ้างอิงจากรหัสเวลาและจำนวน Period)
  const cacheKey = `${periods[stepIndex].key}_${periods.length}_${Object.keys(dict).length}`
  if (_cumulativeCache.has(cacheKey)) return _cumulativeCache.get(cacheKey)

  const merged: any = {}
  for (let i = 0; i <= stepIndex; i++) {
    const p = periods[i]
    const slice = dict[p.key] || {}
    for (const [pk, pData] of Object.entries(slice)) {
      if (!merged[pk]) merged[pk] = { _total: 0, districts: {} }
      merged[pk]._total += (pData as any)._total
      for (const [ak, aData] of Object.entries((pData as any).districts)) {
        if (!merged[pk].districts[ak]) merged[pk].districts[ak] = { _total: 0, subdistricts: {} }
        merged[pk].districts[ak]._total += (aData as any)._total
        for (const [tk, tVal] of Object.entries((aData as any).subdistricts)) {
          merged[pk].districts[ak].subdistricts[tk] = (merged[pk].districts[ak].subdistricts[tk] ?? 0) + (tVal as number)
        }
      }
    }
  }

  const result = { '__cumulative__': merged }
  _cumulativeCache.set(cacheKey, result)
  return result
}

/** 4.5 Accumulate data for dynamic multi-selection */
export function buildSelectionSlice(dict: DateDictionary, periods: PeriodBucket[], selectedPeriods: Set<string>) {
  const merged: any = {}
  
  periods.forEach(p => {
    if (!selectedPeriods.has(p.key)) return
    const slice = dict[p.key] || {}
    for (const [pk, pData] of Object.entries(slice)) {
      if (!merged[pk]) merged[pk] = { _total: 0, districts: {} }
      merged[pk]._total += (pData as any)._total
      
      for (const [ak, aData] of Object.entries((pData as any).districts)) {
        if (!merged[pk].districts[ak]) merged[pk].districts[ak] = { _total: 0, subdistricts: {} }
        merged[pk].districts[ak]._total += (aData as any)._total
        
        for (const [tk, tVal] of Object.entries((aData as any).subdistricts)) {
          merged[pk].districts[ak].subdistricts[tk] = (merged[pk].districts[ak].subdistricts[tk] ?? 0) + (tVal as number)
        }
      }
    }
  })

  return { '__selection__': merged }
}

/** 5. Global Stats (Optimized: Dictionary-First Approach) */
export function calculateGlobalStats(
  dictionary: DateDictionary,
  periods: PeriodBucket[],
  level: 'province' | 'district' | 'subdistrict',
  scope: { region: string; province: string; district: string; subdistrict?: string },
  isCumulative: boolean,
  geoMode?: 'admin' | 'coordinate',
  rawRows?: any[],
  dataKeys?: any,
  groupingMode?: 'daily' | 'weekly' | 'weekly_epi' | 'monthly' | 'yearly'
) {
  const allValues: number[] = []
  let gMax = 0
  let gPeak = { value: 0, location: '—', date: '—' }

  // เตรียม Scope Filter เพื่อความเร็ว
  let scopePCodes: Set<string> | null = null
  let scopeACode: string | null = null
  let scopeTCode: string | null = null

  // สร้างดัชนีระบุรหัสจังหวัดแบบ Static เพื่อความเสถียร 100% ป้องกันจังหวัดหายหาก Resolver ยังโหลดไม่เสร็จ!
  const nameToCode = new Map<string, string>()
  Object.entries(PROVINCE_CODE_MAP).forEach(([code, name]) => {
    nameToCode.set(cleanName(name), code)
  })

  if (scope.province !== 'all') {
    const cleanedProv = cleanName(scope.province)
    const pCode = nameToCode.get(cleanedProv) || locationResolver.resolve(scope.province, '', '')?.pCode
    if (pCode) {
      scopePCodes = new Set([pCode])
      if (scope.district !== 'all') {
        scopeACode = locationResolver.resolve(scope.province, scope.district, '')?.aCode || null
        if (scope.subdistrict && scope.subdistrict !== 'all') {
          scopeTCode = locationResolver.resolve(scope.province, scope.district, scope.subdistrict)?.tCode || null
        }
      }
    }
  } else if (scope.region !== 'all') {
    const list = getProvincesInZone(Number(scope.region))
    const codes = list.map(n => {
      const cleaned = cleanName(n)
      return nameToCode.get(cleaned) || locationResolver.resolve(n, '', '')?.pCode
    }).filter(Boolean) as string[]
    scopePCodes = new Set(codes)
  }

  const language = useAppStore.getState().language

  // วนลูปตามข้อมูลที่มี (Dictionary) แทนการวนลูปพื้นที่ทั้งหมด
  const processSlice = (slice: any, dateLabel: string) => {
    if (!slice) return
    for (const [pCode, pData] of Object.entries(slice)) {
      if (scopePCodes && !scopePCodes.has(pCode)) continue
      const pd = pData as any
      const pRes = locationResolver.getByCode(pCode)
      const pName = pRes?.pName || pCode
      const pNameEn = pRes?.pNameEn || pName
      
      if (level === 'province') {
        const v = pd._total; if (v > 0) {
          allValues.push(v)
          if (v > gMax) {
            gMax = v
            const cpName = pName.replace(/^(จังหวัด|จ\.)/, '').trim()
            const location = language === 'en' ? pNameEn : `จ.${cpName}`
            gPeak = { value: v, location, date: dateLabel }
          }
        }
        continue
      }

      for (const [aCode, aData] of Object.entries(pd.districts)) {
        if (scopeACode && aCode !== scopeACode) continue
        const ad = aData as any
        const aRes = locationResolver.getByCode(aCode)
        const aName = aRes?.aName || aCode
        const aNameEn = aRes?.aNameEn || aName

        if (level === 'district') {
          const v = ad._total; if (v > 0) {
            allValues.push(v)
            if (v > gMax) {
              gMax = v
              const cpName = pName.replace(/^(จังหวัด|จ\.)/, '').trim()
              const caName = aName.replace(/^(อำเภอ|อ\.)/, '').trim()
              const location = language === 'en' ? `${aNameEn}, ${pNameEn}` : `อ.${caName}, จ.${cpName}`
              gPeak = { value: v, location, date: dateLabel }
            }
          }
          continue
        }

        for (const [tCode, v] of Object.entries(ad.subdistricts)) {
          if (scopeTCode && tCode !== scopeTCode) continue
          const val = v as number
          if (val > 0) {
            const tRes = locationResolver.getByCode(tCode)
            const tName = tRes?.tName || tCode
            const tNameEn = tRes?.tNameEn || tName
            allValues.push(val)
            if (val > gMax) {
              gMax = val
              const cpName = pName.replace(/^(จังหวัด|จ\.)/, '').trim()
              const caName = aName.replace(/^(อำเภอ|อ\.)/, '').trim()
              const ctName = tName.replace(/^(ตำบล|ต\.)/, '').trim()
              const location = language === 'en' ? `${tNameEn}, ${aNameEn}, ${pNameEn}` : `ต.${ctName}, อ.${caName}, จ.${cpName}`
              gPeak = { value: val, location, date: dateLabel }
            }
          }
        }
      }
    }
  }

  if (isCumulative) {
    const finalStep = periods.length - 1
    const finalDict = buildCumulativeSlice(dictionary, periods, finalStep)
    processSlice(finalDict['__cumulative__'], periods[finalStep].label)
  } else {
    for (const p of periods) {
      processSlice(dictionary[p.key], p.label)
    }
  }

  const sorted = [...allValues].sort((a, b) => a - b)
  const count = sorted.length
  return {
    allValues, max: gMax, peak: gPeak, count,
    min: count > 0 ? sorted[0] : 0,
    mean: count > 0 ? allValues.reduce((a, b) => a + b, 0) / count : 0,
    median: count > 0 ? sorted[Math.floor(count * 0.5)] : 0,
    p25: count > 0 ? sorted[Math.floor(count * 0.25)] : 0,
    p75: count > 0 ? sorted[Math.floor(count * 0.75)] : 0,
    sum: allValues.reduce((a, b) => a + b, 0)
  }
}
