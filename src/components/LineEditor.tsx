import { memo, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type Ref } from "react"
import type { ScriptLine } from "../types"
import { getHeadingLevel, isNarrationSpeaker, isNoteSpeaker } from "../utils/lineTypes"
import type { FocusField } from "./Editor"
import { LineActionMenu } from "./LineActionMenu"
import { SpeakerAutocomplete } from "./SpeakerAutocomplete"

type SpeakerOption = {
  displayName: string
  id: string
}

type SelectionModifiers = {
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}

type LineEditorProps = {
  line: ScriptLine
  speakerColor?: string
  speakerOptions: SpeakerOption[]
  readingWrapChars: number
  editorFontSize: number
  selectionMode: boolean
  layoutVersion: number
  onSpeakerChange: (lineId: string, speaker: string) => void
  onSpeakerCommit: (lineId: string) => void
  onContentChange: (lineId: string, content: string) => void
  onBeginTextEdit: () => void
  onEndTextEdit: () => void
  onFocusLine: (lineId: string) => void
  onInsertBelow: (lineId: string, focusField: FocusField, source?: ScriptLine | null) => void
  onDelete: (lineId: string) => void
  onCut: (lineId: string) => void
  onCopy: (lineId: string) => void
  onPaste: (lineId: string) => void
  onMove: (lineId: string, direction: -1 | 1) => void
  onEnterSelectionMode: (lineId: string) => void
  onToggleSelect: (lineId: string, modifiers: SelectionModifiers) => void
  isActive: boolean
  isSearchCurrent: boolean
  isDimmed: boolean
  isSelected: boolean
  canPaste: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  containerRef?: Ref<HTMLDivElement>
  speakerInputRef?: Ref<HTMLInputElement>
  contentInputRef?: Ref<HTMLTextAreaElement>
}

function getLineVariant(speaker: string) {
  const headingLevel = getHeadingLevel(speaker)

  if (headingLevel) {
    return `heading-${headingLevel}`
  }

  if (isNoteSpeaker(speaker)) {
    return "note"
  }

  if (isNarrationSpeaker(speaker)) {
    return "narration"
  }

  return "dialogue"
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) {
    return
  }

  if (typeof ref === "function") {
    ref(value)
    return
  }

  ;(ref as { current: T | null }).current = value
}

function resizeTextarea(element: HTMLTextAreaElement | null) {
  if (!element) {
    return
  }

  element.style.height = "0px"
  element.style.height = `${element.scrollHeight}px`
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase()
}

function clearNativeTextSelection() {
  const selection = window.getSelection()

  if (selection) {
    selection.removeAllRanges()
  }
}

