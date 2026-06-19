import { describe, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { buildDictionary, calculateGlobalStats } from '../data/aggregator'
import { locationResolver } from '../data/locationResolver'

function currentCalcBreaks(values: number[], numClasses: number = 5): number[] {
  let defaultBreaks = [1, 5, 10, 50, 100, 500, 1000, 5000]
  const targetLen = numClasses - 1
  if (values.length === 0) return defaultBreaks.slice(0, targetLen)
  const sorted = [...values].filter(v => v > 0).sort((a, b) => a - b)
  if (sorted.length === 0) return defaultBreaks.slice(0, targetLen)

  const len = sorted.length
  const breaks: number[] = []
  for (let i = 1; i <= targetLen; i++) {
    const fraction = i / numClasses
    const index = Math.floor(len * fraction)
    const val = sorted[index >= len ? len - 1 : index] ?? defaultBreaks[i - 1] ?? i
    breaks.push(val)
  }

  const unique = [...new Set(breaks)].filter(v => v > 0).sort((a, b) => a - b)
  while (unique.length < targetLen) {
    unique.push((unique[unique.length - 1] ?? 0) + 10)
  }
  return unique
}

function improvedCalcBreaks(values: number[], numClasses: number = 5): number[] {
  let defaultBreaks = [1, 5, 10, 50, 100, 500, 1000, 5000]
  const targetLen = numClasses - 1
  if (values.length === 0) return defaultBreaks.slice(0, targetLen)
  const sorted = [...values].filter(v => v > 0).sort((a, b) => a - b)
  if (sorted.length === 0) return defaultBreaks.slice(0, targetLen)

  const len = sorted.length
  const breaks: number[] = []
  for (let i = 1; i <= targetLen; i++) {
    const fraction = i / numClasses
    const index = Math.floor(len * fraction)
    const val = sorted[index >= len ? len - 1 : index] ?? defaultBreaks[i - 1] ?? i
    breaks.push(val)
  }

  const unique = [...new Set(breaks)].filter(v => v > 0).sort((a, b) => a - b)
  
  // Dynamic step size calculation instead of hardcoded 10
  let step = 10
  if (unique.length >= 2) {
    step = unique[unique.length - 1] - unique[unique.length - 2]
  } else if (unique.length === 1) {
    step = unique[0] > 0 ? unique[0] : 10
  }
  if (step <= 0) step = 10

  // Handle float precision if needed
  let decimalPlaces = 0
  unique.forEach(v => {
    const str = v.toString()
    const dotIdx = str.indexOf('.')
    if (dotIdx !== -1) {
      const dec = str.length - dotIdx - 1
      if (dec > decimalPlaces) decimalPlaces = dec
    }
  })

  while (unique.length < targetLen) {
    const lastVal = unique[unique.length - 1] ?? 0
    const nextVal = parseFloat((lastVal + step).toFixed(decimalPlaces))
    unique.push(nextVal)
  }
  return unique
}

describe('Inspect Legend and Stats', () => {
  it('diagnoses Flu_Report6768_Final_22.csv', async () => {
    const csvPath = path.resolve('Flu_Report6768_Final_22.csv')
    const csvContent = fs.readFileSync(csvPath, 'utf8')
    const lines = csvContent.split('\n').map(line => line.trim()).filter(Boolean)
    const header = lines[0].split(',')
    const rows = lines.slice(1).map(line => {
      const parts = line.split(',')
      const row: any = {}
      header.forEach((colName, idx) => { row[colName] = parts[idx] })
      return row
    })

    const keys = {
      date: 'วันที่เริ่มรักษา',
      province: 'จังหวัดขณะป่วย',
      district: 'อำเภอขณะป่วย',
      subdistrict: 'ตำบลขณะป่วย',
      value: ''
    }

    // Mock fetch for Thailand hierarchy
    const originalFetch = global.fetch
    global.fetch = async (url: any) => {
      const filePath = path.resolve('public/data/thailand_hierarchy.json')
      const content = fs.readFileSync(filePath, 'utf8')
      return { ok: true, json: async () => JSON.parse(content) } as any
    }

    await locationResolver.init()
    
    const modes: ('weekly' | 'monthly')[] = ['weekly', 'monthly']
    const levels: ('province' | 'district')[] = ['province', 'district']

    for (const mode of modes) {
      const { dictionary, periods } = await buildDictionary(rows, keys, mode)
      console.log(`\n================ MODE: ${mode} ================`)

      for (const level of levels) {
        const stats = calculateGlobalStats(
          dictionary,
          periods,
          level,
          { region: 'all', province: 'all', district: 'all', subdistrict: 'all' },
          false
        )

        if (stats) {
          console.log(`Level: [${level}] (Max value: ${stats.max})`)
          console.log(`  - Current Breaks: `, currentCalcBreaks(stats.allValues, 5))
          console.log(`  - Improved Breaks:`, improvedCalcBreaks(stats.allValues, 5))
        }
      }
    }

    global.fetch = originalFetch
  })
})
