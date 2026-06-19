/**
 * persistence.test.ts
 * Unit tests for IndexedDB persistence layer (mocking Dexie)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the db module
vi.mock('../data/db', () => ({
  db: {
    datasets: {
      put: vi.fn().mockResolvedValue(undefined),
      toArray: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      bulkDelete: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    },
    uiState: {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      toArray: vi.fn().mockResolvedValue([]),
      clear: vi.fn().mockResolvedValue(undefined),
    },
  },
}))

import { saveDataset, loadAllDatasets, deleteDataset, saveUIState, loadUIState } from '../data/persistence'
import { db } from '../data/db'

describe('saveDataset', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('calls db.datasets.put with correct structure', async () => {
    const rows = [{ a: 1 }]
    await saveDataset('test-id', rows, {
      fileName: 'test.csv',
      rowCount: 1,
      keys: { date: 'date', province: 'prov', district: 'd', subdistrict: 's', lat: '', lng: '', value: 'v', color: '' } as any,
      ingestionMode: 'admin_dynamic',
      loadedAt: new Date('2024-01-01'),
    })
    expect(db.datasets.put).toHaveBeenCalledOnce()
    const arg = (db.datasets.put as any).mock.calls[0][0]
    expect(arg.id).toBe('test-id')
    expect(arg.rowCount).toBe(1)
  })

  it('handles db error gracefully (no throw)', async () => {
    ;(db.datasets.put as any).mockRejectedValueOnce(new Error('Quota exceeded'))
    await expect(saveDataset('x', [], {
      fileName: '', rowCount: 0, keys: {} as any, ingestionMode: 'admin_dynamic', loadedAt: new Date()
    })).resolves.toBeUndefined()
  })
})

describe('loadAllDatasets', () => {
  it('returns empty array when no datasets', async () => {
    ;(db.datasets.toArray as any).mockResolvedValue([])
    const result = await loadAllDatasets()
    expect(result).toEqual([])
  })

  it('filters out expired datasets (retentionDays exceeded)', async () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
    ;(db.datasets.toArray as any).mockResolvedValue([
      { id: 'old', fileName: 'old.csv', rowCount: 0, keys: {}, rows: [], loadedAt: oldDate, retentionDays: 7 },
      { id: 'fresh', fileName: 'new.csv', rowCount: 0, keys: {}, rows: [], loadedAt: new Date(), retentionDays: 30 },
    ])
    const result = await loadAllDatasets()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('fresh')
    expect(db.datasets.bulkDelete).toHaveBeenCalledWith(['old'])
  })

  it('keeps datasets with retentionDays = null forever', async () => {
    const veryOldDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    ;(db.datasets.toArray as any).mockResolvedValue([
      { id: 'forever', fileName: 'forever.csv', rowCount: 0, keys: {}, rows: [], loadedAt: veryOldDate, retentionDays: null },
    ])
    const result = await loadAllDatasets()
    expect(result).toHaveLength(1)
  })
})

describe('saveUIState / loadUIState', () => {
  it('saves and can mock-load a value', async () => {
    ;(db.uiState.get as any).mockResolvedValue({ key: 'theme', value: 'dark', updatedAt: new Date() })
    await saveUIState('theme', 'dark')
    const val = await loadUIState<string>('theme')
    expect(val).toBe('dark')
  })

  it('returns null for missing key', async () => {
    ;(db.uiState.get as any).mockResolvedValue(null)
    const val = await loadUIState('nonexistent')
    expect(val).toBeNull()
  })
})
