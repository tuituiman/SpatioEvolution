/**
 * db.ts — Dexie IndexedDB Schema
 * SpatioEvolution Persistence Layer
 *
 * Tables:
 *   datasets   — เก็บ rawRows + metadata ของแต่ละ dataset ที่ import
 *   uiState    — เก็บ key/value ของ UI state ที่ต้องการ restore หลัง refresh
 */

import Dexie, { type Table } from 'dexie'
import type { DataKeys, IngestionMode } from '../store/useAppStore'

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────

export interface PersistedDataset {
  id: string                          // UUID ตรงกับ DatasetMeta.id
  fileName: string
  rowCount: number
  keys: DataKeys                      // DataKeys
  ingestionMode: IngestionMode        // IngestionMode
  loadedAt: Date
  rows: Record<string, unknown>[]     // rawRows ทั้งหมด
  retentionDays: number | null        // null = ไม่หมดอายุ
  fileBytes?: Uint8Array
  sheetNames?: string[]
  selectedSheet?: string
}

export interface PersistedUIState {
  key: string                         // primary key เช่น 'annotations', 'arrows', 'canvas'
  value: unknown
  updatedAt: Date
}

// ──────────────────────────────────────────
// Database Class
// ──────────────────────────────────────────

class SpatioEvolutionDB extends Dexie {
  datasets!: Table<PersistedDataset, string>
  uiState!: Table<PersistedUIState, string>

  constructor() {
    super('SpatioEvolutionDB')

    this.version(1).stores({
      datasets: 'id, fileName, loadedAt, retentionDays',
      uiState:  'key, updatedAt',
    })
  }
}

// ──────────────────────────────────────────
// Singleton Export
// ──────────────────────────────────────────

export const db = new SpatioEvolutionDB()
