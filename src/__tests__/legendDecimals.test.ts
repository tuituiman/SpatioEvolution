import { describe, it, expect } from 'vitest'
import { getDecimalPlaces, getNextStartValue } from '../map/mapController'

describe('getDecimalPlaces', () => {
  it('identifies decimal places correctly', () => {
    expect(getDecimalPlaces(0)).toBe(0)
    expect(getDecimalPlaces(5)).toBe(0)
    expect(getDecimalPlaces(3.55)).toBe(2)
    expect(getDecimalPlaces(6.3)).toBe(1)
    expect(getDecimalPlaces(10.0)).toBe(0) // 10.0.toString() is "10" in JS
    expect(getDecimalPlaces(1.0001)).toBe(4)
  })

  it('handles scientific notation correctly', () => {
    expect(getDecimalPlaces(1e-5)).toBe(5)
    expect(getDecimalPlaces(2.5e-3)).toBe(4) // 0.0025
  })
})

describe('getNextStartValue', () => {
  it('calculates the next start value correctly', () => {
    expect(getNextStartValue(5)).toBe(6)
    expect(getNextStartValue(6.3)).toBe(6.4)
    expect(getNextStartValue(3.55)).toBe(3.56)
  })
})

describe('Consistent Decimal Formatting Simulation', () => {
  it('formats legend ranges consistently', () => {
    const breaksStart = 1
    const breaks = [3.55, 6.3, 10.0]
    
    // Simulate our logic
    const allValues: number[] = [breaksStart]
    breaks.forEach((b, i) => {
      allValues.push(b)
      if (i > 0) {
        allValues.push(getNextStartValue(breaks[i - 1]))
      }
    })
    
    const maxDec = Math.max(...allValues.map(getDecimalPlaces), 0)
    expect(maxDec).toBe(2) // Because of 3.55

    const formattedBands = breaks.map((b, i) => {
      const startVal = i === 0 ? breaksStart : getNextStartValue(breaks[i - 1])
      return {
        start: startVal.toLocaleString(undefined, { minimumFractionDigits: maxDec, maximumFractionDigits: maxDec }),
        end: b.toLocaleString(undefined, { minimumFractionDigits: maxDec, maximumFractionDigits: maxDec })
      }
    })

    expect(formattedBands[0]).toEqual({ start: '1.00', end: '3.55' })
    expect(formattedBands[1]).toEqual({ start: '3.56', end: '6.30' })
    expect(formattedBands[2]).toEqual({ start: '6.40', end: '10.00' })
  })
})
