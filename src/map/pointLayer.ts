/**
 * pointLayer.ts — Coordinate Points Layer Renderer for Leaflet
 * รองรับการพล็อตพิกัดจริง Lat/Lng 3 รูปแบบ: กลุ่มหมุด (Cluster), ความร้อน (Heatmap), ขนาดเชิงสถิติ (Proportional)
 * สัมพันธ์กับมิติเวลารายวัน/สัปดาห์ (Timeline) และการสะสมความถี่
 */
import L from 'leaflet'
import { useAppStore } from '../store/useAppStore'
import { parseDate, toDateKey } from '../data/dateParser'
import { PANES, COLOR_PALETTES, getMap, getColor } from './mapController'
import { isPointInScope } from '../data/healthZones'

// Module-level layer groups to keep track of Leaflet point overlays
let _pointLayerGroup: L.LayerGroup | null = null

export interface PointRecord {
  lat: number
  lng: number
  value: number
  label?: string
  dateKey?: string
  color?: string
}

/** เคลียร์เลเยอร์จุดพิกัดทั้งหมดออกจากแผนที่ */
export function destroyPointLayer(): void {
  const map = getMap()
  if (map && _pointLayerGroup) {
    map.removeLayer(_pointLayerGroup)
    _pointLayerGroup = null
  }
}

/** 
 * แกะข้อมูลดิบจาก Zustand rows ออกเป็นรายการจุดพิกัดจริงสัมพันธ์กับ Timeline 
 */
