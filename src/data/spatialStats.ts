/**
 * spatialStats.ts — Deep Spatial Analysis and Spatial Statistics Engine
 * Contains high-performance implementations of:
 * 1. Haversine distance & DBSCAN clustering (Point Pattern Analysis)
 * 2. GeoJSON Polygon Centroid extraction & Global Moran's I (Spatial Autocorrelation)
 * 3. LISA (Local Indicators of Spatial Association) for hotspot classification
 * 4. Inverse Distance Weighting (IDW) Interpolation
 * 5. Pearson & Spearman Rank Correlation Coefficient
 */


import { registry } from './registry'
import type { AdminLevel } from '../store/useAppStore'

// Fallback Haversine if import is missing or different
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ──────────────────────────────────────────
// 1. DBSCAN Clustering Engine
// ──────────────────────────────────────────
export interface DBSCANPoint {
  lat: number
  lng: number
  originalIndex: number
}

export interface DBSCANResult {
  labels: number[] // -1 for noise, >=0 for cluster index
  numClusters: number
  noiseCount: number
  clusterSizes: number[]
}

export function runDBSCAN(points: { lat: number; lng: number }[], epsKm: number, minPts: number): DBSCANResult {
  const n = points.length
  const labels = new Array<number>(n).fill(-2) // -2 means unvisited
  let clusterId = 0

  function getNeighbors(index: number): number[] {
    const neighbors: number[] = []
    const p1 = points[index]
    for (let i = 0; i < n; i++) {
      if (i === index) continue
      const p2 = points[i]
      const dist = calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng)
      if (dist <= epsKm) {
        neighbors.push(i)
      }
    }
    return neighbors
  }

  for (let i = 0; i < n; i++) {
    if (labels[i] !== -2) continue

    const neighbors = getNeighbors(i)
    if (neighbors.length < minPts - 1) {
      labels[i] = -1 // Noise
      continue
    }

    labels[i] = clusterId // Core point starts a cluster
    const queue = [...neighbors]

    for (let j = 0; j < queue.length; j++) {
      const neighborIdx = queue[j]

      if (labels[neighborIdx] === -1) {
        labels[neighborIdx] = clusterId // Noise boundary point promoted to border
      }

      if (labels[neighborIdx] !== -2) continue

      labels[neighborIdx] = clusterId
      const nextNeighbors = getNeighbors(neighborIdx)
      if (nextNeighbors.length >= minPts - 1) {
        queue.push(...nextNeighbors.filter(idx => !queue.includes(idx)))
      }
    }

    clusterId++
  }

  const cleanLabels = labels.map(l => (l === -2 ? -1 : l))
  const numClusters = clusterId
  const noiseCount = cleanLabels.filter(l => l === -1).length

  const clusterSizes = new Array<number>(numClusters).fill(0)
  cleanLabels.forEach(l => {
    if (l >= 0) clusterSizes[l]++
  })

  return {
    labels: cleanLabels,
    numClusters,
    noiseCount,
    clusterSizes
  }
}

// ──────────────────────────────────────────
// 2. Centroid Extraction
// ──────────────────────────────────────────
export function extractCentroid(geometry: any): [number, number] | null {
  if (!geometry) return null
  let sumLat = 0
  let sumLng = 0
  let count = 0

  function recurseCoordinates(coords: any[]) {
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      sumLng += coords[0]
      sumLat += coords[1]
      count++
    } else if (Array.isArray(coords)) {
      coords.forEach(c => recurseCoordinates(c))
    }
  }

  if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
    recurseCoordinates(geometry.coordinates)
  } else if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
    return [geometry.coordinates[1], geometry.coordinates[0]]
  }

  if (count > 0) return [sumLat / count, sumLng / count]
  return null
}

