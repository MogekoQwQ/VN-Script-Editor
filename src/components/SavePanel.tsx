import { useRef, type ChangeEvent } from "react"

type SavePanelProps = {
  projectTitle: string
  statusText: string
  onProjectTitleChange: (title: string) => void
  onExportProjectFile: () => void
  onImportProjectFile: (file: File) => void | Promise<void>
  onCreateBlankProject: () => void
  onResetToDefaultProject: () => void
  onClearLocalProject: () => void
}

const TEXT = {
  projectName: "\u9879\u76EE\u540D\u79F0",
  status: "\u4fdd\u5b58\u72b6\u6001",
  export: "导出项目",
  import: "导入项目",
  blank: "新建项目",
  reset: "重置为示例项目"
}

export function SavePanel({
  projectTitle,
  statusText,
  onProjectTitleChange,
  onExportProjectFile,
  onImportProjectFile,
  onCreateBlankProject,
  onResetToDefaultProject
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
      <label className="panel-field">
        <span className="panel-field-label">{TEXT.projectName}</span>
        <input type="text" value={projectTitle} onChange={(event) => onProjectTitleChange(event.target.value)} />
      </label>
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
        <button type="button" onClick={onCreateBlankProject}>
          {TEXT.blank}
        </button>
        <button type="button" onClick={onResetToDefaultProject}>
          {TEXT.reset}
        </button>
      </div>

      <input
        ref={fileInputRef}
        className="panel-file-input"
        type="file"
        accept=".json,.vns,.vns.json,application/json"
        onChange={handleFileChange}
      />
    </div>
  )
}
