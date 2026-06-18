import { useState } from "react"
import type { VNProject } from "../types"
import { buildPrintableHtml, openPrintWindow } from "../utils/exportPdfHtml"
import { exportRenpy } from "../utils/exportRenpy"

type ExportPanelProps = {
  project: VNProject
  onExportHeadingsChange: (enabled: boolean) => void
}

const TEXT = {
  headings: "导出标题注释",
  includeHeadings: "包含标题",
  includeNotes: "包含备注",
  copyRenpy: "复制 Ren'Py",
  downloadRenpy: "下载 .rpy.txt",
  openPdf: "打开 PDF 阅读稿",
  downloadHtml: "下载 HTML 阅读稿",
  copied: "已复制",
  copyFailed: "复制失败",
  downloaded: "下载已生成",
  previewOpened: "已打开阅读稿预览页。",
  popupBlocked: "浏览器阻止了新窗口，请允许弹出窗口后重试。"
}

function buildDownloadName(title: string, suffix: string) {
  const normalizedTitle = title.trim().replace(/[\\/:*?"<>|]+/g, "_")
  return `${normalizedTitle || "script_export"}${suffix}`
}

function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function ExportPanel({ project, onExportHeadingsChange }: ExportPanelProps) {
  const [includePdfHeadings, setIncludePdfHeadings] = useState(true)
  const [includePdfNotes, setIncludePdfNotes] = useState(true)
  const [renpyStatus, setRenpyStatus] = useState("")
  const [pdfStatus, setPdfStatus] = useState("")

  const buildRenpyOutput = () =>
    exportRenpy(project, {
      exportHeadings: project.settings.exportHeadings,
      includeBlankLinesAroundHeadings: false
    })

  const handleCopyRenpy = async () => {
    try {
      await navigator.clipboard.writeText(buildRenpyOutput())
      setRenpyStatus(TEXT.copied)
    } catch {
      setRenpyStatus(TEXT.copyFailed)
    }
  }

  const handleDownloadRenpy = () => {
    downloadTextFile(
      buildRenpyOutput(),
      buildDownloadName(project.title, ".rpy.txt"),
      "text/plain;charset=utf-8"
    )
    setRenpyStatus(TEXT.downloaded)
  }

  const handleOpenPdfPreview = () => {
    const didOpen = openPrintWindow(project, {
      includeHeadings: includePdfHeadings,
      includeNotes: includePdfNotes
    })

    setPdfStatus(didOpen ? TEXT.previewOpened : TEXT.popupBlocked)
  }

  const handleDownloadHtmlPreview = () => {
    downloadTextFile(
      buildPrintableHtml(project, {
        includeHeadings: includePdfHeadings,
        includeNotes: includePdfNotes
      }),
      "script_preview.html",
      "text/html;charset=utf-8"
    )
    setPdfStatus(TEXT.downloaded)
  }

  return (
    <div className="export-panel">
      <div className="export-group">
        <label className="panel-field">
          <span className="panel-field-label">{TEXT.headings}</span>
          <input
            type="checkbox"
            checked={project.settings.exportHeadings}
            onChange={(event) => onExportHeadingsChange(event.target.checked)}
          />
        </label>

        <div className="panel-actions">
          <button type="button" onClick={handleCopyRenpy}>
            {TEXT.copyRenpy}
          </button>
          <button type="button" onClick={handleDownloadRenpy}>
            {TEXT.downloadRenpy}
          </button>
        </div>

        <div className="export-status">{renpyStatus || " "}</div>
      </div>

      <div className="export-group">
        <label className="panel-field">
          <span className="panel-field-label">{TEXT.includeHeadings}</span>
          <input
            type="checkbox"
            checked={includePdfHeadings}
            onChange={(event) => setIncludePdfHeadings(event.target.checked)}
          />
        </label>

        <label className="panel-field">
          <span className="panel-field-label">{TEXT.includeNotes}</span>
          <input
            type="checkbox"
            checked={includePdfNotes}
            onChange={(event) => setIncludePdfNotes(event.target.checked)}
          />
        </label>

        <div className="panel-actions">
          <button type="button" onClick={handleOpenPdfPreview}>
            {TEXT.openPdf}
          </button>
          <button type="button" onClick={handleDownloadHtmlPreview}>
            {TEXT.downloadHtml}
          </button>
        </div>

        <div className="export-status">{pdfStatus || " "}</div>
      </div>
    </div>
  )
}