// ──────────────────────────────────────────
// 3. Moran's I & LISA Spatial Autocorrelation
// ──────────────────────────────────────────
export interface MoransResult {
  moranIndex: number
  expectedValue: number
  zScore: number
  pValue: number
  conclusion: 'Clustered' | 'Dispersed' | 'Random'
  details: {
    areaCode: string
    areaName: string
    value: number
    localI: number
    spatialLag: number
    stdValue: number
    stdSpatialLag: number
    type: 'HH' | 'LL' | 'HL' | 'LH' | 'NS' // LISA classification
    pValue: number
  }[]
}

// ──────────────────────────────────────────
// Topology Extraction & Adjacency Map for Contiguity Weights
// ──────────────────────────────────────────
function extractTopology(geometry: any) {
  const vertices = new Set<string>()
  const edges = new Set<string>()

  function processRing(ring: any[]) {
    if (!ring || ring.length < 2) return
    const vKeys: string[] = []
    for (let i = 0; i < ring.length; i++) {
      const coord = ring[i]
      if (Array.isArray(coord) && typeof coord[0] === 'number' && typeof coord[1] === 'number') {
        // ใช้ integer quantize แทน toFixed(5) เพื่อความเร็ว ~3x
        const vKey = `${Math.round(coord[0] * 100000)},${Math.round(coord[1] * 100000)}`
        vertices.add(vKey)
        vKeys.push(vKey)
      }
    }
    for (let i = 0; i < vKeys.length - 1; i++) {
      const v1 = vKeys[i]
      const v2 = vKeys[i + 1]
      if (v1 === v2) continue
      const edgeKey = v1 < v2 ? `${v1}|${v2}` : `${v2}|${v1}`
      edges.add(edgeKey)
    }
  }

  if (!geometry) return { vertices, edges }

  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
    geometry.coordinates.forEach((ring: any) => {
      if (Array.isArray(ring)) processRing(ring)
    })
  } else if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
    geometry.coordinates.forEach((poly: any) => {
      if (Array.isArray(poly)) {
        poly.forEach((ring: any) => {
          if (Array.isArray(ring)) processRing(ring)
        })
      }
    })
  }

  return { vertices, edges }
}

const contiguityCache = new Map<string, Map<string, Set<string>>>()

export function clearContiguityCache(): void {
  contiguityCache.clear()
}

// Clear adjacency cache when new geographic registry is loaded
registry.onLoadCallbacks.push(clearContiguityCache)


export function getContiguityNeighbors(
  areas: { code: string }[],
  adminLevel: AdminLevel,
  type: 'queen' | 'rook'
): Map<string, Set<string>> {
  const cacheKey = `${adminLevel}_${type}`
  if (contiguityCache.has(cacheKey)) {
    return contiguityCache.get(cacheKey)!
  }

  const adjacency = new Map<string, Set<string>>()
  areas.forEach(a => adjacency.set(a.code, new Set<string>()))

  const indexMap = new Map<string, Set<string>>() // item -> Set of area codes

  areas.forEach(area => {
    const feature = registry.findByCode(area.code)
    if (!feature || !feature.geometry) return

    const { vertices, edges } = extractTopology(feature.geometry)
    const items = type === 'queen' ? vertices : edges

    items.forEach(item => {
      if (!indexMap.has(item)) {
        indexMap.set(item, new Set<string>())
      }
      indexMap.get(item)!.add(area.code)
    })
  })

  indexMap.forEach(codes => {
    if (codes.size < 2) return
    const codesArr = Array.from(codes)
    for (let i = 0; i < codesArr.length; i++) {
      const codeA = codesArr[i]
      for (let j = i + 1; j < codesArr.length; j++) {
        const codeB = codesArr[j]
        adjacency.get(codeA)!.add(codeB)
        adjacency.get(codeB)!.add(codeA)
      }
    }
  })

  contiguityCache.set(cacheKey, adjacency)
  return adjacency
}

export interface MoransOptions {
  weightType?: 'inverse_distance' | 'queen' | 'rook'
  distanceBandKm?: number
  rowStandardized?: boolean
  numPermutations?: number // 0 for analytical normal, or positive count (e.g. 999)
  lisaThreshold?: number // e.g. 0.05, 0.01, 0.001
}

