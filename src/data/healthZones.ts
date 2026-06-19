/**
 * healthZones.ts — ข้อมูล 13 เขตสุขภาพของไทย
 * พร้อม helpers สำหรับ lookup และคำนวณ bounds
 */
import L from 'leaflet'
import { cleanName, expandMueang } from './thaiNormalizer'
import { registry } from './registry'

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────
export interface HealthZone {
  id: number
  label: string
  hq: string   // จังหวัดสำนักงาน
  provinces: string[] // ชื่อจังหวัด (clean, ไม่มีคำนำหน้า)
  bounds: [[number, number], [number, number]] // [[sw_lat, sw_lng],[ne_lat, ne_lng]]
}

// ──────────────────────────────────────────
// 13 เขตสุขภาพ
// ──────────────────────────────────────────
export const HEALTH_ZONES: HealthZone[] = [
  {
    id: 1, label: 'เขตสุขภาพที่ 1', hq: 'เชียงใหม่',
    provinces: ['เชียงใหม่', 'ลำพูน', 'ลำปาง', 'แม่ฮ่องสอน', 'เชียงราย', 'พะเยา', 'แพร่', 'น่าน'],
    bounds: [[17.2, 97.3], [20.5, 101.2]],
  },
  {
    id: 2, label: 'เขตสุขภาพที่ 2', hq: 'พิษณุโลก',
    provinces: ['พิษณุโลก', 'ตาก', 'สุโขทัย', 'เพชรบูรณ์', 'อุตรดิตถ์'],
    bounds: [[15.7, 99.0], [18.0, 101.8]],
  },
  {
    id: 3, label: 'เขตสุขภาพที่ 3', hq: 'นครสวรรค์',
    provinces: ['นครสวรรค์', 'กำแพงเพชร', 'พิจิตร', 'อุทัยธานี', 'ชัยนาท'],
    bounds: [[14.8, 99.2], [16.8, 100.5]],
  },
  {
    id: 4, label: 'เขตสุขภาพที่ 4', hq: 'สระบุรี',
    provinces: ['สระบุรี', 'นนทบุรี', 'ปทุมธานี', 'พระนครศรีอยุธยา', 'ลพบุรี', 'สิงห์บุรี', 'อ่างทอง', 'นครนายก'],
    bounds: [[13.2, 100.3], [15.2, 102.3]],
  },
  {
    id: 5, label: 'เขตสุขภาพที่ 5', hq: 'ราชบุรี',
    provinces: ['ราชบุรี', 'นครปฐม', 'สุพรรณบุรี', 'กาญจนบุรี', 'สมุทรสาคร', 'สมุทรสงคราม', 'เพชรบุรี', 'ประจวบคีรีขันธ์'],
    bounds: [[10.6, 98.9], [14.4, 100.7]],
  },
  {
    id: 6, label: 'เขตสุขภาพที่ 6', hq: 'ชลบุรี',
    provinces: ['ชลบุรี', 'สมุทรปราการ', 'ฉะเชิงเทรา', 'ระยอง', 'จันทบุรี', 'ตราด', 'ปราจีนบุรี', 'สระแก้ว'],
    bounds: [[12.0, 100.8], [13.8, 102.9]],
  },
  {
    id: 7, label: 'เขตสุขภาพที่ 7', hq: 'ขอนแก่น',
    provinces: ['ขอนแก่น', 'มหาสารคาม', 'กาฬสินธุ์', 'ร้อยเอ็ด'],
    bounds: [[15.1, 102.9], [16.8, 104.2]],
  },
  {
    id: 8, label: 'เขตสุขภาพที่ 8', hq: 'อุดรธานี',
    provinces: ['อุดรธานี', 'สกลนคร', 'นครพนม', 'เลย', 'หนองคาย', 'หนองบัวลำภู', 'บึงกาฬ'],
    bounds: [[16.5, 101.0], [18.4, 104.8]],
  },
  {
    id: 9, label: 'เขตสุขภาพที่ 9', hq: 'นครราชสีมา',
    provinces: ['นครราชสีมา', 'ชัยภูมิ', 'บุรีรัมย์', 'สุรินทร์'],
    bounds: [[14.1, 101.1], [16.2, 103.5]],
  },
  {
    id: 10, label: 'เขตสุขภาพที่ 10', hq: 'อุบลราชธานี',
    provinces: ['อุบลราชธานี', 'ศรีสะเกษ', 'ยโสธร', 'อำนาจเจริญ', 'มุกดาหาร'],
    bounds: [[14.4, 103.5], [16.0, 105.7]],
  },
  {
    id: 11, label: 'เขตสุขภาพที่ 11', hq: 'สุราษฎร์ธานี',
    provinces: ['สุราษฎร์ธานี', 'นครศรีธรรมราช', 'ภูเก็ต', 'กระบี่', 'พังงา', 'ระนอง', 'ชุมพร'],
    bounds: [[7.8, 98.4], [11.2, 100.4]],
  },
  {
    id: 12, label: 'เขตสุขภาพที่ 12', hq: 'สงขลา',
    provinces: ['สงขลา', 'สตูล', 'ตรัง', 'พัทลุง', 'ปัตตานี', 'ยะลา', 'นราธิวาส'],
    bounds: [[5.5, 99.9], [8.0, 102.1]],
  },
  {
    id: 13, label: 'เขตสุขภาพที่ 13 (กรุงเทพมหานคร)', hq: 'กรุงเทพมหานคร',
    provinces: ['กรุงเทพมหานคร'],
    bounds: [[13.4, 100.3], [13.9, 100.9]],
  },
]