function LineEditorComponent({
  line,
  speakerColor,
  speakerOptions,
  readingWrapChars,
  editorFontSize,
  selectionMode,
  layoutVersion,
  onSpeakerChange,
  onSpeakerCommit,
  onContentChange,
  onBeginTextEdit,
  onEndTextEdit,
  onFocusLine,
  onInsertBelow,
  onDelete,
  onCut,
  onCopy,
  onPaste,
  onMove,
  onEnterSelectionMode,
  onToggleSelect,
  isActive,
  isSearchCurrent,
  isDimmed,
  isSelected,
  canPaste,
  canMoveUp,
  canMoveDown,
  containerRef,
  speakerInputRef,
  contentInputRef
}: LineEditorProps) {
  const [isSpeakerFocused, setIsSpeakerFocused] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false)
  const contentElementRef = useRef<HTMLTextAreaElement | null>(null)
  const variant = getLineVariant(line.speaker)

  const filteredSpeakerOptions = useMemo(() => {
    const query = normalizeSearchValue(line.speaker)

    if (!query) {
      return []
    }

    return speakerOptions.filter((option) => {
      const displayName = normalizeSearchValue(option.displayName)
      const exportId = option.id.toLowerCase()
      return displayName.includes(query) || exportId.includes(query)
    })
  }, [line.speaker, speakerOptions])

  useLayoutEffect(() => {
    resizeTextarea(contentElementRef.current)
  }, [
    line.content,
    selectionMode,
    readingWrapChars,
    editorFontSize,
    isActive,
    isSelected,
    layoutVersion
  ])

  useLayoutEffect(() => {
    const element = contentElementRef.current

    if (!element || typeof ResizeObserver === "undefined") {
      return
    }

    const observer = new ResizeObserver(() => {
      resizeTextarea(element)
    })

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [])

  useLayoutEffect(() => {
    if (selectionMode) {
      return
    }

    const handleResize = () => {
      resizeTextarea(contentElementRef.current)
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [selectionMode])

  useLayoutEffect(() => {
    if (highlightedIndex >= filteredSpeakerOptions.length) {
      setHighlightedIndex(0)
    }
  }, [filteredSpeakerOptions.length, highlightedIndex])

  const applySpeakerOption = (displayName: string) => {
    onSpeakerChange(line.id, displayName)
    setIsAutocompleteOpen(false)
    setHighlightedIndex(0)
  }

  const handleSpeakerCommit = () => {
    onSpeakerCommit(line.id)
    onEndTextEdit()
  }

  const handleSelectionFocus = (event: MouseEvent<HTMLElement>) => {
    if (!selectionMode) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    onFocusLine(line.id)
  }

  const handleSelectionContainerMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (!selectionMode) {
      return
    }

    const target = event.target as HTMLElement

    if (target.closest(".line-selector") || target.closest(".line-actions")) {
      return
    }

    event.stopPropagation()
    onFocusLine(line.id)
  }

  return (
    <div
      ref={containerRef}
      className={[
        "line-editor",
        `line-${variant}`,
        isActive ? "is-active" : "",
        isSearchCurrent ? "is-search-current" : "",
        isSelected ? "is-selected" : "",
        isDimmed ? "is-dimmed" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      onMouseDown={handleSelectionContainerMouseDown}
      onDoubleClick={(event) => {
        const target = event.target as HTMLElement

        if (target.closest(".line-actions") || target.closest(".line-selector")) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        onEnterSelectionMode(line.id)
        clearNativeTextSelection()
        window.requestAnimationFrame(() => {
          clearNativeTextSelection()
        })
      }}
    >
      <button
        type="button"
        className={`line-selector ${isSelected ? "is-selected" : ""}`}
        title={"\u9009\u4e2d\u5f53\u524d\u884c"}
        aria-pressed={isSelected}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onToggleSelect(line.id, {
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            shiftKey: event.shiftKey
          })
        }}
      >
        <span />
      </button>

      <div className="line-speaker-cell">
        {selectionMode ? (
          <div
            className="line-speaker-display"
            style={speakerColor ? { color: speakerColor } : undefined}
            onMouseDown={handleSelectionFocus}
          >
            {line.speaker}
          </div>
        ) : (
          <>
            <input
              ref={speakerInputRef}
              className="line-speaker-input"
              type="text"
              value={line.speaker}
              placeholder={isSpeakerFocused ? "\u8bf4\u8bdd\u4eba / # / #1 / #4" : ""}
              style={speakerColor ? { color: speakerColor } : undefined}
              onChange={(event) => {
                onSpeakerChange(line.id, event.target.value)
                setIsAutocompleteOpen(event.target.value.trim() !== "")
                setHighlightedIndex(0)
              }}
              onFocus={() => {
                setIsSpeakerFocused(true)
                setIsAutocompleteOpen(line.speaker.trim() !== "")
                onBeginTextEdit()
                onFocusLine(line.id)
              }}
              onBlur={() => {
                setIsSpeakerFocused(false)
                setIsAutocompleteOpen(false)
                handleSpeakerCommit()
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" && filteredSpeakerOptions.length > 0) {
                  event.preventDefault()
                  setIsAutocompleteOpen(true)
                  setHighlightedIndex((current) => (current + 1) % filteredSpeakerOptions.length)
                  return
                }

                if (event.key === "ArrowUp" && filteredSpeakerOptions.length > 0) {
                  event.preventDefault()
                  setIsAutocompleteOpen(true)
                  setHighlightedIndex((current) =>
                    current === 0 ? filteredSpeakerOptions.length - 1 : current - 1
                  )
                  return
                }

                if (event.key === "Escape" && isAutocompleteOpen) {
                  event.preventDefault()
                  setIsAutocompleteOpen(false)
                  return
                }

                if (event.key === "Enter") {
                  if (isAutocompleteOpen && filteredSpeakerOptions[highlightedIndex]) {
                    event.preventDefault()
                    applySpeakerOption(filteredSpeakerOptions[highlightedIndex].displayName)
                    return
                  }

                  event.preventDefault()
                  handleSpeakerCommit()
                  onInsertBelow(line.id, "speaker")
                }
              }}
            />

            {isSpeakerFocused && isAutocompleteOpen && filteredSpeakerOptions.length > 0 ? (
              <SpeakerAutocomplete
                options={filteredSpeakerOptions}
                highlightedIndex={highlightedIndex}
                onHover={setHighlightedIndex}
                onSelect={(option) => applySpeakerOption(option.displayName)}
              />
            ) : null}
          </>
        )}
      </div>

      <div className="line-content-cell">
        {selectionMode ? (
          <div
            className="line-content-display line-content-field"
            onMouseDown={handleSelectionFocus}
          >
            {line.content}
          </div>
        ) : (
          <textarea
            ref={(element) => {
              contentElementRef.current = element
              assignRef(contentInputRef, element)
            }}
            className="line-content-textarea line-content-field"
            value={line.content}
            rows={1}
            wrap="soft"
            placeholder={"\u8f93\u5165\u811a\u672c\u5185\u5bb9"}
            onChange={(event) => {
              onContentChange(line.id, event.target.value)
              resizeTextarea(event.target)
            }}
            onFocus={() => {
              onBeginTextEdit()
              onFocusLine(line.id)
            }}
            onBlur={onEndTextEdit}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                onSpeakerCommit(line.id)
                onEndTextEdit()
                onInsertBelow(line.id, "speaker")
              }
            }}
          />
        )}
      </div>

      <div className="line-actions" aria-label={"\u884c\u64cd\u4f5c"}>
        <LineActionMenu
          canPasteLine={canPaste}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onInsertBelow={() => {
            onSpeakerCommit(line.id)
            onInsertBelow(line.id, "speaker")
          }}
          onCutLine={() => onCut(line.id)}
          onCopyLine={() => onCopy(line.id)}
          onPasteLine={() => onPaste(line.id)}
          onMoveUp={() => onMove(line.id, -1)}
          onMoveDown={() => onMove(line.id, 1)}
          onDeleteLine={() => onDelete(line.id)}
        />
      </div>
    </div>
  )
}

function areLineEditorPropsEqual(previousProps: LineEditorProps, nextProps: LineEditorProps) {
  return (
    previousProps.line === nextProps.line &&
    previousProps.speakerColor === nextProps.speakerColor &&
    previousProps.speakerOptions === nextProps.speakerOptions &&
    previousProps.readingWrapChars === nextProps.readingWrapChars &&
    previousProps.editorFontSize === nextProps.editorFontSize &&
    previousProps.selectionMode === nextProps.selectionMode &&
    previousProps.layoutVersion === nextProps.layoutVersion &&
    previousProps.isActive === nextProps.isActive &&
    previousProps.isSearchCurrent === nextProps.isSearchCurrent &&
    previousProps.isDimmed === nextProps.isDimmed &&
    previousProps.isSelected === nextProps.isSelected &&
    previousProps.canPaste === nextProps.canPaste &&
    previousProps.canMoveUp === nextProps.canMoveUp &&
    previousProps.canMoveDown === nextProps.canMoveDown
  )
}

export const LineEditor = memo(LineEditorComponent, areLineEditorPropsEqual)