export function calculateMoransI(
  areas: { code: string; name: string; value: number; centroid: [number, number] | null }[],
  optionsOrDistanceBand: number | MoransOptions = 100,
  adminLevel: AdminLevel = 'district'
): MoransResult | null {
  const n = areas.length
  if (n < 4) return null

  // Filter areas with centroids
  const validAreas = areas.filter(a => a.centroid !== null)
  const N = validAreas.length
  if (N < 4) return null

  // Destructure options
  let weightType: 'inverse_distance' | 'queen' | 'rook' = 'inverse_distance'
  let distanceBandKm = 100
  let rowStandardized = true
  let numPermutations = 999
  let lisaThreshold = 0.05

  if (typeof optionsOrDistanceBand === 'number') {
    distanceBandKm = optionsOrDistanceBand
  } else if (optionsOrDistanceBand && typeof optionsOrDistanceBand === 'object') {
    weightType = optionsOrDistanceBand.weightType ?? 'inverse_distance'
    distanceBandKm = optionsOrDistanceBand.distanceBandKm ?? 100
    rowStandardized = optionsOrDistanceBand.rowStandardized ?? true
    numPermutations = optionsOrDistanceBand.numPermutations ?? 999
    lisaThreshold = optionsOrDistanceBand.lisaThreshold ?? 0.05
  }

  // 1. Mean and Variance
  const mean = validAreas.reduce((acc, curr) => acc + curr.value, 0) / N
  const sumSqDiff = validAreas.reduce((acc, curr) => acc + Math.pow(curr.value - mean, 2), 0)
  const variance = sumSqDiff / N

  if (variance === 0) return null

  // 2. Weights Matrix (Sparse representation)
  const W_sparse = Array.from({ length: N }, () => [] as { j: number; w: number }[])

  if (weightType === 'inverse_distance') {
    for (let i = 0; i < N; i++) {
      const c1 = validAreas[i].centroid!
      for (let j = 0; j < N; j++) {
        if (i === j) continue
        const c2 = validAreas[j].centroid!
        const dist = calculateDistance(c1[0], c1[1], c2[0], c2[1])

        if (dist <= distanceBandKm && dist > 0) {
          W_sparse[i].push({ j, w: 1 / dist })
        }
      }
    }
  } else {
    // Contiguity weights (Queen or Rook)
    const neighborCodesMap = getContiguityNeighbors(validAreas, adminLevel, weightType)
    const codeToIdx = new Map<string, number>()
    validAreas.forEach((a, idx) => codeToIdx.set(a.code, idx))

    for (let i = 0; i < N; i++) {
      const code = validAreas[i].code
      const neighbors = neighborCodesMap.get(code)
      if (neighbors) {
        neighbors.forEach(nCode => {
          const j = codeToIdx.get(nCode)
          if (j !== undefined) {
            W_sparse[i].push({ j, w: 1.0 })
          }
        })
      }
    }
  }

  // 3. Row Standardization
  if (rowStandardized) {
    for (let i = 0; i < N; i++) {
      const row = W_sparse[i]
      const rowSum = row.reduce((acc, curr) => acc + curr.w, 0)
      if (rowSum > 0) {
        for (let m = 0; m < row.length; m++) {
          row[m].w /= rowSum
        }
      }
    }
  }

  // Calculate sum of weights S0
  let S0 = 0
  for (let i = 0; i < N; i++) {
    const row = W_sparse[i]
    for (let m = 0; m < row.length; m++) {
      S0 += row[m].w
    }
  }

  if (S0 === 0) return null

  // 4. Global Moran's I Index
  let numerator = 0
  for (let i = 0; i < N; i++) {
    const z_i = validAreas[i].value - mean
    const row = W_sparse[i]
    for (let m = 0; m < row.length; m++) {
      const j = row[m].j
      const w = row[m].w
      const z_j = validAreas[j].value - mean
      numerator += w * z_i * z_j
    }
  }

  const moranIndex = (N / S0) * (numerator / sumSqDiff)
  const expectedValue = -1 / (N - 1)

  // 5. Analytical standard error and z-score under Normality
  const wMap = new Map<number, Map<number, number>>()
  for (let i = 0; i < N; i++) {
    wMap.set(i, new Map<number, number>())
    const row = W_sparse[i]
    for (let m = 0; m < row.length; m++) {
      wMap.get(i)!.set(row[m].j, row[m].w)
    }
  }

  let S1 = 0
  let S2 = 0
  const rowSums = new Array<number>(N).fill(0)
  const colSums = new Array<number>(N).fill(0)

  for (let i = 0; i < N; i++) {
    const row = W_sparse[i]
    for (let m = 0; m < row.length; m++) {
      const j = row[m].j
      const w_ij = row[m].w
      rowSums[i] += w_ij
      colSums[j] += w_ij

      const w_ji = wMap.get(j)?.get(i) || 0
      S1 += 0.5 * Math.pow(w_ij + w_ji, 2)
    }
  }

  for (let i = 0; i < N; i++) {
    S2 += Math.pow(rowSums[i] + colSums[i], 2)
  }

  const E_I = expectedValue
  const N2 = N * N
  const N_1 = N - 1
  const N_2 = N - 2
  const N_3 = N - 3

  const s02 = S0 * S0
  const varNormal = (N * ((N2 - 3 * N + 3) * S1 - N * S2 + 3 * s02)) / (N_1 * N_2 * N_3 * s02) - (E_I * E_I)
  const stdError = Math.sqrt(Math.abs(varNormal > 0 ? varNormal : 0.01))
  const zScore = (moranIndex - expectedValue) / (stdError || 1)

  // Normal distribution p-value approximation
  const absZ = Math.abs(zScore)
  const t_val = 1 / (1 + 0.5 * absZ)
  const ans = 1 - t_val * Math.exp(-absZ * absZ - 1.26551223 + t_val * (1.00002368 + t_val * (0.37409196 + t_val * (0.09678418 + t_val * (-0.18628806 + t_val * (0.27886807 + t_val * (-1.13520398 + t_val * (1.48851587 + t_val * (-0.82215223 + t_val * 0.17087277)))))))))
  let analyticalP = zScore >= 0 ? 1 - ans : ans
  analyticalP = Math.min(1.0, analyticalP * 2)

  // 6. Global Moran's I Permutation Test
  let finalGlobalP = analyticalP
  if (numPermutations > 0) {
    let globalExtreme = 0
    const z = validAreas.map(a => a.value - mean)
    const shuffledZ = [...z]

    for (let p = 0; p < numPermutations; p++) {
      for (let i = shuffledZ.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const temp = shuffledZ[i]
        shuffledZ[i] = shuffledZ[j]
        shuffledZ[j] = temp
      }

      let permNumerator = 0
      for (let i = 0; i < N; i++) {
        const zi = shuffledZ[i]
        let lag = 0
        const row = W_sparse[i]
        for (let m = 0; m < row.length; m++) {
          lag += row[m].w * shuffledZ[row[m].j]
        }
        permNumerator += zi * lag
      }

      const permI = (N / S0) * (permNumerator / sumSqDiff)
      if (Math.abs(permI - expectedValue) >= Math.abs(moranIndex - expectedValue)) {
        globalExtreme++
      }
    }
    finalGlobalP = (globalExtreme + 1) / (numPermutations + 1)
  }

  let conclusion: 'Clustered' | 'Dispersed' | 'Random' = 'Random'
  if (finalGlobalP < 0.05) {
    conclusion = zScore > 0 ? 'Clustered' : 'Dispersed'
  }

  // 7. LISA Local Indicators of Spatial Association
  const stdDev = Math.sqrt(variance)
  const details = validAreas.map((area, i) => {
    const z_i = area.value - mean

    let localNumerator = 0
    let weightSum = 0
    let lagVal = 0
    const row = W_sparse[i]
    for (let m = 0; m < row.length; m++) {
      const j = row[m].j
      const w = row[m].w
      const z_j = validAreas[j].value - mean
      localNumerator += w * z_j
      lagVal += w * validAreas[j].value
      weightSum += w
    }

    const localI = variance > 0 ? (z_i / variance) * localNumerator : 0
    const spatialLag = weightSum > 0 ? lagVal / weightSum : mean

    // Standardized scores for Moran Scatter Plot
    const stdValue = stdDev > 0 ? z_i / stdDev : 0
    const stdSpatialLag = stdDev > 0 ? (spatialLag - mean) / stdDev : 0

    return {
      areaCode: area.code,
      areaName: area.name,
      value: area.value,
      localI,
      spatialLag,
      stdValue,
      stdSpatialLag,
      type: 'NS' as 'HH' | 'LL' | 'HL' | 'LH' | 'NS',
      pValue: 0.2
    }
  })

  // LISA local p-value calculations (Permutations or analytical)
  if (numPermutations > 0 && variance > 0) {
    const z = validAreas.map(a => a.value - mean)

    for (let i = 0; i < N; i++) {
      const row = W_sparse[i]
      if (row.length === 0) {
        details[i].pValue = 1.0
        details[i].type = 'NS'
        continue
      }

      let observedSum = 0
      for (let m = 0; m < row.length; m++) {
        observedSum += row[m].w * z[row[m].j]
      }

      const pool = z.filter((_, idx) => idx !== i)
      const k = row.length
      let extremeCount = 0

      // In-place FY swap in pool to calculate permutations extremely fast
      for (let p = 0; p < numPermutations; p++) {
        let permSum = 0
        for (let m = 0; m < k; m++) {
          const r = m + Math.floor(Math.random() * (pool.length - m))
          const temp = pool[m]
          pool[m] = pool[r]
          pool[r] = temp

          permSum += row[m].w * pool[m]
        }

        if (Math.abs(permSum) >= Math.abs(observedSum)) {
          extremeCount++
        }
      }

      const pValLocal = (extremeCount + 1) / (numPermutations + 1)
      details[i].pValue = pValLocal

      if (pValLocal < lisaThreshold) {
        const areaVal = validAreas[i].value
        const spatialLag = details[i].spatialLag
        if (areaVal > mean && spatialLag > mean) details[i].type = 'HH'
        else if (areaVal < mean && spatialLag < mean) details[i].type = 'LL'
        else if (areaVal > mean && spatialLag < mean) details[i].type = 'HL'
        else if (areaVal < mean && spatialLag > mean) details[i].type = 'LH'
      } else {
        details[i].type = 'NS'
      }
    }
  } else {
    // LISA normal analytical approximation fallback
    for (let i = 0; i < N; i++) {
      const row = W_sparse[i]
      if (row.length === 0) {
        details[i].pValue = 1.0
        details[i].type = 'NS'
        continue
      }

      const localI = details[i].localI
      const w_i = row.reduce((acc, curr) => acc + curr.w, 0)
      const expectedLocalI = -w_i / (N - 1)
      const varLocalI = w_i * 0.5

      const localZ = (localI - expectedLocalI) / Math.sqrt(Math.abs(varLocalI || 0.01))
      const absLocalZ = Math.abs(localZ)
      const t_val = 1 / (1 + 0.5 * absLocalZ)
      const ans = 1 - t_val * Math.exp(-absLocalZ * absLocalZ - 1.26551223 + t_val * (1.00002368 + t_val * (0.37409196 + t_val * (0.09678418 + t_val * (-0.18628806 + t_val * (0.27886807 + t_val * (-1.13520398 + t_val * (1.48851587 + t_val * (-0.82215223 + t_val * 0.17087277)))))))))
      const pValLocal = Math.min(1.0, (localZ >= 0 ? 1 - ans : ans) * 2)

      details[i].pValue = pValLocal

      if (pValLocal < lisaThreshold) {
        const areaVal = validAreas[i].value
        const spatialLag = details[i].spatialLag
        if (areaVal > mean && spatialLag > mean) details[i].type = 'HH'
        else if (areaVal < mean && spatialLag < mean) details[i].type = 'LL'
        else if (areaVal > mean && spatialLag < mean) details[i].type = 'HL'
        else if (areaVal < mean && spatialLag > mean) details[i].type = 'LH'
      } else {
        details[i].type = 'NS'
      }
    }
  }

  return {
    moranIndex,
    expectedValue,
    zScore,
    pValue: finalGlobalP,
    conclusion,
    details
  }
}


