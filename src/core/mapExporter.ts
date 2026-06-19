import { domToPng, domToCanvas } from 'modern-screenshot'
import { useAppStore } from '../store/useAppStore'
import { updateBaseMapVisibility } from '../map/mapController'

/**
 * สร้าง filter function สำหรับ modern-screenshot
 * ใช้แทน ignoreElements ของ html2canvas
 * คืนค่า true = รวม, false = ไม่รวม
 */
function createExportFilter(el: Node): boolean {
  if (!(el instanceof HTMLElement)) return true

  // Ignore elements with no-export class
  if (el.classList.contains('no-export')) return false

  // Ignore buttons
  if (el.tagName === 'BUTTON') return false

  // Ignore settings buttons
  if (el.classList.contains('settings-btn')) return false

  // Ignore resize handles
  if (el.classList.contains('resize-handle')) return false

  // Ignore leaflet map controls
  if (el.classList.contains('leaflet-control-container')) return false

  // Ignore selected widget outline wrapper
  if (el.classList.contains('shadow-lg') && el.classList.contains('rounded-xl')) return false

  return true
}

/**
 * รอให้ font ทั้งหมดโหลดเสร็จก่อน capture
 */
async function waitForFonts(): Promise<void> {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready
    console.log('[FontDebug] Fonts ready. Listing loaded fonts:')
    document.fonts.forEach((font) => {
      console.log(`[FontDebug] Family: ${font.family}, Weight: ${font.weight}, Style: ${font.style}, Status: ${font.status}`)
    })
  }
  // รอเพิ่ม 100ms เพื่อให้ browser render font ที่โหลดเสร็จ
  await new Promise(resolve => setTimeout(resolve, 100))
}

/**
 * Captures the specified map container DOM element and exports it as a PNG Data URL.
 * ใช้ modern-screenshot (domToPng) แทน html2canvas เพื่อรองรับ font ภาษาไทย (Noto Sans Thai) ได้ดีกว่า
 */
export async function exportMapAsImage(mapElementId: string, scale: number = 2): Promise<string> {
  const element = document.getElementById(mapElementId)
  if (!element) throw new Error(`Map element #${mapElementId} not found`)

  const store = useAppStore.getState()
  const originalSelectedWidgetId = store.selectedWidgetId
  const originalSelectedLabelId = store.selectedLabelId

  // ปิดกรอบการเลือกชั่วคราวเพื่อซ่อนกรอบสีน้ำเงิน/ปุ่มรีไซส์
  store.setSelectedWidgetId(null)
  store.setSelectedLabelId(null)

  try {
    // รอให้ font โหลดเสร็จก่อน
    await waitForFonts()

    // ใช้ modern-screenshot (domToPng) แทน html2canvas
    const dataUrl = await domToPng(element, {
      scale: scale,
      backgroundColor: '#0f172a', // Slate 900 base background color
      filter: createExportFilter,
      style: {
        fontFamily: "'Inter', 'Noto Sans Thai', 'Leelawadee UI', Tahoma, sans-serif",
      },
    })

    return dataUrl
  } finally {
    // คืนค่าการเลือกกลับมาตามเดิม
    store.setSelectedWidgetId(originalSelectedWidgetId)
    store.setSelectedLabelId(originalSelectedLabelId)
  }
}

/**
 * ดึงเฉพาะรูปแผนที่พร้อมป้ายกำกับ โดยไม่เอาพื้นหลัง (โปร่งใส)
 */