// ──────────────────────────────────────────
// Helper Functions
// ──────────────────────────────────────────

/** หา zone จากชื่อจังหวัด */
export function getZoneByProvince(provinceName: string): HealthZone | undefined {
  const name = cleanName(provinceName)
  return HEALTH_ZONES.find(z => z.provinces.includes(name))
}

/** ดึงชื่อจังหวัดทั้งหมดใน zone */
export function getProvincesInZone(zoneId: number): string[] {
  return HEALTH_ZONES.find(z => z.id === zoneId)?.provinces ?? []
}

// ──────────────────────────────────────────
// Bounds Computation from Registry
// ──────────────────────────────────────────

type Bounds = [[number, number], [number, number]] // [[minLat, minLng], [maxLat, maxLng]]

/** คำนวณ bounds จาก GeoJSON feature coordinates */
function computeBoundsFromCoords(coords: number[][][]): Bounds | null {
  let minLat = Infinity, maxLat = -Infinity
  let minLng = Infinity, maxLng = -Infinity
  for (const ring of coords) {
    for (const [lng, lat] of ring) {
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
    }
  }
  if (!isFinite(minLat)) return null
  return [[minLat, minLng], [maxLat, maxLng]]
}

function extractCoords(geometry: unknown): number[][][] {
  const g = geometry as { type: string; coordinates: unknown }
  if (!g) return []
  if (g.type === 'Polygon') return g.coordinates as number[][][]
  if (g.type === 'MultiPolygon') {
    return (g.coordinates as number[][][][]).flat()
  }
  return []
}

/** คำนวณ bounds ของจังหวัดจาก registry */
export function computeProvinceBounds(provinceName: string): L.LatLngBoundsExpression | null {
  const name = cleanName(provinceName)
  const features = registry.getFeatures('district')
  const filtered = features.filter(f => {
    const p = cleanName(String(f.properties.P_Name_T ?? f.properties.PV_TN ?? ''))
    return p === name
  })
  if (filtered.length === 0) return null

  let minLat = Infinity, maxLat = -Infinity
  let minLng = Infinity, maxLng = -Infinity

  for (const f of filtered) {
    const coords = extractCoords(f.geometry)
    const b = computeBoundsFromCoords(coords)
    if (!b) continue
    if (b[0][0] < minLat) minLat = b[0][0]
    if (b[1][0] > maxLat) maxLat = b[1][0]
    if (b[0][1] < minLng) minLng = b[0][1]
    if (b[1][1] > maxLng) maxLng = b[1][1]
  }

  if (!isFinite(minLat)) return null
  return [[minLat, minLng], [maxLat, maxLng]]
}

/** คำนวณ bounds ของอำเภอจาก registry */
export function computeDistrictBounds(provinceName: string, districtName: string): L.LatLngBoundsExpression | null {
  const pName = cleanName(provinceName)
  const dName = districtName // already cleaned/expanded

  const features = registry.getFeatures('district')
  const feature = features.find(f => {
    const p = cleanName(String(f.properties.P_Name_T ?? f.properties.PV_TN ?? ''))
    const aRaw = cleanName(String(f.properties.A_Name_T ?? f.properties.AM_TN ?? ''))
    const a = expandMueang(aRaw, p)
    return p === pName && a === dName
  })
  if (!feature) return null

  const coords = extractCoords(feature.geometry)
  const b = computeBoundsFromCoords(coords)
  if (!b) return null
  return [[b[0][0], b[0][1]], [b[1][0], b[1][1]]]
}