// ──────────────────────────────────────────
// 4. Spatial Interpolation (IDW) Engine
// ──────────────────────────────────────────
export function calculateIDW(
  knownPoints: { lat: number; lng: number; val: number }[],
  targetLat: number,
  targetLng: number,
  power = 2,
  searchRadiusKm = 150
): number {
  let numerator = 0
  let denominator = 0

  for (const pt of knownPoints) {
    const dist = calculateDistance(pt.lat, pt.lng, targetLat, targetLng)

    if (dist === 0) return pt.val // Exact match
    if (dist > searchRadiusKm) continue

    const weight = 1 / Math.pow(dist, power)
    numerator += weight * pt.val
    denominator += weight
  }

  if (denominator === 0) return 0
  return numerator / denominator
}

// ──────────────────────────────────────────
// 5. Statistical Correlation Engine
// ──────────────────────────────────────────
export interface CorrelationResult {
  pearsonR: number
  spearmanRho: number
  sampleSize: number
  pValPearson: number
  strength: 'Strong Positive' | 'Moderate Positive' | 'Weak / None' | 'Moderate Negative' | 'Strong Negative'
}

export function calculateCorrelation(x: number[], y: number[]): CorrelationResult | null {
  const n = Math.min(x.length, y.length)
  if (n < 3) return null

  // ── Pearson R ──
  const meanX = x.reduce((a, b) => a + b, 0) / n
  const meanY = y.reduce((a, b) => a + b, 0) / n

  let numP = 0
  let denX = 0
  let denY = 0

  for (let i = 0; i < n; i++) {
    const diffX = x[i] - meanX
    const diffY = y[i] - meanY
    numP += diffX * diffY
    denX += diffX * diffX
    denY += diffY * diffY
  }

  const pearsonR = denX > 0 && denY > 0 ? numP / Math.sqrt(denX * denY) : 0

  // ── Spearman Rank Correlation ──
  // Helper to assign fractional ranks
  function getRanks(arr: number[]): number[] {
    const indexed = arr.map((val, idx) => ({ val, idx }))
    indexed.sort((a, b) => a.val - b.val)
    
    const ranks = new Array<number>(n)
    let i = 0
    while (i < n) {
      let j = i + 1
      while (j < n && indexed[j].val === indexed[i].val) {
        j++
      }
      // fractional rank
      const avgRank = (i + 1 + j) / 2
      for (let k = i; k < j; k++) {
        ranks[indexed[k].idx] = avgRank
      }
      i = j
    }
    return ranks
  }

  const rankX = getRanks(x)
  const rankY = getRanks(y)

  let sumD2 = 0
  for (let i = 0; i < n; i++) {
    const diff = rankX[i] - rankY[i]
    sumD2 += diff * diff
  }

  const spearmanRho = 1 - (6 * sumD2) / (n * (n * n - 1))

  // Pearson P-Value (using t-distribution approximation)
  const t = Math.abs(pearsonR) * Math.sqrt((n - 2) / (1 - pearsonR * pearsonR || 0.0001))
  // Simplified p-value approximation
  const pVal = t > 2.58 ? 0.01 : (t > 1.96 ? 0.05 : 0.3)

  let strength: CorrelationResult['strength'] = 'Weak / None'
  if (pearsonR >= 0.7) strength = 'Strong Positive'
  else if (pearsonR >= 0.3) strength = 'Moderate Positive'
  else if (pearsonR <= -0.7) strength = 'Strong Negative'
  else if (pearsonR <= -0.3) strength = 'Moderate Negative'

  return {
    pearsonR,
    spearmanRho,
    sampleSize: n,
    pValPearson: pVal,
    strength
  }
}
