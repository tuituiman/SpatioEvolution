/**
 * MappingModal/index.tsx — Thin orchestrator shell
 * ประกอบร่างจาก 4 sub-components + 1 custom hook
 */
import React from 'react'
import { Sparkles, X } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useMappingState } from './hooks/useMappingState'
import { UploadTab } from './UploadTab'
import { ColumnMappingTab } from './ColumnMappingTab'
import { ExportDialog } from './ExportDialog'
import { PreviewLightbox } from './PreviewLightbox'

export const MappingModal: React.FC = () => {
  const { isMappingOpen, setIsMappingOpen, mappingModalTab } = useAppStore()
  const state = useMappingState()

  if (!isMappingOpen) return null

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col h-[85vh] overflow-hidden relative">

        {/* ── Modal Header ── */}
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-start">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Sparkles className="text-blue-400" size={18} />
              <span>ศูนย์นำเข้าและจัดการข้อมูลระบาดวิทยา (Ingestion Hub)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {mappingModalTab === 'upload'
                ? 'เลือกรูปแบบไฟล์ Excel/CSV ที่เตรียมไว้เพื่อเข้าสู่ระบบพล็อตสีและจัดกลุ่มช่วงเวลา'
                : 'ตั้งค่าคอลัมน์จากตารางของคุณเพื่อจับคู่กับขอบเขตแผนที่ระดับ จังหวัด/อำเภอ/ตำบล'}
            </p>
          </div>
          <button
            onClick={() => setIsMappingOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors self-center"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Modal Body ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {mappingModalTab === 'upload' ? (
            <UploadTab
              handleFileDrop={state.handleFileDrop}
              handleFileChange={state.handleFileChange}
              setPreviewType={state.setPreviewType}
            />
          ) : (
            <ColumnMappingTab
              fileName={state.fileName}
              localColumns={state.localColumns}
              localRows={state.localRows}
              activeFlow={state.activeFlow}
              dynamicLayout={state.dynamicLayout}
              setDynamicLayout={state.setDynamicLayout}
              geoMode={state.geoMode}
              setGeoMode={state.setGeoMode}
              mapping={state.mapping}
              setMapping={state.setMapping}
              useDist={state.useDist}
              setUseDist={state.setUseDist}
              useSub={state.useSub}
              setUseSub={state.setUseSub}
              useVal={state.useVal}
              setUseVal={state.setUseVal}
              useColor={state.useColor}
              setUseColor={state.setUseColor}
              resetUpload={state.resetUpload}
              handleLoadToMap={state.handleLoadToMap}
              setIsExportOpen={state.setIsExportOpen}
            />
          )}
        </div>
      </div>

      {/* ── Export Dialog overlay ── */}
      {state.isExportOpen && (
        <ExportDialog
          exportTimeMode={state.exportTimeMode}
          setExportTimeMode={state.setExportTimeMode}
          exportAdminFormat={state.exportAdminFormat}
          setExportAdminFormat={state.setExportAdminFormat}
          exportLayoutFormat={state.exportLayoutFormat}
          setExportLayoutFormat={state.setExportLayoutFormat}
          isExporting={state.isExporting}
          onExport={state.handleExportLineListing}
          onClose={() => state.setIsExportOpen(false)}
        />
      )}

      {/* ── Preview Lightbox ── */}
      {state.previewType !== null && (
        <PreviewLightbox
          previewType={state.previewType}
          onClose={() => state.setPreviewType(null)}
          onSwitchFormat={
            (state.previewType === 'dynamic_wide' || state.previewType === 'dynamic_long')
              ? (t) => state.setPreviewType(t)
              : undefined
          }
        />
      )}
    </div>
  )
}
