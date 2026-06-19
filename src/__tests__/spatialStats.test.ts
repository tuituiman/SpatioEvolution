/**
 * spatialStats.test.ts
 * Unit tests for spatial statistics functions
 */
import { describe, it, expect } from 'vitest'
import { calculateDistance, calculateCorrelation } from '../data/spatialStats'

describe('calculateDistance (Haversine)', () => {
  it('returns 0 for same point', () => {
    expect(calculateDistance(13.75, 100.5, 13.75, 100.5)).toBe(0)
  })

  it('calculates Bangkok to Chiang Mai (~580km via those coords)', () => {
    const dist = calculateDistance(13.75, 100.5, 18.79, 98.98)
    expect(dist).toBeGreaterThan(550)
    expect(dist).toBeLessThan(650)
  })

  it('calculates very short distance accurately', () => {
    // 0.01° lat ≈ 1.11km
    const dist = calculateDistance(13.75, 100.5, 13.76, 100.5)
    expect(dist).toBeGreaterThan(1.0)
    expect(dist).toBeLessThan(1.3)
  })

  it('is symmetric', () => {
    const d1 = calculateDistance(13, 100, 15, 102)
    const d2 = calculateDistance(15, 102, 13, 100)
    expect(Math.abs(d1 - d2)).toBeLessThan(0.001)
  })
})

describe('calculateCorrelation', () => {
  const perfectPosXArr = [1, 2, 3, 4, 5]
  const perfectPosYArr = [2, 4, 6, 8, 10]
  const perfectNegYArr = [10, 8, 6, 4, 2]

  it('returns Pearson r ≈ 1 for perfect positive correlation', () => {
    const result = calculateCorrelation(perfectPosXArr, perfectPosYArr)
    expect(result!.pearsonR).toBeCloseTo(1, 3)
  })

  it('returns Pearson r ≈ -1 for perfect negative correlation', () => {
    const result = calculateCorrelation(perfectPosXArr, perfectNegYArr)
    expect(result!.pearsonR).toBeCloseTo(-1, 3)
  })

  it('has correct sampleSize', () => {
    const result = calculateCorrelation(perfectPosXArr, perfectPosYArr)
    expect(result!.sampleSize).toBe(5)
  })

  it('returns strength label for strong positive', () => {
    const result = calculateCorrelation(perfectPosXArr, perfectPosYArr)
    expect(result!.strength).toContain('Strong')
    expect(result!.strength).toContain('Positive')
  })

  it('handles minimum data (2 points)', () => {
    const result = calculateCorrelation([1, 2], [3, 6])
    // n < 3 returns null
    expect(result).toBeNull()
  })

  it('returns null for empty arrays', () => {
    const result = calculateCorrelation([], [])
    expect(result).toBeNull()
  })
})
