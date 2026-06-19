/**
 * registry.ts — Spatial Registry with Hash Index
 * Pre-builds O(1) lookup indexes from GeoJSON features
 * รองรับ 3 ระดับ: province / district / subdistrict
 */
import { cleanName, expandMueang, repairGeoJSONProperties } from './thaiNormalizer'
import type { AdminLevel } from '../store/useAppStore'
import { locationResolver, cleanEnglishName } from './locationResolver'

export interface GeoFeature {
  type: 'Feature'
  geometry: unknown
  properties: Record<string, unknown>
}

export interface GeoJSON {
  type: 'FeatureCollection'
  features: GeoFeature[]
}

// ──────────────────────────────────────────
// Code extraction helpers
// ──────────────────────────────────────────
function extractCode(props: Record<string, unknown>, level: AdminLevel): string {
  if (level === 'subdistrict') {
    const c = String(props.Admin_code ?? props.T_code ?? '')
    return c.replace(/\D/g, '').padStart(6, '0')
  }
  if (level === 'district') {
    const adminCode = String(props.Admin_code ?? props.A_code_full ?? '')
    if (adminCode) return adminCode.replace(/\D/g, '').padStart(4, '0')
    const p = String(props.P_code ?? '').replace(/\D/g, '').padStart(2, '0')
    const a = String(props.A_code ?? '').replace(/\D/g, '').padStart(2, '0')
    return p && a ? p + a : ''
  }
  // province
  return String(props.P_code ?? '').replace(/\D/g, '').padStart(2, '0')
}

function extractNameKeys(props: Record<string, unknown>, level: AdminLevel): string[] {
  const p = cleanName(String(props.P_Name_T ?? props.PV_TN ?? props.changwat ?? props.PROVINCE_NAME ?? ''))
  const a = cleanName(String(props.A_Name_T ?? props.AM_TN ?? props.amphur ?? props.AMPHOE_NAME ?? ''))
  const t = cleanName(String(props.T_Name_T ?? props.TB_TN ?? props.tambon ?? props.TAMBON_NAME ?? ''))

  if (level === 'subdistrict' && t && a && p) {
    const aExp = expandMueang(a, p)
    return [
      `${p}|${aExp}|${t}`,  // compound key
      t,                     // simple subdistrict name fallback
    ]
  }
  if (level === 'district' && a && p) {
    const aExp = expandMueang(a, p)
    return [`${p}|${aExp}`, aExp, a]
  }
  return p ? [p] : []
}

// ──────────────────────────────────────────
// SpatialRegistry
// ──────────────────────────────────────────
export class SpatialRegistry {
  private _features = new Map<string, GeoFeature>()  // id → feature
  private _codeIdx = new Map<string, string>()       // code → id
  private _nameIdxByLevel = new Map<AdminLevel, Map<string, string>>([
    ['province', new Map<string, string>()],
    ['district', new Map<string, string>()],
    ['subdistrict', new Map<string, string>()]
  ])
  private _byLevel = new Map<AdminLevel, GeoFeature[]>()
  private _ready = false

  public onLoadCallbacks: (() => void)[] = []

  get isReady() { return this._ready }

  /** โหลด GeoJSON หนึ่งระดับ */
  load(geoData: GeoJSON, level: AdminLevel): void {
    const features: GeoFeature[] = []

    // Ensure map exists for this level
    if (!this._nameIdxByLevel.has(level)) {
      this._nameIdxByLevel.set(level, new Map<string, string>())
    }
    const levelNameMap = this._nameIdxByLevel.get(level)!

    geoData.features.forEach(f => {
      // Repair encoding first
      f.properties = repairGeoJSONProperties(f.properties)

      const id = `${level}-${features.length}`
      const code = extractCode(f.properties, level)
      const keys = extractNameKeys(f.properties, level)

      this._features.set(id, f)
      if (code) this._codeIdx.set(code, id)
      keys.forEach(k => { if (k) levelNameMap.set(k, id) })

      features.push(f)

      // Register English names dynamically
      if (code) {
        if (level === 'province' && f.properties.P_Name_E) {
          const nameEn = cleanEnglishName(String(f.properties.P_Name_E), 'P')
          locationResolver.addEnglishName(code, nameEn)
        } else if (level === 'subdistrict') {
          if (f.properties.P_Name_E) {
            const pCode = code.substring(0, 2)
            const pNameEn = cleanEnglishName(String(f.properties.P_Name_E), 'P')
            locationResolver.addEnglishName(pCode, pNameEn)
          }
          if (f.properties.A_Name_E) {
            const aCode = code.substring(0, 4)
            const aNameEn = cleanEnglishName(String(f.properties.A_Name_E), 'A')
            locationResolver.addEnglishName(aCode, aNameEn)
          }
          if (f.properties.T_Name_E) {
            const tNameEn = cleanEnglishName(String(f.properties.T_Name_E), 'T')
            locationResolver.addEnglishName(code, tNameEn)
          }
        }
      }
    })

    this._byLevel.set(level, features)
    console.log(`[Registry] Loaded ${features.length} features for ${level}`)

    // Trigger on-load callbacks to clear invalid caches
    this.onLoadCallbacks.forEach(cb => {
      try { cb() } catch (err) { console.error('[Registry] Callback error:', err) }
    })
  }

