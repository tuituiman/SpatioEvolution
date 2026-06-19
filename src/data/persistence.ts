/**
 * persistence.ts — IndexedDB Save/Load API
 * SpatioEvolution Persistence Layer
 *
 * ใช้ Dexie (db.ts) เป็น backend
 * ทุก function เป็น async/await พร้อม error handling
 */

import { db } from './db'
import type { PersistedDataset } from './db'
import type { DataKeys, IngestionMode } from '../store/useAppStore'

// ──────────────────────────────────────────
// Dataset Persistence
// ──────────────────────────────────────────

/** บันทึก dataset ลง IndexedDB */
export async function saveDataset(
  id: string,
  rows: Record<string, unknown>[],
  meta: {
    fileName: string
    rowCount: number
    keys: DataKeys
    ingestionMode: IngestionMode
    loadedAt: Date
  },
  retentionDays: number | null = null
): Promise<void> {
  try {
    await db.datasets.put({
      id,
      fileName: meta.fileName,
      rowCount: meta.rowCount,
      keys: meta.keys,
      ingestionMode: meta.ingestionMode,
      loadedAt: meta.loadedAt,
      rows,
      retentionDays,
    })
  } catch (err) {
    // ตรวจจับ Storage Quota Exceeded — แจ้ง user แทน silent fail
    if (err instanceof DOMException && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      console.warn('[Persistence] Storage quota exceeded!')
      // ส่ง custom event ให้ App รับและแสดง notification (หลีกเลี่ยง circular import)
      window.dispatchEvent(new CustomEvent('spatio:storage-quota', {
        detail: { message: '⚠️ พื้นที่จัดเก็บข้อมูลเต็ม กรุณาลบชุดข้อมูลเก่าออกในหน้า "จัดการข้อมูล" ก่อนบันทึกใหม่' }
      }))
      return
    }
    console.warn('[Persistence] saveDataset failed:', err)
  }
}

/** โหลด dataset ทั้งหมดจาก IndexedDB (พร้อมลบที่หมดอายุ) */
export async function loadAllDatasets(): Promise<PersistedDataset[]> {
  try {
    const all = await db.datasets.toArray()
    const now = Date.now()
    const valid: PersistedDataset[] = []
    const expired: string[] = []

    for (const ds of all) {
      if (ds.retentionDays === null) {
        valid.push(ds)
      } else {
        const ageMs = now - new Date(ds.loadedAt).getTime()
        const ageDays = ageMs / (1000 * 60 * 60 * 24)
        if (ageDays <= ds.retentionDays) {
          valid.push(ds)
        } else {
          expired.push(ds.id)
        }
      }
    }

    // ลบที่หมดอายุออก
    if (expired.length > 0) {
      await db.datasets.bulkDelete(expired)
      console.log(`[Persistence] Removed ${expired.length} expired dataset(s)`)
    }

    return valid
  } catch (err) {
    console.warn('[Persistence] loadAllDatasets failed:', err)
    return []
  }
}

/** ลบ dataset ออกจาก IndexedDB */
export async function deleteDataset(id: string): Promise<void> {
  try {
    await db.datasets.delete(id)
  } catch (err) {
    console.warn('[Persistence] deleteDataset failed:', err)
  }
}

/** ลบทุก dataset ออกจาก IndexedDB */
export async function clearAllDatasets(): Promise<void> {
  try {
    await db.datasets.clear()
  } catch (err) {
    console.warn('[Persistence] clearAllDatasets failed:', err)
  }
}

// ──────────────────────────────────────────
// UI State Persistence
// ──────────────────────────────────────────

/** บันทึก UI state ชิ้นนึงลง IndexedDB */
export async function saveUIState(key: string, value: unknown): Promise<void> {
  try {
    await db.uiState.put({ key, value, updatedAt: new Date() })
  } catch (err) {
    if (err instanceof DOMException && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      console.warn(`[Persistence] saveUIState(${key}): Storage quota exceeded`)
      return
    }
    console.warn(`[Persistence] saveUIState(${key}) failed:`, err)
  }
}

/** โหลด UI state ชิ้นนึงจาก IndexedDB */
export async function loadUIState<T>(key: string): Promise<T | null> {
  try {
    const record = await db.uiState.get(key)
    return record ? (record.value as T) : null
  } catch (err) {
    console.warn(`[Persistence] loadUIState(${key}) failed:`, err)
    return null
  }
}

/** โหลด UI state ทั้งหมดเป็น Record */
export async function loadAllUIState(): Promise<Record<string, unknown>> {
  try {
    const all = await db.uiState.toArray()
    const result: Record<string, unknown> = {}
    for (const { key, value } of all) {
      result[key] = value
    }
    return result
  } catch (err) {
    console.warn('[Persistence] loadAllUIState failed:', err)
    return {}
  }
}

/** ลบ UI state ทั้งหมด */
export async function clearAllUIState(): Promise<void> {
  try {
    await db.uiState.clear()
  } catch (err) {
    console.warn('[Persistence] clearAllUIState failed:', err)
  }
}

/** ลบทุกอย่างใน IndexedDB */
export async function clearAllPersistence(): Promise<void> {
  await Promise.all([clearAllDatasets(), clearAllUIState()])
}

/** ประมาณขนาดข้อมูลที่ใช้ใน IndexedDB (bytes) */
export async function estimateStorageUsage(): Promise<number> {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate()
      return estimate.usage ?? 0
    }
    return 0
  } catch {
    return 0
  }
}
