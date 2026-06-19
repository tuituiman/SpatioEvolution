/**
 * moranWorker.ts — Web Worker: Moran's I & LISA Spatial Statistics Computation Engine
 * Runs CPU-heavy spatial statistics and permutation testing in a background thread.
 *
 * Messages IN:
 *   {
 *     type: 'RUN',
 *     periods: { key: string; label: string }[],
 *     areasByPeriod: Record<string, { code: string; name: string; value: number; centroid: [number, number] | null }[]>,
 *     adjacency: Record<string, string[]> | null,
 *     options: {
 *       weightType: 'inverse_distance' | 'queen' | 'rook',
 *       distanceBandKm: number,
 *       rowStandardized: boolean,
 *       numPermutations: number,
 *       lisaThreshold: number
 *     },
 *     adminLevel: string
 *   }
 *
 * Messages OUT:
 *   { type: 'PROGRESS', percent: number, periodKey: string }
 *   { type: 'DONE', results: Record<string, MoransResult> }
 *   { type: 'ERROR', message: string }
 */

// ── Re-export type for consumers ──
export type { MoransResult } from '../data/spatialStatsCore'
import { computeMoransI } from '../data/spatialStatsCore'

// ──────────────────────────────────────────
// Worker Message Handler
// ──────────────────────────────────────────
self.onmessage = (e: MessageEvent) => {
  const { type, periods, areasByPeriod, adjacency, options } = e.data

  if (type === 'RUN') {
    try {
      const results: Record<string, ReturnType<typeof computeMoransI>> = {}
      const totalPeriods = periods.length

      for (let i = 0; i < totalPeriods; i++) {
        const p = periods[i]
        const periodKey = p.key

        // Post progress update
        const percent = Math.round((i / totalPeriods) * 100)
        self.postMessage({ type: 'PROGRESS', percent, periodKey })

        const areasData = areasByPeriod[periodKey]
        if (!areasData || areasData.length === 0) continue

        const res = computeMoransI(areasData, adjacency, options)
        if (res) {
          results[periodKey] = res
        }
      }

      self.postMessage({ type: 'PROGRESS', percent: 100, periodKey: 'DONE' })
      self.postMessage({ type: 'DONE', results })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      self.postMessage({ type: 'ERROR', message: msg })
    }
  }
}

export { }
