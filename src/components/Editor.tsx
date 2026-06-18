import { useEffect, useMemo, useRef, type CSSProperties } from "react"
import type { CharacterMap, ScriptLine } from "../types"
import { isCharacterSpeakerName } from "../utils/lineTypes"
import { DEFAULT_CHARACTER_COLOR, resolveCharacterColor } from "../utils/colors"
import { BatchToolbar } from "./BatchToolbar"
import { LineEditor } from "./LineEditor"

export type FocusField = "speaker" | "content"

export type FocusRequest = {
  lineId: string
  field: FocusField
  requestKey: string
}

export type ScrollRequest = {
  lineId: string
  requestKey: string
}

type SelectionModifiers = {
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}

type EditorProps = {
  lines: ScriptLine[]
  characters: CharacterMap
  readingWrapChars: number
  editorFontSize: number
  selectionMode: boolean
  layoutVersion: number
  selectedLineIds: string[]
  activeLineId: string | null
  searchMatchLineId: string | null
  typewriterMode: boolean
  focusRequest: FocusRequest | null
  scrollRequest: ScrollRequest | null
  clipboardLineCount: number
  onActiveLineChange: (lineId: string) => void
  onSpeakerChange: (lineId: string, speaker: string) => void
  onSpeakerCommit: (lineId: string) => void
  onContentChange: (lineId: string, content: string) => void
  onBeginTextEdit: () => void
  onEndTextEdit: () => void
  onInsertLineBelow: (lineId: string, focusField: FocusField, source?: ScriptLine | null) => void
  onDeleteLine: (lineId: string) => void
  onCutLine: (lineId: string) => void
  onCopyLine: (lineId: string) => void
  onPasteLineBelow: (lineId: string) => void
  onMoveLine: (lineId: string, direction: -1 | 1) => void
  onEnterSelectionMode: (lineId: string) => void
  onToggleLineSelection: (lineId: string, modifiers: SelectionModifiers) => void
  onCopySelectedLines: () => void
  onCutSelectedLines: () => void
  onPasteClipboard: () => void
  onDeleteSelectedLines: () => void
  onMoveSelectedLines: (direction: -1 | 1) => void
  onClearSelection: () => void
  onExitSelectionMode: () => void
}

