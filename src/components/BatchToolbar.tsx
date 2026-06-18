type BatchToolbarProps = {
  selectionMode: boolean
  selectedCount: number
  clipboardCount: number
  canPaste: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onCopy: () => void
  onCut: () => void
  onPaste: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onClear: () => void
  onExit: () => void
}

export function BatchToolbar({
  selectionMode,
  selectedCount,
  clipboardCount,
  canPaste,
  canMoveUp,
  canMoveDown,
  onCopy,
  onCut,
  onPaste,
  onDelete,
  onMoveUp,
  onMoveDown,
  onClear,
  onExit
}: BatchToolbarProps) {
  if (!selectionMode) {
    return null
  }

  const hasSelection = selectedCount > 0

  return (
    <div className="batch-toolbar">
      <span>
        已选中 {selectedCount} 行
        {clipboardCount > 0 ? ` · 剪贴板 ${clipboardCount} 行` : ""}
      </span>

      <div className="batch-toolbar-actions">
        <button type="button" onClick={onCopy} disabled={!hasSelection}>
          复制
        </button>
        <button type="button" onClick={onCut} disabled={!hasSelection}>
          剪切
        </button>
        <button type="button" onClick={onPaste} disabled={!canPaste}>
          粘贴
        </button>
        <button type="button" onClick={onDelete} disabled={!hasSelection}>
          删除
        </button>
        <button type="button" onClick={onMoveUp} disabled={!canMoveUp}>
          上移
        </button>
        <button type="button" onClick={onMoveDown} disabled={!canMoveDown}>
          下移
        </button>
        <button type="button" onClick={onClear} disabled={!hasSelection}>
          清除选择
        </button>
        <button type="button" onClick={onExit}>
          退出选择
        </button>
      </div>
    </div>
  )
}
