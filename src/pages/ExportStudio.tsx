import React, { useState, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useTranslation } from '../hooks/useTranslation'
import { WidgetInspectorPanel } from '../components/inspector/WidgetInspectorPanel'
import { exportMapAsImage, exportOnlyMapAsImage, exportTimelineAsVideo, type VideoResolution } from '../core/mapExporter'
import { updateBaseMapVisibility } from '../map/mapController'
import {
  Image as ImageIcon,
  Video as VideoIcon,
  Download,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Settings,
  X,
  Plus,
  Copy
} from 'lucide-react'

export function ExportStudio() {
  const store = useAppStore()
  const { t, language } = useTranslation()
  const {
    isWidgetInspectorOpen,
    setIsWidgetInspectorOpen,
    showBaseMap,
    periods,
    notify,
    selectedWidgetId,
    setSelectedWidgetId,
    canvasWidgets,
    loadCanvasTemplate
  } = store

  // Image export resolution
  const [imgScale, setImgScale] = useState<number>(2) // Default 2x for HD
  const [isExportingImage, setIsExportingImage] = useState(false)
  const [imageExportSuccess, setImageExportSuccess] = useState(false)
  const [isExportingTransparent, setIsExportingTransparent] = useState(false)
  const [isCopyingTransparent, setIsCopyingTransparent] = useState(false)
  const [transparentExportSuccess, setTransparentExportSuccess] = useState(false)

  // Video export parameters
  const [videoResolution, setVideoResolution] = useState<VideoResolution>('1080p')
  const [startStepIndex, setStartStepIndex] = useState<number>(0)
  const [endStepIndex, setEndStepIndex] = useState<number>(periods.length > 0 ? periods.length - 1 : 0)
  const [localSpeedPreset, setLocalSpeedPreset] = useState<'slow' | 'normal' | 'fast' | 'very-fast'>('normal')
  const [isRecordingVideo, setIsRecordingVideo] = useState(false)
  const [videoProgress, setVideoProgress] = useState<{ current: number; total: number; phase: 'capture' | 'record' } | null>(null)
  const [videoExportSuccess, setVideoExportSuccess] = useState(false)
  const [lastSavedFormat, setLastSavedFormat] = useState<string>('')

  // Export Settings Panel State
  const [isExportPanelOpen, setIsExportPanelOpen] = useState(false)
  const [exportTab, setExportTab] = useState<'image' | 'video'>('image')

  // Map visibility effect
  useEffect(() => {
    if (store.mapReady) {
      updateBaseMapVisibility(showBaseMap)
    }
  }, [store.mapReady, showBaseMap])

  // Default to empty canvas, user can click presets to load templates

  // Get FPS and step delays for speed presets
  const getSpeedSettings = (preset: 'slow' | 'normal' | 'fast' | 'very-fast') => {
    switch (preset) {
      case 'slow':
        return { stepDurationMs: 1200, fps: 1 }
      case 'fast':
        return { stepDurationMs: 500, fps: 3 }
      case 'very-fast':
        return { stepDurationMs: 300, fps: 5 }
      case 'normal':
      default:
        return { stepDurationMs: 800, fps: 2 }
    }
  }

  // Handle PNG image download
  const handleExportImage = async () => {
    setIsExportingImage(true)
    setImageExportSuccess(false)
    try {
      const activePeriod = periods.length > 0 ? periods[store.currentStep] : null
      const dataUrl = await exportMapAsImage('spatio-capture-area', imgScale)

      const link = document.createElement('a')
      link.download = `SpatioMap_${activePeriod ? activePeriod.label.replace(/\s+/g, '_') : 'Capture'}_${store.adminLevel}_${imgScale}x.png`
      link.href = dataUrl
      link.click()

      setImageExportSuccess(true)
      notify('success', 'ดาวน์โหลดรูปแผนที่สำเร็จ!')
    } catch (err: any) {
      console.error(err)
      notify('error', `ไม่สามารถส่งออกรูปแผนที่ได้: ${err.message || err}`)
    } finally {
      setIsExportingImage(false)
    }
  }

  // Handle PNG transparent image download (map only)
  const handleExportTransparentImage = async () => {
    setIsExportingTransparent(true)
    setTransparentExportSuccess(false)
    try {
      const activePeriod = periods.length > 0 ? periods[store.currentStep] : null
      const dataUrl = await exportOnlyMapAsImage(imgScale)

      const link = document.createElement('a')
      link.download = `SpatioMap_Only_${activePeriod ? activePeriod.label.replace(/\s+/g, '_') : 'Capture'}_${store.adminLevel}_${imgScale}x.png`
      link.href = dataUrl
      link.click()

      setTransparentExportSuccess(true)
      notify('success', 'ดาวน์โหลดรูปแผนที่แบบไม่มีพื้นหลังสำเร็จ!')
    } catch (err: any) {
      console.error(err)
      notify('error', `ไม่สามารถส่งออกแผนที่ได้: ${err.message || err}`)
    } finally {
      setIsExportingTransparent(false)
    }
  }

  // Handle PNG transparent image copy to clipboard
  const handleCopyTransparentImage = async () => {
    setIsCopyingTransparent(true)
    try {
      const dataUrl = await exportOnlyMapAsImage(imgScale)

      // แปลง base64 เป็น Blob โดยตรงเพื่อหลีกเลี่ยงนโยบายความปลอดภัย (CSP) หรือข้อจำกัดการ fetch ในเบราว์เซอร์
      const arr = dataUrl.split(',')
      const mimeMatch = arr[0].match(/:(.*?);/)
      const mime = mimeMatch ? mimeMatch[1] : 'image/png'
      const bstr = atob(arr[1])
      let n = bstr.length
      const u8arr = new Uint8Array(n)
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n)
      }
      const blob = new Blob([u8arr], { type: mime })

      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ])
      notify('success', 'คัดลอกรูปแผนที่โปร่งใสไปยัง Clipboard สำเร็จ!')
    } catch (err: any) {
      console.error(err)
      notify('error', `ไม่สามารถคัดลอกรูปแผนที่ได้: ${err.message || err}`)
    } finally {
      setIsCopyingTransparent(false)
    }
  }

  // Handle Video timeline recording
  const handleExportVideo = async () => {
    if (startStepIndex > endStepIndex) {
      notify('error', 'ช่วงเริ่มต้นต้องน้อยกว่าช่วงสิ้นสุด')
      return
    }

    setIsRecordingVideo(true)
    setVideoExportSuccess(false)

    const { stepDurationMs, fps } = getSpeedSettings(localSpeedPreset)
    const stepsToRecord = endStepIndex - startStepIndex + 1
    setVideoProgress({ current: 0, total: stepsToRecord, phase: 'capture' })

    try {
      const { blob, filenameExtension } = await exportTimelineAsVideo({
        mapElementId: 'spatio-capture-area',
        fps,
        stepDurationMs,
        resolution: videoResolution,
        startStepIndex,
        endStepIndex,
        onProgress: (current, total, phase) => {
          setVideoProgress({ current, total, phase })
        }
      })

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const startLabel = periods[startStepIndex]?.label.replace(/\s+/g, '_') || 'Start'
      const endLabel = periods[endStepIndex]?.label.replace(/\s+/g, '_') || 'End'
      link.download = `SpatioTimeline_${startLabel}_to_${endLabel}_${videoResolution}.${filenameExtension}`
      link.href = url
      link.click()

      setTimeout(() => URL.revokeObjectURL(url), 1000)

      setLastSavedFormat(filenameExtension.toUpperCase())
      setVideoExportSuccess(true)
      notify('success', `ดาวน์โหลดวิดีโอสำเร็จ (${filenameExtension.toUpperCase()})`)
    } catch (err: any) {
      console.error(err)
      notify('error', `ไม่สามารถบันทึกวิดีโอได้: ${err.message || err}`)
    } finally {
      setIsRecordingVideo(false)
      setVideoProgress(null)
    }
  }

  const goBackToMap = () => {
    if ((window as any).setActivePage) {
      (window as any).setActivePage('explorer')
    }
  }

  return (
    <>
      {/* Top Left: Add Object Button */}
      <button
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          window.dispatchEvent(new CustomEvent('open-canvas-context-menu', {
            detail: { x: rect.left, y: rect.bottom + 10 }
          }))
        }}
        className="absolute top-4 left-4 z-[1300] bg-slate-900/80 backdrop-blur border border-slate-700 text-white p-2 rounded-lg shadow-lg hover:bg-slate-800 transition-colors flex items-center gap-2 font-bold text-sm cursor-pointer"
      >
        <Plus size={16} /> เพิ่ม Object
      </button>

      {/* Top Right: Export Panel Toggle */}
      <button
        onClick={() => setIsExportPanelOpen(!isExportPanelOpen)}
        className="absolute top-4 right-4 z-[1300] bg-indigo-600/90 backdrop-blur border border-indigo-500 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-indigo-500 transition-colors flex items-center gap-2 font-bold text-sm cursor-pointer"
      >
        <Download size={16} /> Export
      </button>

      {/* Export Settings Floating Window */}
      {isExportPanelOpen && (
        <div className="fixed top-16 right-4 z-[1400] w-80 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl overflow-hidden font-sans text-slate-200 animate-fade-in">
          {/* Header */}
          <div className="p-3 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between select-none">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Download size={16} className="text-indigo-400" />
              Export Settings
            </h3>
            <button
              onClick={() => setIsExportPanelOpen(false)}
              className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
            {/* Presets Layout */}
            <div className="flex flex-col gap-1.5 border-b border-slate-800/60 pb-3">
              <span className="text-[11px] font-bold text-slate-400">
                {language === 'th' ? 'เทมเพลตกระดาน (Presets)' : 'Board Layout Presets'}
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => loadCanvasTemplate('standard')}
                  className="px-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded-lg transition-colors border border-slate-700 cursor-pointer text-center text-slate-200"
                >
                  {t('studio_preset_standard')}
                </button>
                <button
                  onClick={() => loadCanvasTemplate('split')}
                  className="px-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded-lg transition-colors border border-slate-700 cursor-pointer text-center text-slate-200"
                >
                  {t('studio_preset_split')}
                </button>
                <button
                  onClick={() => loadCanvasTemplate('blank')}
                  className="px-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded-lg transition-colors border border-slate-700 cursor-pointer text-center text-slate-200"
                >
                  {t('studio_preset_blank')}
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-slate-800 p-1 rounded-lg">
              <button
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-bold rounded-md transition-colors ${exportTab === 'image' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                onClick={() => setExportTab('image')}
              >
                <ImageIcon size={14} /> รูปภาพ (Image)
              </button>
              <button
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-bold rounded-md transition-colors ${exportTab === 'video' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                onClick={() => setExportTab('video')}
              >
                <VideoIcon size={14} /> วิดีโอ (Video)
              </button>
            </div>

            {exportTab === 'image' ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-slate-400">ความละเอียดรูปภาพ</span>
                  <select
                    value={imgScale}
                    onChange={(e) => setImgScale(Number(e.target.value))}
                    className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 py-1.5 text-sm"
                  >
                    <option value={1}>1x (Standard)</option>
                    <option value={2}>2x (High Definition)</option>
                    <option value={3}>3x (Ultra HD - Print)</option>
                    <option value={4}>4x (Maximum Quality)</option>
                  </select>
                </div>

                <button
                  onClick={handleExportImage}
                  disabled={isExportingImage}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-bold rounded-lg text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isExportingImage ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
                  {isExportingImage ? 'กำลังบันทึกภาพ...' : 'ดาวน์โหลดรูปภาพกระดาน'}
                </button>

                {imageExportSuccess && (
                  <div className="text-emerald-400 flex items-center justify-center gap-1.5 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20 text-xs font-bold">
                    <CheckCircle2 size={14} />
                    บันทึกรูปภาพสำเร็จ!
                  </div>
                )}

                {/* ส่วนการเซฟเฉพาะรูปแผนที่ + ป้ายกำกับแบบไม่มีพื้นหลัง */}
                <div className="flex flex-col gap-2 border-t border-slate-800/80 pt-3 mt-1">
                  <span className="text-[11px] font-bold text-slate-400">ส่งออกเฉพาะแผนที่ (ไม่มีพื้นหลัง)</span>
                  <div className="flex gap-2">
                    <button
                      onClick={handleExportTransparentImage}
                      disabled={isExportingTransparent || isCopyingTransparent}
                      className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-700 border border-slate-700 text-slate-200 font-bold rounded-lg text-[11px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      title="ดาวน์โหลดเฉพาะรูปแผนที่ที่มีความโปร่งใสเป็นไฟล์ PNG"
                    >
                      {isExportingTransparent ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} className="text-teal-400" />}
                      {isExportingTransparent ? 'บันทึก...' : 'ดาวน์โหลด PNG'}
                    </button>
                    <button
                      onClick={handleCopyTransparentImage}
                      disabled={isExportingTransparent || isCopyingTransparent}
                      className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-700 border border-slate-700 text-slate-200 font-bold rounded-lg text-[11px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      title="คัดลอกรูปแผนที่โปร่งใสไปยัง Clipboard เพื่อกดวางในโปรแกรมอื่นได้ทันที"
                    >
                      {isCopyingTransparent ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} className="text-blue-400" />}
                      {isCopyingTransparent ? 'คัดลอก...' : 'คัดลอกไปบอร์ด'}
                    </button>
                  </div>
                  {transparentExportSuccess && (
                    <div className="text-emerald-400 flex items-center justify-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 text-[10px] font-bold text-center">
                      <CheckCircle2 size={12} />
                      บันทึกแผนที่โปร่งใสสำเร็จ!
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-slate-400">ความละเอียดวิดีโอ</span>
                  <select
                    value={videoResolution}
                    onChange={(e) => setVideoResolution(e.target.value as VideoResolution)}
                    disabled={isRecordingVideo}
                    className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 py-1.5 text-sm"
                  >
                    <option value="original">Original</option>
                    <option value="720p">720p HD</option>
                    <option value="1080p">1080p Full HD</option>
                    <option value="2k">2K QHD</option>
                    <option value="4k">4K Ultra HD</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-slate-400">ความเร็วการเล่นเฟรม</span>
                  <select
                    value={localSpeedPreset}
                    onChange={(e) => setLocalSpeedPreset(e.target.value as any)}
                    disabled={isRecordingVideo}
                    className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 py-1.5 text-sm"
                  >
                    <option value="slow">🐢 ช้า (1.2s/frame)</option>
                    <option value="normal">🚶 ปกติ (0.8s/frame)</option>
                    <option value="fast">🐇 เร็ว (0.5s/frame)</option>
                    <option value="very-fast">⚡ เร็วมาก (0.3s/frame)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold text-slate-400">เริ่มจากรอบเวลาที่</span>
                    <select
                      value={startStepIndex}
                      onChange={(e) => setStartStepIndex(Number(e.target.value))}
                      disabled={isRecordingVideo}
                      className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 py-1.5 text-xs"
                    >
                      {periods.map((p, idx) => (
                        <option key={p.key} value={idx}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold text-slate-400">ถึงรอบเวลาที่</span>
                    <select
                      value={endStepIndex}
                      onChange={(e) => setEndStepIndex(Number(e.target.value))}
                      disabled={isRecordingVideo}
                      className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 py-1.5 text-xs"
                    >
                      {periods.map((p, idx) => (
                        <option key={p.key} value={idx} disabled={idx < startStepIndex}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {isRecordingVideo && videoProgress && (
                  <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-lg flex flex-col gap-2">
                    <div className="flex justify-between text-xs font-bold text-indigo-400">
                      <span className="flex items-center gap-1.5">
                        <Loader2 size={14} className="animate-spin text-indigo-500" />
                        {videoProgress.phase === 'capture' ? 'Capturing...' : 'Encoding...'}
                      </span>
                      <span>{videoProgress.current} / {videoProgress.total}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 transition-all duration-300"
                        style={{ width: `${(videoProgress.current / videoProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleExportVideo}
                  disabled={isExportingImage || isRecordingVideo || periods.length === 0}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-bold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <VideoIcon size={16} />
                  {t('studio_btn_video_export')}
                </button>

                {videoExportSuccess && (
                  <div className="text-emerald-400 flex items-center justify-center gap-1.5 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20 text-xs font-bold">
                    <CheckCircle2 size={14} />
                    บันทึกวิดีโอสำเร็จ!
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Widget Inspector Panel Floating Window */}
      {isWidgetInspectorOpen && selectedWidgetId && (
        <div className="fixed top-16 left-4 z-[1400] w-80 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl overflow-hidden font-sans text-slate-200 animate-fade-in">
          {/* Header */}
          <div className="p-3 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between select-none">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Settings size={16} className="text-blue-400" />
              ตั้งค่า Object (Inspector)
            </h3>
            <button
              onClick={() => setIsWidgetInspectorOpen(false)}
              className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          {/* Inspector Content */}
          <div className="p-4 max-h-[75vh] overflow-y-auto">
            <WidgetInspectorPanel />
          </div>
        </div>
      )}
    </>
  )
}
