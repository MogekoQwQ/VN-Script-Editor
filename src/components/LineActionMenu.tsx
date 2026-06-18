import { useEffect, useRef, useState } from "react"

type LineActionMenuProps = {
  canMoveUp: boolean
  canMoveDown: boolean
  canPasteLine: boolean
  onInsertBelow: () => void
  onCutLine: () => void
  onCopyLine: () => void
  onPasteLine: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDeleteLine: () => void
}

const TEXT = {
  title: "\u884c\u64cd\u4f5c",
  menu: "\u22ef",
  insert: "\u5728\u4e0b\u65b9\u63d2\u5165\u884c",
  insertShortcut: "Enter",
  cut: "\u526a\u5207\u884c",
  copy: "\u590d\u5236\u884c",
  paste: "\u7c98\u8d34\u884c",
  moveUp: "\u4e0a\u79fb\u884c",
  moveDown: "\u4e0b\u79fb\u884c",
  delete: "\u5220\u9664\u884c"
}

export function LineActionMenu({
  canMoveUp,
  canMoveDown,
  canPasteLine,
  onInsertBelow,
  onCutLine,
  onCopyLine,
  onPasteLine,
  onMoveUp,
  onMoveDown,
  onDeleteLine
}: LineActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen])

  const closeAndRun = (action: () => void) => {
    action()
    setIsOpen(false)
  }

  return (
    <div ref={menuRef} className="line-action-menu">
      <button
        type="button"
        className="line-action-trigger"
        title={TEXT.title}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        {TEXT.menu}
      </button>

      {isOpen ? (
        <div className="line-action-popup" role="menu">
          <button type="button" role="menuitem" onClick={() => closeAndRun(onInsertBelow)}>
            <span>{TEXT.insert}</span>
            <span className="line-action-shortcut">{TEXT.insertShortcut}</span>
          </button>
          <button type="button" role="menuitem" onClick={() => closeAndRun(onCutLine)}>
            <span>{TEXT.cut}</span>
          </button>
          <button type="button" role="menuitem" onClick={() => closeAndRun(onCopyLine)}>
            <span>{TEXT.copy}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => closeAndRun(onPasteLine)}
            disabled={!canPasteLine}
          >
            <span>{TEXT.paste}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => closeAndRun(onMoveUp)}
            disabled={!canMoveUp}
          >
            <span>{TEXT.moveUp}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => closeAndRun(onMoveDown)}
            disabled={!canMoveDown}
          >
            <span>{TEXT.moveDown}</span>
          </button>
          <button type="button" role="menuitem" onClick={() => closeAndRun(onDeleteLine)}>
            <span>{TEXT.delete}</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