export async function exportOnlyMapAsImage(scale: number = 2): Promise<string> {
  const mapElementId = 'spatio-map-export-wrapper'
  const element = document.getElementById(mapElementId)
  if (!element) throw new Error(`Map wrapper element #${mapElementId} not found`)

  const actualMapEl = document.getElementById('spatio-map')

  const store = useAppStore.getState()
  const originalSelectedWidgetId = store.selectedWidgetId
  const originalSelectedLabelId = store.selectedLabelId

  // ปิดกรอบการเลือกชั่วคราวเพื่อซ่อนกรอบสีน้ำเงิน/ปุ่มรีไซส์
  store.setSelectedWidgetId(null)
  store.setSelectedLabelId(null)

  // รอให้ font โหลดเสร็จก่อน
  await waitForFonts()

  // ซ่อนแผนที่ฐาน (Base Map Tiles) ชั่วคราวเพื่อไม่ให้ติดสีดำ/ถนน/ดาวเทียมในรูปผลลัพธ์
  updateBaseMapVisibility(false)

  // เพิ่ม class สำหรับซ่อนพื้นหลังและเงาของแผนที่เพื่อความโปร่งใสแบบไม่มีขอบตัด
  element.classList.add('export-transparent-bg')
  if (actualMapEl) {
    actualMapEl.classList.add('export-transparent-bg')
  }

  try {
    const dataUrl = await domToPng(element, {
      scale: scale,
      backgroundColor: 'transparent',
      filter: createExportFilter,
      style: {
        fontFamily: "'Inter', 'Noto Sans Thai', 'Leelawadee UI', Tahoma, sans-serif",
      },
    })
    return dataUrl
  } finally {
    // เอา class ออกเพื่อคืนค่าเดิม
    element.classList.remove('export-transparent-bg')
    if (actualMapEl) {
      actualMapEl.classList.remove('export-transparent-bg')
    }
    // คืนค่าการแสดงผลแผนที่ฐานตามเดิมที่ผู้ใช้ตั้งไว้
    updateBaseMapVisibility(store.showBaseMap)
    // คืนค่าการเลือกกลับมาตามเดิม
    store.setSelectedWidgetId(originalSelectedWidgetId)
    store.setSelectedLabelId(originalSelectedLabelId)
  }
}


export type VideoResolution = 'original' | '720p' | '1080p' | '2k' | '4k'

/** ขีดสูงสุดของ frames ที่เก็บใน memory พร้อมกัน (ป้องกัน OOM crash) */
export const MAX_VIDEO_FRAMES = 120

/** ประมาณ RAM ที่ใช้ต่อ frame ในแต่ละ resolution (MB) */
const APPROX_MB_PER_FRAME: Record<VideoResolution, number> = {
  original: 8,
  '720p': 6,
  '1080p': 12,
  '2k': 22,
  '4k': 50,
}

export interface ExportVideoOptions {
  mapElementId: string
  fps?: number
  stepDurationMs?: number
  resolution?: VideoResolution
  startStepIndex?: number
  endStepIndex?: number
  onProgress?: (current: number, total: number, phase: 'capture' | 'record') => void
  onMemoryWarning?: (estimatedMB: number) => void
}

export interface ExportVideoResult {
  blob: Blob
  filenameExtension: string
}

/**
 * Plays through the timeline step-by-step from startStepIndex to endStepIndex,
 * captures each frame at the requested resolution, and compiles them into a
 * video Blob (MP4 or WebM depending on browser support).
 * 
 * Uses a two-phase architecture to guarantee 100% smoothness and eliminate black frames:
 * - Phase 1: Pre-capture all frames offline into memory (as fully rendered canvas elements).
 * - Phase 2: Start recorder and draw images instantly at precise clock intervals.
 */