  /** โหลดจาก URL (fetch JSON) */
  async loadFromUrl(url: string, level: AdminLevel): Promise<void> {
    const res = await fetch(url)
    const data = await res.json() as GeoJSON
    this.load(data, level)
  }

  /** โหลดจาก global variable (JS file ใน <script>) */
  loadFromGlobal(varName: string, level: AdminLevel): boolean {
    const data = (window as unknown as Record<string, unknown>)[varName] as GeoJSON | undefined
    if (!data?.features) return false
    this.load(data, level)
    return true
  }

  markReady() { this._ready = true }

  // ── Lookup ──
  findByCode(code: string): GeoFeature | undefined {
    const id = this._codeIdx.get(code)
    return id ? this._features.get(id) : undefined
  }

  findByName(key: string, level?: AdminLevel): GeoFeature | undefined {
    if (level) {
      const id = this._nameIdxByLevel.get(level)?.get(key)
      return id ? this._features.get(id) : undefined
    }
    // Fallback: search subdistrict -> district -> province
    for (const lvl of ['subdistrict', 'district', 'province'] as AdminLevel[]) {
      const id = this._nameIdxByLevel.get(lvl)?.get(key)
      if (id) {
        const feat = this._features.get(id)
        if (feat) return feat
      }
    }
    return undefined
  }

  getFeatures(level: AdminLevel): GeoFeature[] {
    return this._byLevel.get(level) ?? []
  }

  /** 3-tier lookup: Code → CompoundName → SimpleName */
  resolve(code: string, nameKeys: string[], level?: AdminLevel): GeoFeature | undefined {
    if (code) {
      const f = this.findByCode(code)
      if (f) return f
    }
    for (const k of nameKeys) {
      const f = this.findByName(k, level)
      if (f) return f
    }
    return undefined
  }

  /**
   * สร้าง Map<code, cleanedName> สำหรับแปลงรหัสจากข้อมูล user → ชื่อที่ match กับ GeoJSON
   * รองรับ P_code, A_code (4 หลัก = pCode+aCode), Admin_code (6 หลัก)
   */
  buildCodeToNameMap(): {
    provMap: Map<string, string>,
    distMap: Map<string, { prov: string; dist: string }>,
    subMap: Map<string, { prov: string; dist: string; sub: string }>,
  } {
    const provMap = new Map<string, string>()
    const distMap = new Map<string, { prov: string; dist: string }>()
    const subMap = new Map<string, { prov: string; dist: string; sub: string }>()

    // Province
    for (const f of this._byLevel.get('province') ?? []) {
      const code = String(f.properties.P_code ?? '').replace(/\D/g, '')
      const name = cleanName(String(f.properties.P_Name_T ?? f.properties.PV_TN ?? ''))
      if (code && name) provMap.set(code, name)
    }

    // District
    for (const f of this._byLevel.get('district') ?? []) {
      const pCode = String(f.properties.P_code ?? '').replace(/\D/g, '')
      const aCode = String(f.properties.A_code ?? '').replace(/\D/g, '')
      const pName = cleanName(String(f.properties.P_Name_T ?? f.properties.PV_TN ?? ''))
      const aRaw = cleanName(String(f.properties.A_Name_T ?? f.properties.AM_TN ?? ''))
      const aName = expandMueang(aRaw, pName)
      // Key formats: "5101" or full Admin_code
      const fullCode = pCode && aCode ? pCode + aCode : ''
      if (fullCode && pName && aName) distMap.set(fullCode, { prov: pName, dist: aName })
    }

    // Subdistrict
    for (const f of this._byLevel.get('subdistrict') ?? []) {
      const adminCode = String(f.properties.Admin_code ?? '').replace(/\D/g, '')
      const pName = cleanName(String(f.properties.P_Name_T ?? f.properties.PV_TN ?? ''))
      const aRaw = cleanName(String(f.properties.A_Name_T ?? f.properties.AM_TN ?? ''))
      const aName = expandMueang(aRaw, pName)
      const tName = cleanName(String(f.properties.T_Name_T ?? f.properties.TB_TN ?? ''))
      if (adminCode && pName && tName) subMap.set(adminCode, { prov: pName, dist: aName, sub: tName })
    }

    console.log(`[Registry] CodeToName maps: prov=${provMap.size} dist=${distMap.size} sub=${subMap.size}`)
    return { provMap, distMap, subMap }
  }
}

// Singleton
export const registry = new SpatialRegistry()