/** ดึง list อำเภอทั้งหมดในจังหวัด จาก registry */
export function getDistrictsInProvince(provinceName: string): string[] {
  const name = cleanName(provinceName)
  const features = registry.getFeatures('district')
  const districts = new Set<string>()
  for (const f of features) {
    const p = cleanName(String(f.properties.P_Name_T ?? f.properties.PV_TN ?? ''))
    if (p !== name) continue
    const aRaw = cleanName(String(f.properties.A_Name_T ?? f.properties.AM_TN ?? ''))
    const a = expandMueang(aRaw, p)
    if (a) districts.add(a)
  }
  return Array.from(districts).sort()
}

/** คำนวณ bounds ของตำบลจาก registry */
export function computeSubdistrictBounds(provinceName: string, districtName: string, subdistrictName: string): L.LatLngBoundsExpression | null {
  const pName = cleanName(provinceName)
  const dName = districtName
  const tName = cleanName(subdistrictName)

  const features = registry.getFeatures('subdistrict')
  const feature = features.find(f => {
    const p = cleanName(String(f.properties.P_Name_T ?? f.properties.PV_TN ?? ''))
    const aRaw = cleanName(String(f.properties.A_Name_T ?? f.properties.AM_TN ?? ''))
    const a = expandMueang(aRaw, p)
    const t = cleanName(String(f.properties.T_Name_T ?? f.properties.TB_TN ?? ''))
    return p === pName && a === dName && t === tName
  })
  if (!feature) return null

  const coords = extractCoords(feature.geometry)
  const b = computeBoundsFromCoords(coords)
  if (!b) return null
  return [[b[0][0], b[0][1]], [b[1][0], b[1][1]]]
}

/** ดึง list ตำบลทั้งหมดในอำเภอ ของจังหวัด จาก registry */
export function getSubdistrictsInDistrict(provinceName: string, districtName: string): string[] {
  const pName = cleanName(provinceName)
  const dName = districtName

  const features = registry.getFeatures('subdistrict')
  const subdistricts = new Set<string>()
  for (const f of features) {
    const p = cleanName(String(f.properties.P_Name_T ?? f.properties.PV_TN ?? ''))
    if (p !== pName) continue
    const aRaw = cleanName(String(f.properties.A_Name_T ?? f.properties.AM_TN ?? ''))
    const a = expandMueang(aRaw, p)
    if (a !== dName) continue
    const t = cleanName(String(f.properties.T_Name_T ?? f.properties.TB_TN ?? ''))
    if (t) subdistricts.add(t)
  }
  return Array.from(subdistricts).sort()
}

/** ฟังก์ชันตรวจสอบจุดภายในรูปหลายเหลี่ยม (Ray casting Point-in-Polygon) */
export function pointInPolygon(lat: number, lng: number, geometry: any): boolean {
  if (!geometry) return false
  const type = geometry.type
  const coords = geometry.coordinates

  const checkPolygon = (polygonCoords: number[][][]) => {
    const outerRing = polygonCoords[0]
    if (!outerRing) return false

    let inside = false
    for (let i = 0, j = outerRing.length - 1; i < outerRing.length; j = i++) {
      const xi = outerRing[i][0] // lng
      const yi = outerRing[i][1] // lat
      const xj = outerRing[j][0]
      const yj = outerRing[j][1]

      const intersect = ((yi > lat) !== (yj > lat))
        && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)
      if (intersect) inside = !inside
    }
    return inside
  }

  if (type === 'Polygon') {
    return checkPolygon(coords)
  } else if (type === 'MultiPolygon') {
    for (const polygon of coords) {
      if (checkPolygon(polygon)) return true
    }
  }
  return false
}

// ──────────────────────────────────────────
// Spatial Grid Index — O(k) Candidate Lookup
// ──────────────────────────────────────────
class SpatialGrid {
  private _cells = new Map<string, any[]>()
  private _cellSize: number
  private _level: string | null = null

  constructor(cellSizeDegrees = 0.5) {
    this._cellSize = cellSizeDegrees
  }

