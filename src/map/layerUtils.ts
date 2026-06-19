import L from 'leaflet'
import { getLocKeys as getLocKeysRaw, isAreaInScope, makeTooltip as makeTooltipRaw } from '../data/aggregator'
import { cleanName, PROVINCE_CODE_MAP } from '../data/thaiNormalizer'
import { getProvincesInZone } from '../data/healthZones'
import type { AppState } from '../store/useAppStore'
import { locationResolver } from '../data/locationResolver'

/** แกะรหัสและชื่อสถานที่จาก GeoJSON Properties */
export const getLocKeys = getLocKeysRaw

/** สร้างเนื้อหา Tooltip มาตรฐาน */
export function makeTooltip(p: string, a: string, t: string, val: number, level: AppState['adminLevel']): string {
  return makeTooltipRaw(p, a, t, val, level)
}

/** หาจุดกึ่งกลางของพื้นที่ (พร้อมระบบ Cache) */
export function getCentroid(feature: any): [number, number] | null {
  if (!feature) return null
  const props = feature.properties || {}
  if (props._spatioCentroid) {
    const cached = props._spatioCentroid
    if (Array.isArray(cached) && cached.length === 2 && !isNaN(cached[0]) && !isNaN(cached[1])) {
      return cached as [number, number]
    }
  }

  try {
    const layer = L.geoJSON(feature)
    const bounds = layer.getBounds()
    if (!bounds.isValid()) return null
    const center = bounds.getCenter()
    if (isNaN(center.lat) || isNaN(center.lng)) return null
    const result = [center.lat, center.lng] as [number, number]
    props._spatioCentroid = result
    return result
  } catch { return null }
}

/** แปลงค่า Scope จาก Store ให้เป็น "บาร์โค้ด" (Codes) ที่ใช้งานได้จริง */
export function getScopeFilters(scope: AppState['scope']) {
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
        const resDist = locationResolver.resolve(scope.province, scope.district, '')
        if (resDist) {
          scopeACode = resDist.aCode
          if (scope.subdistrict && scope.subdistrict !== 'all') {
            const resSub = locationResolver.resolve(scope.province, scope.district, scope.subdistrict)
            if (resSub) {
              scopeTCode = resSub.tCode
            }
          }
        }
      }
    }
  } else if (scope.region !== 'all') {
    const provinceNames = getProvincesInZone(Number(scope.region))
    const codes = provinceNames.map(n => {
      const cleaned = cleanName(n)
      return nameToCode.get(cleaned) || locationResolver.resolve(n, '', '')?.pCode
    }).filter(Boolean) as string[]
    scopePCodes = new Set(codes)
  }

  return { scopePCodes, scopeACode, scopeTCode }
}

/** ตรวจสอบว่า Location นี้อยู่ใน Scope หรือไม่ */
export function isInScope(pCode: string, aCode: string, filters: ReturnType<typeof getScopeFilters>, tCode?: string) {
  const { scopePCodes, scopeACode, scopeTCode } = filters
  const inProv = !scopePCodes || scopePCodes.has(pCode)
  // หากไม่มี aCode (เช่น ขอบเขตระดับจังหวัด) หรือไม่มีตัวกรองระดับอำเภอ ให้ถือว่าอยู่ใน Scope เสมอ
  const inDist = !scopeACode || !aCode || aCode === scopeACode
  // กรองระดับตำบล
  const inSub = !scopeTCode || !tCode || tCode === scopeTCode
  return inProv && inDist && inSub
}
