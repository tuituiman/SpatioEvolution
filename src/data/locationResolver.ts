import { cleanName, expandMueang } from './thaiNormalizer'

export interface ResolvedLocation {
  pCode: string
  aCode: string
  tCode: string
  pName: string
  aName: string
  tName: string
  pNameEn?: string
  aNameEn?: string
  tNameEn?: string
}

interface MasterData {
  p: Record<string, string>
  a: Record<string, [string, string]> // aCode -> [name, pCode]
  t: Record<string, [string, string]> // tCode -> [name, aCode]
}

export function cleanEnglishName(name: string, type: 'P' | 'A' | 'T'): string {
  if (!name) return ''
  let cleaned = name.trim().toUpperCase()
  if (type === 'P') {
    cleaned = cleaned.replace(/^CHANGWAT\s+/, '')
  } else if (type === 'A') {
    cleaned = cleaned.replace(/^AMPHOE\s+/, '').replace(/^KHET\s+/, '')
  } else if (type === 'T') {
    cleaned = cleaned.replace(/^TAMBON\s+/, '').replace(/^KHWAENG\s+/, '')
  }
  
  return cleaned
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

class LocationResolver {
  private _isReady = false
  private _initPromise: Promise<void> | null = null

  // High-speed lookup indexes
  private _provByName = new Map<string, string>()
  private _distByCompound = new Map<string, string>() // "pCode|aName" -> aCode
  private _subByCompound = new Map<string, string>()  // "aCode|tName" -> tCode

  private _codeToFull = new Map<string, ResolvedLocation>()

  /** 
   * โหลด Master Data จิ๋ว (จังหวัด+อำเภอ+ตำบล) ครั้งเดียวจบ
   * รองรับการเรียกซ้อนกันได้อย่างปลอดภัย (Singleton Promise)
   */
  async init(): Promise<void> {
    // 1. ถ้าโหลดเสร็จแล้ว คืนค่าทันที
    if (this._isReady) return Promise.resolve()

    // 2. ถ้ากำลังโหลดอยู่ ให้ส่ง Promise ตัวเดิมกลับไป (รอตัวเดิมให้เสร็จ)
    if (this._initPromise) return this._initPromise

    // 3. เริ่มโหลดใหม่
    this._initPromise = (async () => {
      try {
        console.log('[LocationResolver] Initializing master hierarchy...')

        let base = import.meta.env.BASE_URL || '/'
        if (!base.endsWith('/')) base += '/'
        const mainPath = `${base}data/thailand_hierarchy.json`
        const paths = [mainPath, './data/thailand_hierarchy.json', 'data/thailand_hierarchy.json', '/data/thailand_hierarchy.json']
        let res: Response | null = null

        for (const path of paths) {
          try {
            const attempt = await fetch(path)
            if (attempt.ok) {
              res = attempt
              console.log(`[LocationResolver] Data fetched from: ${path}`)
              break
            }
          } catch { /* ignore */ }
        }

        if (!res || !res.ok) throw new Error('Cannot load hierarchy data from any path')

        const data = await res.json()
        this._processData(data)
        this._isReady = true
        console.log('[LocationResolver] Master hierarchy is ready.')
      } catch (err) {
        console.error('[LocationResolver] Init Failed:', err)
        this._initPromise = null // เผื่อโหลดใหม่รอบหน้าถ้าพัง
        throw err
      }
    })()

    return this._initPromise
  }

  private _processData(data: MasterData) {
    // 1. Process Provinces
    Object.entries(data.p).forEach(([code, name]) => {
      const cleanP = cleanName(name)
      this._provByName.set(cleanP, code)
      this._codeToFull.set(code, { pCode: code, aCode: '', tCode: '', pName: name, aName: '', tName: '' })
    })

    // 2. Process Districts
    Object.entries(data.a).forEach(([aCode, [aName, pCode]]) => {
      const cleanA = cleanName(aName)
      this._distByCompound.set(`${pCode}|${cleanA}`, aCode)

      const pInfo = this._codeToFull.get(pCode)
      this._codeToFull.set(aCode, {
        pCode, aCode, tCode: '',
        pName: pInfo?.pName || '', aName: aName, tName: ''
      })
    })

    // 3. Process Subdistricts
    Object.entries(data.t).forEach(([tCode, [tName, aCode]]) => {
      const cleanT = cleanName(tName)
      this._subByCompound.set(`${aCode}|${cleanT}`, tCode)

      const aInfo = this._codeToFull.get(aCode)
      if (aInfo) {
        this._codeToFull.set(tCode, {
          pCode: aInfo.pCode, aCode, tCode,
          pName: aInfo.pName, aName: aInfo.aName, tName: tName
        })
      }
    })

    this._isReady = true
    console.log('[LocationResolver] Uniform Master Data Ready.')
  }

  /**
   * ลงทะเบียนชื่อภาษาอังกฤษของพื้นที่
   */
  addEnglishName(code: string, nameEn: string): void {
    const info = this._codeToFull.get(code)
    if (info) {
      if (code.length === 2) {
        info.pNameEn = nameEn
      } else if (code.length === 4) {
        info.aNameEn = nameEn
      } else if (code.length === 6) {
        info.tNameEn = nameEn
      }
    }
  }

  /** 
   * Resolve พื้นที่แบบ Hybrid (ฉลาดพิเศษ)
   * รองรับ: ชื่อไทย, รหัสเต็ม (2,4,6 หลัก), หรือรหัสย่อย (2+2+2 หลัก)
   */
  resolve(p: string, a: string, t: string): ResolvedLocation | null {
    if (!this._isReady) return null

    const rawP = String(p || '').trim()
    const rawA = String(a || '').trim()
    const rawT = String(t || '').trim()

    // 1. Resolve Province
    let pCode = ''
    if (/^\d{1,2}$/.test(rawP)) {
      pCode = rawP.padStart(2, '0')
    } else if (rawP) {
      const cleaned = cleanName(rawP)
      pCode = this._provByName.get(cleaned) || ''
      if (!pCode) {
        // ลองค้นหาแบบ substring เผื่อชื่อสถานที่ครอบคลุมจังหวัด เช่น "สถานีเชียงใหม่" -> "เชียงใหม่"
        for (const [provName, code] of this._provByName.entries()) {
          if (cleaned.includes(provName)) {
            pCode = code
            break
          }
        }
      }
    }
    if (!pCode) return null

    // 2. Resolve District
    let aCode = ''
    if (/^\d{4}$/.test(rawA)) {
      aCode = rawA // รหัสเต็ม 4 หลัก
    } else if (/^\d{1,2}$/.test(rawA)) {
      aCode = pCode + rawA.padStart(2, '0') // รหัสย่อย 2 หลัก ต่อท้ายจังหวัด
    } else if (rawA) {
      aCode = this._distByCompound.get(`${pCode}|${cleanName(rawA)}`) || ''
      // ลองแก้ปัญหา "อำเภอเมือง"
      if (!aCode) {
        const pInfo = this._codeToFull.get(pCode)
        if (pInfo) {
          const mueangName = expandMueang(rawA, pInfo.pName)
          aCode = this._distByCompound.get(`${pCode}|${cleanName(mueangName)}`) || ''
        }
      }
    }

    // 3. Resolve Subdistrict
    let tCode = ''
    if (/^\d{6}$/.test(rawT)) {
      tCode = rawT // รหัสเต็ม 6 หลัก
    } else if (/^\d{1,2}$/.test(rawT) && aCode) {
      tCode = aCode + rawT.padStart(2, '0') // รหัสย่อย 2 หลัก ต่อท้ายอำเภอ
    } else if (rawT && aCode) {
      tCode = this._subByCompound.get(`${aCode}|${cleanName(rawT)}`) || ''
    }

    // คืนค่าระดับที่ลึกที่สุดที่หาเจอ
    if (tCode) return this.getByCode(tCode) || this.getByCode(aCode) || this.getByCode(pCode) || null
    if (aCode) return this.getByCode(aCode) || this.getByCode(pCode) || null
    return this.getByCode(pCode) || null
  }

  getByCode(code: string): ResolvedLocation | null {
    const cleanCode = String(code || '').replace(/\D/g, '')
    // จัดการกรณีรหัสไม่เต็ม (เช่น มาแค่ 1 หลัก)
    const padded = cleanCode.length % 2 !== 0 ? cleanCode.padStart(cleanCode.length + 1, '0') : cleanCode
    const info = this._codeToFull.get(padded)
    if (!info) return null

    // Dynamically retrieve English names from hierarchy if missing
    if (!info.pNameEn && info.pCode) {
      info.pNameEn = this._codeToFull.get(info.pCode)?.pNameEn
    }
    if (!info.aNameEn && info.aCode) {
      info.aNameEn = this._codeToFull.get(info.aCode)?.aNameEn
    }
    return info
  }

  isReady() { return this._isReady }
}

export const locationResolver = new LocationResolver()