  private _cellKey(lat: number, lng: number): string {
    return `${Math.floor(lat / this._cellSize)},${Math.floor(lng / this._cellSize)}`
  }

  build(features: any[], level: string): void {
    this._cells.clear()
    this._level = level
    for (const f of features) {
      const props = f.properties as any
      if (!props._spatioBbox) {
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
        const coords = extractCoords(f.geometry)
        coords.forEach((ring: number[][]) => ring.forEach((pt) => {
          if (pt[1] < minLat) minLat = pt[1]
          if (pt[1] > maxLat) maxLat = pt[1]
          if (pt[0] < minLng) minLng = pt[0]
          if (pt[0] > maxLng) maxLng = pt[0]
        }))
        props._spatioBbox = [[minLat, minLng], [maxLat, maxLng]]
      }
      const [[minLat, minLng], [maxLat, maxLng]] = props._spatioBbox
      const latMin = Math.floor(minLat / this._cellSize)
      const latMax = Math.floor(maxLat / this._cellSize)
      const lngMin = Math.floor(minLng / this._cellSize)
      const lngMax = Math.floor(maxLng / this._cellSize)
      for (let la = latMin; la <= latMax; la++) {
        for (let lo = lngMin; lo <= lngMax; lo++) {
          const key = `${la},${lo}`
          if (!this._cells.has(key)) this._cells.set(key, [])
          this._cells.get(key)!.push(f)
        }
      }
    }
  }

  getCandidates(lat: number, lng: number): any[] {
    return this._cells.get(this._cellKey(lat, lng)) ?? []
  }

  clear(): void { this._cells.clear(); this._level = null }
  get isBuilt(): boolean { return this._level !== null }
}

// Lazy grids for each admin level (built on first resolveLocationByCoordinates call)
const _subGrid = new SpatialGrid(0.5)
const _distGrid = new SpatialGrid(0.5)
const _provGrid = new SpatialGrid(1.0)

// Clear grids when registry loads new data
registry.onLoadCallbacks.push(() => {
  _subGrid.clear()
  _distGrid.clear()
  _provGrid.clear()
})

