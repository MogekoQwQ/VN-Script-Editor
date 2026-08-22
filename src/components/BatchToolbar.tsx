type BatchToolbarProps = {
  focusedCount: number
  onCopy: () => void
  onCut: () => void
  onPasteBelow: () => void
  onDelete: () => void
}

export function BatchToolbar({ focusedCount, onCopy, onCut, onPasteBelow, onDelete }: BatchToolbarProps) {
  if (focusedCount === 0) return null

  return (
    <div className="batch-toolbar" onPointerDown={(event) => event.preventDefault()}>
      <span>
        {focusedCount === 1 ? "\u5f53\u524d\u884c" : `\u5df2\u9009\u4e2d ${focusedCount} \u884c`}
      </span>
      <div className="batch-toolbar-actions">
        <button type="button" tabIndex={-1} onClick={onCut}>{"\u526a\u5207"}</button>
        <button type="button" tabIndex={-1} onClick={onCopy}>{"\u590d\u5236"}</button>
        <button type="button" tabIndex={-1} onClick={onPasteBelow}>{"\u5728\u4e0b\u65b9\u7c98\u8d34"}</button>
        <button type="button" tabIndex={-1} onClick={onDelete}>{"\u5220\u9664"}</button>
      </div>
    </div>
  )
}