export function getActiveCoordinatesSlice(overridePeriodKeys?: string[]): PointRecord[] {
  const store = useAppStore.getState()
  const { rawRows, dataKeys, periods, currentStep, isCumulative, selectedPeriods, groupingMode, ingestionMode, scope } = store

  if (rawRows.length === 0 || !dataKeys.lat || !dataKeys.lng) return []

  const hasDateCol = !!dataKeys.date
  const hasValCol = !!dataKeys.value
  const hasColorCol = !!dataKeys.color

  // ดึงช่วงเวลาที่แอกทีฟ
  const activePeriod = periods[currentStep]
  const isMultiSelect = selectedPeriods.size > 0

  const activeKeysSet = new Set<string>()
  if (overridePeriodKeys) {
    overridePeriodKeys.forEach(k => activeKeysSet.add(k))
  } else if (isMultiSelect) {
    selectedPeriods.forEach(k => activeKeysSet.add(k))
  } else if (isCumulative && activePeriod) {
    // สะสมตั้งแต่สเตทแรกถึงปัจจุบัน
    periods.slice(0, currentStep + 1).forEach(p => activeKeysSet.add(p.key))
  } else if (activePeriod) {
    activeKeysSet.add(activePeriod.key)
  }

  // แยกแยะรูปแบบข้อมูลอนุกรมเวลา
  // 1. แบบพิกัดคงที่-ค่าเปลี่ยน (Fixed points, changing values)
  // หากไม่มีคอลัมน์วันที่ในไฟล์ หรือข้อมูลเป็นแบบ Wide Format (ไม่มีคอลัมน์วันที่เดี่ยว)
  const isFixedStations = ingestionMode === 'admin_static' || !hasDateCol

  if (isFixedStations) {
    // จัดกลุ่มหาจุดพิกัดคงที่
    const stationsMap = new Map<string, { lat: number; lng: number; label: string; vals: Record<string, number>; color?: string }>()
    
    // ค้นหาคอลัมน์มิติเวลาในกรณี Wide format (คอลัมน์อื่นๆ ที่ไม่ใช่ lat, lng, value...)
    const geoCols = [dataKeys.lat, dataKeys.lng, dataKeys.province, dataKeys.district, dataKeys.subdistrict, dataKeys.color].filter(Boolean) as string[]
    const timeCols = Object.keys(rawRows[0] || {}).filter(c => !geoCols.includes(c))

    rawRows.forEach((row: any) => {
      const lat = parseFloat(String(row[dataKeys.lat] || '').trim())
      const lng = parseFloat(String(row[dataKeys.lng] || '').trim())
      if (isNaN(lat) || isNaN(lng)) return

      // กรองพื้นที่นอกขอบเขตการดู (Bounding Box Check)
      if (!isPointInScope(lat, lng, scope)) return

      const key = `${lat.toFixed(5)},${lng.toFixed(5)}`
      const label = String(row[dataKeys.province] || row[dataKeys.district] || 'สถานีตรวจวัด')
      const color = hasColorCol ? String(row[dataKeys.color] || '') : undefined

      if (!stationsMap.has(key)) {
        stationsMap.set(key, { lat, lng, label, vals: {}, color })
      }

      const item = stationsMap.get(key)!

      if (timeCols.length > 0) {
        // Wide Format: ค่ากระจายตามคอลัมน์เวลาแนวนอน
        timeCols.forEach(col => {
          const val = parseFloat(String(row[col] || '').replace(/,/g, '').trim())
          item.vals[col] = (item.vals[col] || 0) + (isNaN(val) ? 0 : val)
        })
      } else {
        // Static: ค่าคงที่ปกติ
        const val = hasValCol ? parseFloat(String(row[dataKeys.value] || '').replace(/,/g, '').trim()) : 1
        item.vals['static'] = (item.vals['static'] || 0) + (isNaN(val) ? 0 : val)
      }
    })

    // แปลงผลลัพธ์ดึงเฉพาะช่วงเวลาแอกทีฟมาคำนวณสะสม
    const slice: PointRecord[] = []
    stationsMap.forEach((station) => {
      let finalVal = 0
      
      if (timeCols.length > 0) {
        // รวมยอดตามช่วงเวลาแอกทีฟ
        // หัวคอลัมน์เวลานำมาจับคู่ตรงๆ
        timeCols.forEach(col => {
          // เพื่อความยืดหยุ่น จับคู่รหัสสัปดาห์ตรงกับ Label หรือ Key
          // ค้นหาช่วงเวลาที่ตรงกัน
          const matchedPeriod = periods.find(p => p.key === col || p.label === col)
          if (matchedPeriod && activeKeysSet.has(matchedPeriod.key)) {
            finalVal += station.vals[col] || 0
          } else if (!matchedPeriod && isMultiSelect) {
            // หากหาช่วงไม่เจอแต่มีมัลติซีเล็กต์ อนุโลมใช้ตรงๆ
            finalVal += station.vals[col] || 0
          } else if (activePeriod && (col === activePeriod.key || col === activePeriod.label)) {
            finalVal += station.vals[col] || 0
          }
        })
      } else {
        finalVal = station.vals['static'] || 0
      }

      slice.push({
        lat: station.lat,
        lng: station.lng,
        value: finalVal,
        label: station.label,
        color: station.color
      })
    })

    return slice
  } else {
    // 2. แบบพิกัดเปลี่ยนตำแหน่งขยับย้ายที่ตามช่วงเวลา (Moving coordinates event-based)
    // ทุกแถวมีพิกัด Lat, Lng และมีวันที่ระบุ
    const slice: PointRecord[] = []

    rawRows.forEach((row: any) => {
      const lat = parseFloat(String(row[dataKeys.lat] || '').trim())
      const lng = parseFloat(String(row[dataKeys.lng] || '').trim())
      if (isNaN(lat) || isNaN(lng)) return

      // กรองพื้นที่นอกขอบเขตการดู (Bounding Box Check)
      if (!isPointInScope(lat, lng, scope)) return

      // แกะวันและหา Period Key
      const dateVal = row[dataKeys.date]
      const parsedDate = parseDate(dateVal)
      if (!parsedDate || isNaN(parsedDate.getTime())) return

      const periodKey = toDateKey(parsedDate, groupingMode)

      // กรองเฉพาะแถวข้อมูลที่ตรงกับช่วงเวลาแอกทีฟของ Timeline
      if (activeKeysSet.has(periodKey)) {
        const val = hasValCol ? parseFloat(String(row[dataKeys.value] || '').replace(/,/g, '').trim()) : 1
        const label = String(row[dataKeys.province] || row[dataKeys.district] || 'จุดเสี่ยง')
        const color = hasColorCol ? String(row[dataKeys.color] || '') : undefined

        slice.push({
          lat,
          lng,
          value: isNaN(val) ? 1 : val,
          label,
          color
        })
      }
    })

    return slice
  }
}

/** 
 * เรนเดอร์จุดพิกัดจริงลงบน Leaflet Map ตาม pointStyle
 */
