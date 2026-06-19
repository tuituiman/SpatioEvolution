/**
 * spatialStatsCore.ts — Pure Math Core for Moran's I & LISA
 * SpatioEvolution Shared Statistics Engine
 *
 * ✅ Pure functions — ไม่มี side effects, ไม่ depend on browser APIs
 * ✅ ใช้ได้ทั้งใน Main Thread และ Web Worker
 * ✅ Single source of truth สำหรับ Moran's I + LISA algorithm
 */

// ──────────────────────────────────────────
// Haversine Distance
// ──────────────────────────────────────────
export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────
export interface MoransAreaInput {
  code: string
  name: string
  value: number
  centroid: [number, number] | null
}

export interface MoransOptions {
  weightType?: 'inverse_distance' | 'queen' | 'rook'
  distanceBandKm?: number
  rowStandardized?: boolean
  numPermutations?: number
  lisaThreshold?: number
}

export interface MoransDetail {
  areaCode: string
  areaName: string
  value: number
  localI: number
  spatialLag: number
  stdValue: number
  stdSpatialLag: number
  type: 'HH' | 'LL' | 'HL' | 'LH' | 'NS'
  pValue: number
}

export interface MoransResult {
  moranIndex: number
  expectedValue: number
  zScore: number
  pValue: number
  conclusion: 'Clustered' | 'Dispersed' | 'Random'
  details: MoransDetail[]
}

// ──────────────────────────────────────────
// Normal CDF approximation (Abramowitz & Stegun)
// ──────────────────────────────────────────
function normalPValue(z: number): number {
  const absZ = Math.abs(z)
  const t = 1 / (1 + 0.5 * absZ)
  const ans = 1 - t * Math.exp(
    -absZ * absZ - 1.26551223 +
    t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
      t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))
  )
  return Math.min(1.0, (z >= 0 ? 1 - ans : ans) * 2)
}

