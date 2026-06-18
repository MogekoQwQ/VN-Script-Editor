import { useRef, type ChangeEvent } from "react"

type SavePanelProps = {
  statusText: string
  onExportProjectFile: () => void
  onImportProjectFile: (file: File) => void | Promise<void>
  onCreateBlankProject: () => void
  onResetToDefaultProject: () => void
  onClearLocalProject: () => void
}

const TEXT = {
  status: "\u4fdd\u5b58\u72b6\u6001",
  export: "\u5bfc\u51fa\u9879\u76ee\u6587\u4ef6",
  import: "\u5bfc\u5165\u9879\u76ee\u6587\u4ef6",
  insertPlainText: "从纯文本插入",
  blank: "\u65b0\u5efa\u7a7a\u767d\u9879\u76ee",
  reset: "\u91cd\u7f6e\u4e3a\u793a\u4f8b\u9879\u76ee",
  clear: "\u6e05\u9664\u672c\u5730\u81ea\u52a8\u4fdd\u5b58"
}

export function SavePanel({
  statusText,
  onExportProjectFile,
  onImportProjectFile,
  onCreateBlankProject,
  onResetToDefaultProject,
  onClearLocalProject
}: SavePanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    await onImportProjectFile(file)
    event.target.value = ""
  }

  return (
    <div className="save-panel">
      <div className="stats-list">
        <div className="stats-row">
          <span>{TEXT.status}</span>
          <strong className="stats-value save-status-text">{statusText}</strong>
        </div>
      </div>

      <div className="panel-actions">
        <button type="button" onClick={onExportProjectFile}>
          {TEXT.export}
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          {TEXT.import}
        </button>
        <button type="button" onClick={onClearLocalProject}>
          {TEXT.clear}
        </button>
        <button type="button" onClick={onResetToDefaultProject}>
          {TEXT.reset}
        </button>
        <button type="button" onClick={onCreateBlankProject}>
          {TEXT.blank}
        </button>
      </div>

      <input
        ref={fileInputRef}
        className="panel-file-input"
        type="file"
        accept=".json,.vns.json,application/json"
        onChange={handleFileChange}
      />
    </div>
  )
}