export function mountPointLayer(): void {
  const map = getMap()
  if (!map) return

  // ทำความสะอาดเลเยอร์จุดเก่าออกก่อน
  destroyPointLayer()

  const store = useAppStore.getState()
  const { pointStyle, palette, globalBreaks, colorMode, customColors } = store

  const sliceData = getActiveCoordinatesSlice()
  if (sliceData.length === 0) return

  // สร้าง LayerGroup ใหม่ใส่ใน Bubble Pane (มี Z-index 450 อยู่หน้าขอบเขตพื้นที่)
  _pointLayerGroup = L.layerGroup([], { pane: PANES.BUBBLE.name })

  const colors = COLOR_PALETTES[palette] ?? COLOR_PALETTES.YlOrRd
  
  // หาช่วงค่าขอบเขตความกว้างตัวเลข (Breaks)
  const values = sliceData.map(d => d.value).filter(v => v > 0)
  const breaks = globalBreaks.length > 0 ? globalBreaks : [1, 5, 10, 50, 100]

  if (pointStyle === 'proportional') {
    // ── 1. Proportional Proportional Circles (ขนาดวงกลมระบายสถิติ) ──
    sliceData.forEach(pt => {
      if (pt.value <= 0) return

      // คำนวณสี
      const color = (colorMode === 'custom' && pt.color)
        ? pt.color
        : getColor(pt.value, breaks, palette, customColors)

      // คำนวณรัศมี (แปรผันตามรากที่สองของค่าสถิติเพื่อความแม่นยำด้านพื้นที่วงกลม)
      const baseRadius = 6
      const scaleFactor = Math.sqrt(pt.value) * 2.5
      const radius = Math.min(65, Math.max(6, baseRadius + scaleFactor))

      const marker = L.circleMarker([pt.lat, pt.lng], {
        pane: PANES.BUBBLE.name,
        radius,
        fillColor: color,
        fillOpacity: 0.65,
        color: '#ffffff',
        weight: 1.5,
        opacity: 0.9,
      })

      // ติดตั้ง Tooltip สวยงาม
      marker.bindTooltip(`
        <div class="p-1 text-slate-100 text-xs font-semibold">
          <div class="font-bold border-b border-slate-700 pb-1 mb-1">${pt.label ?? 'จุดพิกัด'}</div>
          <div>ค่าตัวเลขสถิติ: <span class="text-blue-400 font-bold">${pt.value.toLocaleString()}</span></div>
          <div class="text-[10px] text-slate-400 mt-0.5">พิกัด: ${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}</div>
        </div>
      `, {
        direction: 'top',
        className: 'spatio-tooltip-leaflet border border-slate-700 bg-slate-900/90 rounded-lg p-2 shadow-2xl backdrop-blur-sm'
      })

      _pointLayerGroup!.addLayer(marker)
    })
  } else if (pointStyle === 'heatmap') {
    // ── 2. Heatmap Density Layer (แผนที่ความร้อนแสดงจุดหนาแน่นระบาด) ──
    // เราจะวาดวงกลมไล่ระดับเฉดสีโปร่งแสงและทับซ้อนกันแบบเบลอ เพื่อสร้างแผนที่ความร้อนที่เบาและทรงพลัง
    sliceData.forEach(pt => {
      if (pt.value <= 0) return

      // รัศมีกระจายความร้อน
      const heatRadius = 2500 // 2.5 กิโลเมตร
      
      const marker = L.circle([pt.lat, pt.lng], {
        pane: PANES.BUBBLE.name,
        radius: heatRadius,
        fillColor: '#ef4444', // สีแดงความร้อน
        fillOpacity: Math.min(0.2, 0.02 * pt.value), // ยิ่งทับกันยิ่งแดงเข้ม
        color: '#ef4444',
        weight: 0, // ปิดเส้นขอบเพื่อเอฟเฟกต์เบลอทับซ้อน
        opacity: 0
      })

      marker.bindTooltip(`
        <div class="p-1 text-slate-100 text-xs font-semibold">
          <div class="font-bold border-b border-slate-700 pb-1 mb-1">${pt.label ?? 'จุดพิกัดระบาด'}</div>
          <div>ความหนาแน่นเคส: <span class="text-rose-400 font-bold">${pt.value.toLocaleString()}</span></div>
        </div>
      `, { direction: 'top', className: 'spatio-tooltip-leaflet border border-slate-700 bg-slate-900/90 rounded-lg p-2' })

      _pointLayerGroup!.addLayer(marker)
    })

    // ใส่พิกัดจุดเล็กตรงกลางไว้ชี้ตำแหน่งจริงด้วย
    sliceData.forEach(pt => {
      const marker = L.circleMarker([pt.lat, pt.lng], {
        pane: PANES.BUBBLE.name,
        radius: 3,
        fillColor: '#ffffff',
        fillOpacity: 0.9,
        color: '#e2e8f0',
        weight: 1,
      })
      _pointLayerGroup!.addLayer(marker)
    })
  } else {
    // ── 3. Marker Clusters / Circle Groups (กลุ่มหมุดอัจฉริยะ) ──
    // พล็อตหมุดทรงพรีเมียมเรเดียลปักตำแหน่ง
    sliceData.forEach(pt => {
      if (pt.value <= 0) return

      // รัศมีขนาดกะทัดรัด
      const marker = L.circleMarker([pt.lat, pt.lng], {
        pane: PANES.BUBBLE.name,
        radius: 8,
        fillColor: '#3b82f6', // สีน้ำเงิน
        fillOpacity: 0.8,
        color: '#ffffff',
        weight: 2,
        opacity: 1
      })

      marker.bindTooltip(`
        <div class="p-1 text-slate-100 text-xs font-semibold">
          <div class="font-bold border-b border-slate-700 pb-1 mb-1">${pt.label ?? 'ตำแหน่งผู้ป่วย'}</div>
          <div>จำนวนเคสในจุดนี้: <span class="text-blue-400 font-bold">${pt.value.toLocaleString()} เคส</span></div>
          <div class="text-[10px] text-slate-400 mt-0.5">พิกัดจริง: ${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}</div>
        </div>
      `, { direction: 'top', className: 'spatio-tooltip-leaflet border border-slate-700 bg-slate-900/90 rounded-lg p-2' })

      _pointLayerGroup!.addLayer(marker)
    })
  }

  // ── 4. Spatiotemporal Drift Trajectory Overlay (เส้นทางการเคลื่อนตัวของโรค) ──
  const driftRes = (window as any).driftRes
  if (driftRes && driftRes.trajectory && driftRes.trajectory.length >= 2) {
    const latlngs = driftRes.trajectory.map((t: any) => t.centroid)
    
    // Draw neon trajectory path polyline
    const path = L.polyline(latlngs, {
      pane: PANES.BUBBLE.name,
      color: '#06b6d4', // Neon Cyan
      weight: 4,
      opacity: 0.9,
      dashArray: '6, 6'
    })

    // Draw neon arrow/dots at each centroid
    driftRes.trajectory.forEach((t: any, idx: number) => {
      const isStart = idx === 0
      const isEnd = idx === driftRes.trajectory.length - 1
      
      const marker = L.circleMarker(t.centroid, {
        pane: PANES.BUBBLE.name,
        radius: isEnd ? 9 : (isStart ? 7 : 5),
        fillColor: isEnd ? '#06b6d4' : (isStart ? '#3b82f6' : '#cbd5e1'),
        fillOpacity: 0.9,
        color: '#ffffff',
        weight: 2
      })

      marker.bindTooltip(`
        <div class="p-1 text-slate-100 text-xs font-semibold">
          <div class="font-bold border-b border-slate-700 pb-1 mb-1">${t.label}</div>
          <div class="text-cyan-400 font-bold">จุดศูนย์กลางการระบาด (Weighted Centroid)</div>
          <div class="text-[9px] text-slate-400 mt-0.5">พิกัด: ${t.centroid[0].toFixed(4)}, ${t.centroid[1].toFixed(4)}</div>
        </div>
      `, { sticky: true, className: 'spatio-tooltip-leaflet border border-slate-700 bg-slate-900/90 rounded-lg p-2' })

      _pointLayerGroup!.addLayer(marker)
    })

    _pointLayerGroup!.addLayer(path)
  }

  // ส่งเลเยอร์ขึ้นแสดงบนแผนที่ Leaflet จริง
  _pointLayerGroup.addTo(map)
}