/** ค้นหาและแปลงพิกัดทางภูมิศาสตร์ Lat/Lng ให้เป็นรหัสจังหวัด อำเภอ และตำบลทางคณิตศาสตร์จาก GeoJSON boundaries */
export function resolveLocationByCoordinates(
  lat: number,
  lng: number
): { pCode: string; aCode: string; tCode: string; pName: string; aName: string; tName: string } | null {
  // 1. ค้นหาในระดับตำบลก่อน (ละเอียดและแม่นยำที่สุด)
  // ใช้ SpatialGrid เพื่อลด candidates จาก O(n) → O(k)
  const subFeatures = registry.getFeatures('subdistrict')
  if (!_subGrid.isBuilt && subFeatures.length > 0) {
    _subGrid.build(subFeatures, 'subdistrict')
  }

  const subCandidates = _subGrid.isBuilt ? _subGrid.getCandidates(lat, lng) : subFeatures
  for (const f of subCandidates) {
    const props = f.properties as any
    const [[minLat, minLng], [maxLat, maxLng]] = props._spatioBbox || [[-Infinity, -Infinity], [Infinity, Infinity]]
    if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) continue
    if (pointInPolygon(lat, lng, f.geometry)) {
      const p = cleanName(String(props.P_Name_T ?? props.PV_TN ?? props.changwat ?? props.PROVINCE_NAME ?? ''))
      const aRaw = cleanName(String(props.A_Name_T ?? props.AM_TN ?? props.amphur ?? props.AMPHOE_NAME ?? ''))
      const a = expandMueang(aRaw, p)
      const t = cleanName(String(props.T_Name_T ?? props.TB_TN ?? props.tambon ?? props.TAMBON_NAME ?? ''))
      const tCode = String(props.Admin_code ?? props.T_code ?? props.t_code_full ?? '').replace(/\D/g, '').padStart(6, '0')
      return { pCode: tCode.slice(0, 2), aCode: tCode.slice(0, 4), tCode, pName: p, aName: a, tName: t }
    }
  }

  // 2. ค้นหาในระดับอำเภอ (หากหาในระดับตำบลไม่พบ)
  const distFeatures = registry.getFeatures('district')
  if (!_distGrid.isBuilt && distFeatures.length > 0) {
    _distGrid.build(distFeatures, 'district')
  }

  const distCandidates = _distGrid.isBuilt ? _distGrid.getCandidates(lat, lng) : distFeatures
  for (const f of distCandidates) {
    const props = f.properties as any
    const [[minLat, minLng], [maxLat, maxLng]] = props._spatioBbox || [[-Infinity, -Infinity], [Infinity, Infinity]]
    if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) continue
    if (pointInPolygon(lat, lng, f.geometry)) {
      const p = cleanName(String(props.P_Name_T ?? props.PV_TN ?? props.changwat ?? props.PROVINCE_NAME ?? ''))
      const aRaw = cleanName(String(props.A_Name_T ?? props.AM_TN ?? props.amphur ?? props.AMPHOE_NAME ?? ''))
      const a = expandMueang(aRaw, p)
      const pCode = String(props.P_code ?? props.CHANGWAT_CODE ?? props.PV_CODE ?? '').replace(/\D/g, '').padStart(2, '0')
      const aCodeRaw = String(props.Admin_code ?? props.A_code_full ?? props.PA_Code ?? '').replace(/\D/g, '')
      const aCode = aCodeRaw.length === 4 ? aCodeRaw : pCode + aCodeRaw.slice(-2)
      return { pCode, aCode, tCode: '', pName: p, aName: a, tName: '' }
    }
  }

  // 3. หากไม่พบลองหาในระดับจังหวัด
  const provFeatures = registry.getFeatures('province')
  if (!_provGrid.isBuilt && provFeatures.length > 0) {
    _provGrid.build(provFeatures, 'province')
  }

  const provCandidates = _provGrid.isBuilt ? _provGrid.getCandidates(lat, lng) : provFeatures
  for (const f of provCandidates) {
    const props = f.properties as any
    const [[minLat, minLng], [maxLat, maxLng]] = props._spatioBbox || [[-Infinity, -Infinity], [Infinity, Infinity]]
    if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) continue
    if (pointInPolygon(lat, lng, f.geometry)) {
      const p = cleanName(String(props.P_Name_T ?? props.PV_TN ?? props.changwat ?? props.PROVINCE_NAME ?? ''))
      const pCode = String(props.P_code ?? props.CHANGWAT_CODE ?? props.PV_CODE ?? '').replace(/\D/g, '').padStart(2, '0')
      return { pCode, aCode: '', tCode: '', pName: p, aName: '', tName: '' }
    }
  }

  return null
}

/**
 * ค้นหา province polygon จาก province-level features เท่านั้น
 * ⚠️ ห้ามใช้ registry.findByName(pName) เพราะ nameIdx ถูก overwrite โดยตำบลชื่อซ้ำ 17 จังหวัด
 *    เช่น ตำบลเชียงใหม่ จะ overwrite จังหวัดเชียงใหม่ ใน index
 */
const _provFeatureCache = new Map<string, any>()

export function clearProvinceFeatureCache(): void {
  _provFeatureCache.clear()
}

// ── Centralized Scope Check Caching (O(1) lookups for timeline animations) ──
const _scopeCheckCache = new Map<string, boolean>()

export function clearScopeCheckCache(): void {
  _scopeCheckCache.clear()
}

// Register callbacks on registry onLoad to safely clear caches on data load
registry.onLoadCallbacks.push(() => {
  clearProvinceFeatureCache()
  clearScopeCheckCache()
})

function findProvinceFeature(pName: string): any | null {
  if (_provFeatureCache.has(pName)) return _provFeatureCache.get(pName)!

  const features = registry.getFeatures('province')
  for (const f of features) {
    const p = cleanName(String(f.properties.P_Name_T ?? f.properties.PV_TN ?? f.properties.changwat ?? f.properties.PROVINCE_NAME ?? ''))
    if (p === pName) {
      _provFeatureCache.set(pName, f)
      return f
    }
  }

  _provFeatureCache.set(pName, null)
  return null
}

