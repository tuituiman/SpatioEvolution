/**
 * dbscanWorker.ts — Web Worker: DBSCAN Spatial Clustering
 * ย้ายการคำนวณ O(n²) ออกจาก main thread ป้องกัน UI freeze
 *
 * Messages IN:
 *   { type: 'RUN', points: { lat: number; lng: number }[], epsKm: number, minPts: number }
 *
 * Messages OUT:
 *   { type: 'PROGRESS', percent: number }
 *   { type: 'DONE', labels: number[], numClusters: number, noiseCount: number, clusterSizes: number[] }
 *   { type: 'ERROR', message: string }
 */

// ──────────────────────────────────────────
// Haversine Distance (self-contained)
// ──────────────────────────────────────────
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ──────────────────────────────────────────
// DBSCAN Algorithm (self-contained)
// ──────────────────────────────────────────
function runDBSCAN(
  points: { lat: number; lng: number }[],
  epsKm: number,
  minPts: number
) {
  const n = points.length
  const labels = new Array<number>(n).fill(-2) // -2 = unvisited
  let clusterId = 0

  function getNeighbors(index: number): number[] {
    const neighbors: number[] = []
    const p1 = points[index]
    for (let i = 0; i < n; i++) {
      if (i === index) continue
      if (calculateDistance(p1.lat, p1.lng, points[i].lat, points[i].lng) <= epsKm) {
        neighbors.push(i)
      }
    }
    return neighbors
  }

  for (let i = 0; i < n; i++) {
    // Report progress every 50 points
    if (i % 50 === 0) {
      self.postMessage({ type: 'PROGRESS', percent: Math.round((i / n) * 100) })
    }

    if (labels[i] !== -2) continue

    const neighbors = getNeighbors(i)
    if (neighbors.length < minPts - 1) {
      labels[i] = -1 // Noise
      continue
    }

    labels[i] = clusterId
    const queue = [...neighbors]

    for (let j = 0; j < queue.length; j++) {
      const neighborIdx = queue[j]
      if (labels[neighborIdx] === -1) labels[neighborIdx] = clusterId
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
  cleanLabels.forEach(l => { if (l >= 0) clusterSizes[l]++ })

  return { labels: cleanLabels, numClusters, noiseCount, clusterSizes }
}

// ──────────────────────────────────────────
// Message Handler
// ──────────────────────────────────────────
self.onmessage = (e: MessageEvent) => {
  const { type, points, epsKm, minPts } = e.data

  if (type === 'RUN') {
    try {
      self.postMessage({ type: 'PROGRESS', percent: 0 })

      const result = runDBSCAN(points, epsKm, minPts)

      self.postMessage({ type: 'PROGRESS', percent: 100 })
      self.postMessage({ type: 'DONE', ...result })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      self.postMessage({ type: 'ERROR', message })
    }
  }
}

export {}
