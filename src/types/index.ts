import type { PeriodBucket } from '../data/dateParser'

export type { PeriodBucket }

export interface DataKeys {
  date: string
  province: string
  district: string
  subdistrict: string
  lat: string
  lng: string
  value: string
  color: string
}

export interface Scope {
  region: string      // 'all' | '1'-'13'
  province: string    // 'all' | ชื่อจังหวัด
  district: string    // 'all' | ชื่ออำเภอ
  subdistrict: string  // 'all' | ชื่อตำบล
}

// Dictionary structure
export interface SubdistrictCounts { 
  [subKey: string]: number 
}

export interface DistrictData { 
  _total: number
  _color?: string
  color?: string
  subdistricts: SubdistrictCounts 
}

export interface ProvinceData { 
  _total: number
  _color?: string
  color?: string
  districts: Record<string, DistrictData> 
}

export type DateDictionary = Record<string, Record<string, ProvinceData>>

export interface DatasetMeta {
  id: string
  fileName: string
  rowCount: number
  keys: DataKeys
  loadedAt: Date
  fileBytes?: Uint8Array
  sheetNames?: string[]
  selectedSheet?: string
}

export interface GlobalStats {
  max: number
  min: number
  mean: number
  median: number
  p25: number
  p75: number
  count: number
  sum: number
  peak: {
    value: number
    location: string
    date: string
  }
}

export interface StatsRecord {
  min: number
  max: number
  mean: number
  median: number
  p25: number
  p75: number
  maxAreas: string[]
  totalCount: number
}
