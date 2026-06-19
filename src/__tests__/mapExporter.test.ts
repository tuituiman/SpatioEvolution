/**
 * mapExporter.test.ts
 * Unit tests for video export frame limit guard
 */
import { describe, it, expect } from 'vitest'
import { MAX_VIDEO_FRAMES } from '../core/mapExporter'

describe('MAX_VIDEO_FRAMES constant', () => {
  it('is set to 120', () => {
    expect(MAX_VIDEO_FRAMES).toBe(120)
  })

  it('is a reasonable limit (between 60 and 300)', () => {
    expect(MAX_VIDEO_FRAMES).toBeGreaterThanOrEqual(60)
    expect(MAX_VIDEO_FRAMES).toBeLessThanOrEqual(300)
  })
})