export async function exportTimelineAsVideo(options: ExportVideoOptions): Promise<ExportVideoResult> {
  const {
    mapElementId,
    fps = 2,
    stepDurationMs = 800,
    resolution = '1080p',
    startStepIndex = 0,
    endStepIndex,
    onProgress,
    onMemoryWarning
  } = options

  const element = document.getElementById(mapElementId)
  if (!element) throw new Error(`Map element #${mapElementId} not found`)

  // ── Browser Compatibility Check ──
  const isFirefox = /Firefox\/[\d.]+/.test(navigator.userAgent)
  if (isFirefox) {
    console.warn('[VideoExport] Firefox detected — MP4/H.264 video export may have limited support. Chrome or Edge is recommended for best results.')
  }

  if (!window.MediaRecorder) {
    throw new Error('browser ของคุณไม่รองรับการส่งออกวิดีโอ กรุณาใช้ Chrome หรือ Edge เวอร์ชันล่าสุด')
  }

  const store = useAppStore.getState()
  const totalSteps = store.periods.length
  if (totalSteps === 0) throw new Error('ไม่มีข้อมูลไทม์ไลน์ที่จะบันทึก')

  // Validate step indices
  const startIdx = Math.max(0, Math.min(startStepIndex, totalSteps - 1))
  const endIdx = Math.max(startIdx, Math.min(endStepIndex ?? (totalSteps - 1), totalSteps - 1))
  const stepsToRecord = endIdx - startIdx + 1

  // ── Frame Limit Guard ──
  if (stepsToRecord > MAX_VIDEO_FRAMES) {
    throw new Error(
      `จำนวน frames (${stepsToRecord}) เกินขีดสูงสุด ${MAX_VIDEO_FRAMES} frames\n` +
      `กรุณาลดช่วงเวลาที่ export หรือใช้ resolution ต่ำกว่า\n` +
      `(เลือก start/end step ให้ห่างกันไม่เกิน ${MAX_VIDEO_FRAMES} ช่วง)`
    )
  }

  // ── Memory Estimation Warning ──
  const approxMB = stepsToRecord * (APPROX_MB_PER_FRAME[resolution] ?? 12)
  if (approxMB > 500 && onMemoryWarning) {
    onMemoryWarning(approxMB)
  }

  // Save current playback state so we can restore it later
  const wasPlaying = store.isPlaying
  const originalStep = store.currentStep
  const originalSelectedWidgetId = store.selectedWidgetId
  const originalSelectedLabelId = store.selectedLabelId

  // Pause live playback
  store.setIsPlaying(false)

  // ปิดกรอบการเลือกชั่วคราวเพื่อซ่อนกรอบสีน้ำเงิน/ปุ่มรีไซส์ในวิดีโอ
  store.setSelectedWidgetId(null)
  store.setSelectedLabelId(null)

  // Get map dimensions
  const rect = element.getBoundingClientRect()

  // Calculate scale factor based on target resolution height
  let scale = 1
  if (resolution === '720p') {
    scale = 720 / rect.height
  } else if (resolution === '1080p') {
    scale = 1080 / rect.height
  } else if (resolution === '2k') {
    scale = 1440 / rect.height
  } else if (resolution === '4k') {
    scale = 2160 / rect.height
  }

  const targetWidth = Math.round(rect.width * scale)
  const targetHeight = Math.round(rect.height * scale)

  // รอให้ font โหลดเสร็จก่อนเริ่ม capture
  await waitForFonts()

  // ==========================================
  // PHASE 1: Pre-capture all frames offline
  // ==========================================
  const capturedFrames: HTMLCanvasElement[] = []

  try {
    for (let i = startIdx; i <= endIdx; i++) {
      // Update state to render this step in the background
      store.setCurrentStep(i)
      const currentProgress = i - startIdx + 1
      if (onProgress) onProgress(currentProgress, stepsToRecord, 'capture')

      // Wait for React re-render & Leaflet layer updates
      await new Promise((resolve) => setTimeout(resolve, stepDurationMs))

      // Capture map container using modern-screenshot (domToCanvas) at scale
      const capturedCanvas = await domToCanvas(element, {
        scale: scale,
        backgroundColor: '#0f172a',
        filter: createExportFilter,
        style: {
          fontFamily: "'Inter', 'Noto Sans Thai', 'Leelawadee UI', Tahoma, sans-serif",
        },
      })

      capturedFrames.push(capturedCanvas)
    }
  } catch (err) {
    // Restore original state
    store.setCurrentStep(originalStep)
    if (wasPlaying) store.setIsPlaying(true)
    throw err
  }

  // ==========================================
  // PHASE 2: Record frames at precise intervals
  // ==========================================
  const recordingCanvas = document.createElement('canvas')
  recordingCanvas.width = targetWidth
  recordingCanvas.height = targetHeight
  const ctx = recordingCanvas.getContext('2d')
  if (!ctx) throw new Error('ไม่สามารถสร้าง Canvas Context 2D ได้')

  // Draw first frame immediately to avoid black screen startup
  if (capturedFrames.length > 0) {
    ctx.drawImage(capturedFrames[0], 0, 0, targetWidth, targetHeight)
  } else {
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, targetWidth, targetHeight)
  }

  // Capture stream from canvas
  const stream = recordingCanvas.captureStream(fps)

  // Choose the best supported MIME type in order of priority (H.264 MP4 first, then WebM with H.264)
  const mimeTypes = [
    'video/mp4;codecs=avc1.4d401f', // H.264 Main Profile in MP4 container
    'video/mp4;codecs=avc1',        // H.264 in MP4
    'video/mp4;codecs=h264',        // H.264 in MP4
    'video/mp4',                    // MP4 generic
    'video/webm;codecs=h264',       // H.264 in WebM (Highly compatible when renamed to .mp4)
    'video/webm;codecs=vp9',        // VP9 in WebM
    'video/webm;codecs=vp8',        // VP8 in WebM
    'video/webm'                    // WebM generic
  ]

  let mimeType = ''
  for (const type of mimeTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      mimeType = type
      break
    }
  }

  const recordedChunks: Blob[] = []
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data)
    }
  }

  const recordPromise = new Promise<ExportVideoResult>((resolve, reject) => {
    recorder.onstop = () => {
      const isMp4 = mimeType.includes('video/mp4')
      const blob = new Blob(recordedChunks, { type: recordedChunks[0]?.type || (isMp4 ? 'video/mp4' : 'video/webm') })

      // Clear recording canvas memory
      recordingCanvas.width = 0
      recordingCanvas.height = 0

      resolve({
        blob,
        filenameExtension: 'mp4' // Force .mp4 extension for universal compatibility
      })
    }
    recorder.onerror = (e) => reject((e as any).error || e)
  })

  // Start recording
  recorder.start()

  // Time in milliseconds each frame should remain on screen
  const frameDurationMs = 1000 / fps

  try {
    for (let i = 0; i < capturedFrames.length; i++) {
      if (onProgress) onProgress(i + 1, capturedFrames.length, 'record')

      // Draw the pre-captured canvas frame instantly
      ctx.drawImage(capturedFrames[i], 0, 0, targetWidth, targetHeight)

      // Clear memory of the frame canvas immediately
      capturedFrames[i].width = 0
      capturedFrames[i].height = 0

      // Wait exactly for the frame duration so the stream recorder grabs it
      await new Promise((resolve) => setTimeout(resolve, frameDurationMs))
    }
  } catch (err) {
    recorder.stop()
    // Restore original state
    store.setCurrentStep(originalStep)
    if (wasPlaying) store.setIsPlaying(true)
    store.setSelectedWidgetId(originalSelectedWidgetId)
    store.setSelectedLabelId(originalSelectedLabelId)
    throw err
  } finally {
    // In case of error/interruption, ensure all canvases are cleared
    for (const canvas of capturedFrames) {
      canvas.width = 0
      canvas.height = 0
    }
  }

  // Small extra buffer delay to ensure the last frame is committed to the stream
  await new Promise((resolve) => setTimeout(resolve, 100))

  // Stop recording
  recorder.stop()

  // Restore original state
  store.setCurrentStep(originalStep)
  if (wasPlaying) store.setIsPlaying(true)
  store.setSelectedWidgetId(originalSelectedWidgetId)
  store.setSelectedLabelId(originalSelectedLabelId)

  return recordPromise
}