// ──────────────────────────────────────────
// Core Moran's I Computation
// ──────────────────────────────────────────
export function computeMoransI(
  areas: MoransAreaInput[],
  adjacency: Record<string, string[]> | null,
  options: MoransOptions = {}
): MoransResult | null {
  const validAreas = areas.filter(a => a.centroid !== null)
  const N = validAreas.length
  if (N < 4) return null

  const {
    weightType = 'inverse_distance',
    distanceBandKm = 100,
    rowStandardized = true,
    numPermutations = 999,
    lisaThreshold = 0.05,
  } = options

  // 1. Mean and Variance
  const mean = validAreas.reduce((s, a) => s + a.value, 0) / N
  const sumSqDiff = validAreas.reduce((s, a) => s + Math.pow(a.value - mean, 2), 0)
  const variance = sumSqDiff / N
  if (variance === 0) return null

  // 2. Build Sparse Weight Matrix
  const W: { j: number; w: number }[][] = Array.from({ length: N }, () => [])

  if (weightType === 'inverse_distance') {
    for (let i = 0; i < N; i++) {
      const c1 = validAreas[i].centroid!
      for (let j = 0; j < N; j++) {
        if (i === j) continue
        const c2 = validAreas[j].centroid!
        const dist = haversineDistanceKm(c1[0], c1[1], c2[0], c2[1])
        if (dist <= distanceBandKm && dist > 0) W[i].push({ j, w: 1 / dist })
      }
    }
  } else if (adjacency) {
    const codeToIdx = new Map<string, number>()
    validAreas.forEach((a, idx) => codeToIdx.set(a.code, idx))
    for (let i = 0; i < N; i++) {
      const neighbors = adjacency[validAreas[i].code]
      if (neighbors) {
        neighbors.forEach(nCode => {
          const j = codeToIdx.get(nCode)
          if (j !== undefined) W[i].push({ j, w: 1.0 })
        })
      }
    }
  }

  // 3. Row Standardization
  if (rowStandardized) {
    for (let i = 0; i < N; i++) {
      const rowSum = W[i].reduce((s, e) => s + e.w, 0)
      if (rowSum > 0) W[i].forEach(e => { e.w /= rowSum })
    }
  }

  // 4. S0
  let S0 = 0
  for (let i = 0; i < N; i++) W[i].forEach(e => { S0 += e.w })
  if (S0 === 0) return null

  // 5. Global Moran's I
  let numerator = 0
  for (let i = 0; i < N; i++) {
    const z_i = validAreas[i].value - mean
    W[i].forEach(({ j, w }) => { numerator += w * z_i * (validAreas[j].value - mean) })
  }
  const moranIndex = (N / S0) * (numerator / sumSqDiff)
  const expectedValue = -1 / (N - 1)

  // 6. Variance under Normality → Z-score → Analytical p-value
  const wMap = new Map<number, Map<number, number>>()
  for (let i = 0; i < N; i++) {
    wMap.set(i, new Map<number, number>())
    W[i].forEach(({ j, w }) => wMap.get(i)!.set(j, w))
  }
  let S1 = 0; let S2 = 0
  const rowSums = new Array<number>(N).fill(0)
  const colSums = new Array<number>(N).fill(0)
  for (let i = 0; i < N; i++) {
    W[i].forEach(({ j, w }) => {
      rowSums[i] += w; colSums[j] += w
      const w_ji = wMap.get(j)?.get(i) || 0
      S1 += 0.5 * Math.pow(w + w_ji, 2)
    })
  }
  for (let i = 0; i < N; i++) S2 += Math.pow(rowSums[i] + colSums[i], 2)

  const N2 = N * N; const s02 = S0 * S0
  const varNormal = (N * ((N2 - 3 * N + 3) * S1 - N * S2 + 3 * s02)) /
    ((N - 1) * (N - 2) * (N - 3) * s02) - expectedValue * expectedValue
  const stdError = Math.sqrt(Math.abs(varNormal > 0 ? varNormal : 0.01))
  const zScore = (moranIndex - expectedValue) / (stdError || 1)
  const analyticalP = normalPValue(zScore)

  // 7. Global Permutation Test
  let finalGlobalP = analyticalP
  if (numPermutations > 0) {
    let globalExtreme = 0
    const z = validAreas.map(a => a.value - mean)
    const shuffledZ = [...z]
    for (let p = 0; p < numPermutations; p++) {
      for (let i = shuffledZ.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffledZ[i], shuffledZ[j]] = [shuffledZ[j], shuffledZ[i]]
      }
      let permNum = 0
      for (let i = 0; i < N; i++) {
        const zi = shuffledZ[i]
        let lag = 0
        W[i].forEach(({ j, w }) => { lag += w * shuffledZ[j] })
        permNum += zi * lag
      }
      const permI = (N / S0) * (permNum / sumSqDiff)
      if (Math.abs(permI - expectedValue) >= Math.abs(moranIndex - expectedValue)) globalExtreme++
    }
    finalGlobalP = (globalExtreme + 1) / (numPermutations + 1)
  }

  const conclusion: MoransResult['conclusion'] =
    finalGlobalP < 0.05 ? (zScore > 0 ? 'Clustered' : 'Dispersed') : 'Random'

  // 8. LISA Local Statistics
  const stdDev = Math.sqrt(variance)
  const details: MoransDetail[] = validAreas.map((area, i) => {
    const z_i = area.value - mean
    let localNum = 0; let lagVal = 0; let weightSum = 0
    W[i].forEach(({ j, w }) => {
      localNum += w * (validAreas[j].value - mean)
      lagVal += w * validAreas[j].value
      weightSum += w
    })
    const localI = variance > 0 ? (z_i / variance) * localNum : 0
    const spatialLag = weightSum > 0 ? lagVal / weightSum : mean
    return {
      areaCode: area.code, areaName: area.name, value: area.value,
      localI, spatialLag,
      stdValue: stdDev > 0 ? z_i / stdDev : 0,
      stdSpatialLag: stdDev > 0 ? (spatialLag - mean) / stdDev : 0,
      type: 'NS' as const, pValue: 0.2
    }
  })

  // 9. LISA p-values
  if (numPermutations > 0 && variance > 0) {
    const z = validAreas.map(a => a.value - mean)
    for (let i = 0; i < N; i++) {
      const row = W[i]
      if (row.length === 0) { details[i].pValue = 1.0; details[i].type = 'NS'; continue }
      const observedSum = row.reduce((s, { j, w }) => s + w * z[j], 0)
      const pool = z.filter((_, idx) => idx !== i)
      let extreme = 0
      for (let p = 0; p < numPermutations; p++) {
        let permSum = 0
        for (let m = 0; m < row.length; m++) {
          const r = m + Math.floor(Math.random() * (pool.length - m))
          ;[pool[m], pool[r]] = [pool[r], pool[m]]
          permSum += row[m].w * pool[m]
        }
        if (Math.abs(permSum) >= Math.abs(observedSum)) extreme++
      }
      const pVal = (extreme + 1) / (numPermutations + 1)
      details[i].pValue = pVal
      if (pVal < lisaThreshold) {
        const areaVal = validAreas[i].value
        const lag = details[i].spatialLag
        details[i].type = areaVal > mean && lag > mean ? 'HH'
          : areaVal < mean && lag < mean ? 'LL'
          : areaVal > mean && lag < mean ? 'HL' : 'LH'
      }
    }
  } else {
    // Analytical LISA fallback
    for (let i = 0; i < N; i++) {
      const row = W[i]
      if (row.length === 0) { details[i].pValue = 1.0; details[i].type = 'NS'; continue }
      const w_i = row.reduce((s, e) => s + e.w, 0)
      const localZ = (details[i].localI - (-w_i / (N - 1))) / Math.sqrt(Math.abs(w_i * 0.5 || 0.01))
      const pVal = normalPValue(localZ)
      details[i].pValue = pVal
      if (pVal < lisaThreshold) {
        const areaVal = validAreas[i].value
        const lag = details[i].spatialLag
        details[i].type = areaVal > mean && lag > mean ? 'HH'
          : areaVal < mean && lag < mean ? 'LL'
          : areaVal > mean && lag < mean ? 'HL' : 'LH'
      }
    }
  }

  return { moranIndex, expectedValue, zScore, pValue: finalGlobalP, conclusion, details }
}