export function Editor({
  lines,
  characters,
  readingWrapChars,
  editorFontSize,
  selectionMode,
  layoutVersion,
  selectedLineIds,
  activeLineId,
  searchMatchLineId,
  typewriterMode,
  focusRequest,
  scrollRequest,
  clipboardLineCount,
  onActiveLineChange,
  onSpeakerChange,
  onSpeakerCommit,
  onContentChange,
  onBeginTextEdit,
  onEndTextEdit,
  onInsertLineBelow,
  onDeleteLine,
  onCutLine,
  onCopyLine,
  onPasteLineBelow,
  onMoveLine,
  onEnterSelectionMode,
  onToggleLineSelection,
  onCopySelectedLines,
  onCutSelectedLines,
  onPasteClipboard,
  onDeleteSelectedLines,
  onMoveSelectedLines,
  onClearSelection,
  onExitSelectionMode
}: EditorProps) {
  const lineRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const speakerInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const contentInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const selectedLineIdSet = useMemo(() => new Set(selectedLineIds), [selectedLineIds])
  const hasSelection = selectedLineIds.length > 0
  const canMoveSelectionUp = hasSelection && !selectedLineIdSet.has(lines[0]?.id ?? "")
  const canMoveSelectionDown =
    hasSelection && !selectedLineIdSet.has(lines[lines.length - 1]?.id ?? "")
  const speakerOptions = useMemo(
    () =>
      Object.entries(characters).map(([displayName, profile]) => ({
        displayName,
        id: profile.id
      })),
    [characters]
  )

  useEffect(() => {
    if (!typewriterMode || !activeLineId) {
      return
    }

    const activeLineElement = lineRefs.current[activeLineId]

    if (!activeLineElement) {
      return
    }

    activeLineElement.scrollIntoView({
      block: "center",
      behavior: "smooth"
    })
  }, [activeLineId, typewriterMode])

  useEffect(() => {
    if (!scrollRequest) {
      return
    }

    const targetLine = lineRefs.current[scrollRequest.lineId]

    if (!targetLine) {
      return
    }

    targetLine.scrollIntoView({
      block: "center",
      behavior: "smooth"
    })
  }, [scrollRequest])

  useEffect(() => {
    if (!focusRequest) {
      return
    }

    const rafId = window.requestAnimationFrame(() => {
      const targetInput =
        focusRequest.field === "speaker"
          ? speakerInputRefs.current[focusRequest.lineId]
          : contentInputRefs.current[focusRequest.lineId]

      if (!targetInput) {
        return
      }

      targetInput.focus()

      if ("selectionStart" in targetInput) {
        const textLength = targetInput.value.length
        targetInput.setSelectionRange(textLength, textLength)
      }
    })

    return () => window.cancelAnimationFrame(rafId)
  }, [focusRequest])

  return (
    <main className={`panel panel-editor ${selectionMode ? "selection-mode" : ""}`.trim()}>
      <div className="panel-header">
        <h2>{"\u811a\u672c\u7f16\u8f91\u533a"}</h2>
      </div>

      <BatchToolbar
        selectionMode={selectionMode}
        selectedCount={selectedLineIds.length}
        clipboardCount={clipboardLineCount}
        canPaste={clipboardLineCount > 0}
        canMoveUp={canMoveSelectionUp}
        canMoveDown={canMoveSelectionDown}
        onCopy={onCopySelectedLines}
        onCut={onCutSelectedLines}
        onPaste={onPasteClipboard}
        onDelete={onDeleteSelectedLines}
        onMoveUp={() => onMoveSelectedLines(-1)}
        onMoveDown={() => onMoveSelectedLines(1)}
        onClear={onClearSelection}
        onExit={onExitSelectionMode}
      />

      <div className="editor-column-labels">
        <span className="editor-select-label">{selectionMode ? "\u9009" : ""}</span>
        <span>{"\u8bf4\u8bdd\u4eba"}</span>
        <span>{"\u5185\u5bb9"}</span>
        <span className="editor-actions-label">{"\u64cd\u4f5c"}</span>
      </div>

      <div className="editor-scroll-area">
        <div
          className="editor-list editor-body"
          style={
            {
              "--reading-wrap-width": `${readingWrapChars}em`,
              "--editor-font-size": `${editorFontSize}px`
            } as CSSProperties
          }
        >
          {lines.map((line, index) => {
            const normalizedSpeaker = line.speaker.trim()
            const profile = characters[normalizedSpeaker]
            const isDialogue = isCharacterSpeakerName(normalizedSpeaker)
            const speakerColor = isDialogue
              ? resolveCharacterColor(profile?.color ?? DEFAULT_CHARACTER_COLOR)
              : undefined

            return (
              <LineEditor
                key={line.id}
                line={line}
                speakerColor={speakerColor}
                speakerOptions={speakerOptions}
                readingWrapChars={readingWrapChars}
                editorFontSize={editorFontSize}
                selectionMode={selectionMode}
                layoutVersion={layoutVersion}
                onSpeakerChange={onSpeakerChange}
                onSpeakerCommit={onSpeakerCommit}
                onContentChange={onContentChange}
                onBeginTextEdit={onBeginTextEdit}
                onEndTextEdit={onEndTextEdit}
                onFocusLine={onActiveLineChange}
                isActive={activeLineId === line.id}
                isSearchCurrent={searchMatchLineId === line.id}
                isDimmed={typewriterMode && activeLineId !== null && activeLineId !== line.id}
                isSelected={selectedLineIdSet.has(line.id)}
                canMoveUp={index > 0}
                canMoveDown={index < lines.length - 1}
                onInsertBelow={onInsertLineBelow}
                onDelete={onDeleteLine}
                onCut={onCutLine}
                onCopy={onCopyLine}
                onPaste={onPasteLineBelow}
                canPaste={clipboardLineCount > 0}
                onMove={onMoveLine}
                onEnterSelectionMode={onEnterSelectionMode}
                onToggleSelect={onToggleLineSelection}
                containerRef={(element) => {
                  lineRefs.current[line.id] = element
                }}
                speakerInputRef={(element) => {
                  speakerInputRefs.current[line.id] = element
                }}
                contentInputRef={(element) => {
                  contentInputRefs.current[line.id] = element
                }}
              />
            )
          })}
        </div>
      </div>
    </main>
  )
}