/** ตรวจสอบว่าพิกัด Lat/Lng อยู่ภายใต้ Scope เขต/จังหวัด/อำเภอ/ตำบล ที่แอกทีฟหรือไม่ (ด้วยรูปปิด Polygon แม่นยำ 100%) */
export function isPointInScope(
  lat: number,
  lng: number,
  scope: { region: string; province: string; district: string; subdistrict?: string }
): boolean {
  const cacheKey = `${lat.toFixed(6)},${lng.toFixed(6)}|${scope.region}|${scope.province}|${scope.district}|${scope.subdistrict ?? 'all'}`
  if (_scopeCheckCache.has(cacheKey)) {
    return _scopeCheckCache.get(cacheKey)!
  }

  // Helper inside to save result to cache before returning
  const setAndReturn = (result: boolean) => {
    _scopeCheckCache.set(cacheKey, result)
    return result
  }

  // 0. กรองตามตำบล (Subdistrict) - เข้มงวดสูงสุด
  if (scope.province !== 'all' && scope.district !== 'all' && scope.subdistrict && scope.subdistrict !== 'all') {
    const pName = cleanName(scope.province)
    const dName = expandMueang(scope.district, pName)
    const tName = cleanName(scope.subdistrict)
    
    // ค้นหาด้วย compound key (ปลอดภัยจาก collision)
    const feature = registry.findByName(`${pName}|${dName}|${tName}`, 'subdistrict')
    if (feature) {
      return setAndReturn(pointInPolygon(lat, lng, feature.geometry))
    }

    // fallback ค้นหาจาก features ตำบลทั้งหมดโดยตรง
    const features = registry.getFeatures('subdistrict')
    const fallbackFeature = features.find(f => {
      const p = cleanName(String(f.properties.P_Name_T ?? f.properties.PV_TN ?? f.properties.changwat ?? f.properties.PROVINCE_NAME ?? ''))
      const aRaw = cleanName(String(f.properties.A_Name_T ?? f.properties.AM_TN ?? f.properties.amphur ?? f.properties.AMPHOE_NAME ?? ''))
      const a = expandMueang(aRaw, p)
      const t = cleanName(String(f.properties.T_Name_T ?? f.properties.TB_TN ?? f.properties.tambon ?? f.properties.TAMBON_NAME ?? ''))
      return p === pName && a === dName && t === tName
    })
    if (fallbackFeature) {
      return setAndReturn(pointInPolygon(lat, lng, fallbackFeature.geometry))
    }
    return setAndReturn(false)
  }

  // 1. กรองตามอำเภอ (District)
  if (scope.province !== 'all' && scope.district !== 'all') {
    const pName = cleanName(scope.province)
    const dName = expandMueang(scope.district, pName)
    
    // ค้นหาด้วย compound key
    const feature = registry.findByName(`${pName}|${dName}`, 'district')
    if (feature) {
      return setAndReturn(pointInPolygon(lat, lng, feature.geometry))
    }

    // fallback ค้นหาจาก features อำเภอทั้งหมดโดยตรง
    const features = registry.getFeatures('district')
    const fallbackFeature = features.find(f => {
      const p = cleanName(String(f.properties.P_Name_T ?? f.properties.PV_TN ?? f.properties.changwat ?? f.properties.PROVINCE_NAME ?? ''))
      const aRaw = cleanName(String(f.properties.A_Name_T ?? f.properties.AM_TN ?? f.properties.amphur ?? f.properties.AMPHOE_NAME ?? ''))
      const a = expandMueang(aRaw, p)
      return p === pName && a === dName
    })
    if (fallbackFeature) {
      return setAndReturn(pointInPolygon(lat, lng, fallbackFeature.geometry))
    }
    return setAndReturn(false)
  }

  // 2. กรองตามจังหวัด (Province) — ค้นหาจาก province features โดยตรงเท่านั้น!
  if (scope.province !== 'all') {
    const pName = cleanName(scope.province)
    const feature = findProvinceFeature(pName)
    if (feature) {
      return setAndReturn(pointInPolygon(lat, lng, feature.geometry))
    }
    return setAndReturn(false)
  }

  // 3. กรองตามเขตสุขภาพ (Health Zone) — ค้นหาจาก province features โดยตรง!
  if (scope.region !== 'all' && scope.province === 'all') {
    const provincesInZone = getProvincesInZone(Number(scope.region))
    const cleanProvs = provincesInZone.map(p => cleanName(p))
    
    // ค้นหาแต่ละจังหวัดจาก province-level features เท่านั้น
    const provFeatures = cleanProvs
      .map(pName => findProvinceFeature(pName))
      .filter(Boolean)

    if (provFeatures.length > 0) {
      for (const f of provFeatures) {
        if (pointInPolygon(lat, lng, f.geometry)) return setAndReturn(true)
      }
      return setAndReturn(false)
    }
  }

  return setAndReturn(true)
}


