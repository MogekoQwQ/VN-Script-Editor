import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import type { CharacterMap, ScriptLine } from "../types"
import type { LineRangeSelection } from "../utils/lineOperations"
import { isCharacterSpeakerName } from "../utils/lineTypes"
import { DEFAULT_CHARACTER_COLOR, resolveCharacterColor } from "../utils/colors"
import { buildSpeakerSuggestions } from "../utils/characters"
import { BatchToolbar } from "./BatchToolbar"
import { LineEditor } from "./LineEditor"

export type FocusField = "speaker" | "content"
export type FocusRequest = { lineId: string; field: FocusField; requestKey: string }
export type ScrollRequest = { lineId: string; requestKey: string }

type EditorProps = {
  lines: ScriptLine[]
  characters: CharacterMap
  readingWrapChars: number
  editorFontSize: number
  lineRangeSelection: LineRangeSelection | null
  activeLineId: string | null
  searchMatchLineId: string | null
  typewriterMode: boolean
  focusRequest: FocusRequest | null
  scrollRequest: ScrollRequest | null
  isTextEditing: boolean
  onTextEditFocus: (lineId: string) => void
  onBlankLineClick: (lineId: string) => void
  onBeginRangeSelection: (lineId: string, extend: boolean) => void
  onExtendRangeSelection: (lineId: string) => void
  onSpeakerChange: (lineId: string, speaker: string) => void
  onSpeakerCommit: (lineId: string) => void
  onContentChange: (lineId: string, content: string) => void
  onBeginTextEdit: () => void
  onEndTextEdit: () => void
  onInsertLineBelow: (lineId: string, focusField: FocusField, source?: ScriptLine | null) => void
  onCopyRange: () => void
  onCutRange: () => void
  onDeleteRange: () => void
  onPasteRange: () => void
}

export function Editor(props: EditorProps) {
  const {
    lines, characters, readingWrapChars, editorFontSize, lineRangeSelection, activeLineId,
    searchMatchLineId, typewriterMode, focusRequest, scrollRequest, isTextEditing,
    onTextEditFocus, onBlankLineClick, onBeginRangeSelection, onExtendRangeSelection,
    onSpeakerChange, onSpeakerCommit, onContentChange, onBeginTextEdit, onEndTextEdit,
    onInsertLineBelow, onCopyRange, onCutRange, onDeleteRange, onPasteRange
  } = props
  const lineRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const speakerInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const contentInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const [isRangeDragging, setIsRangeDragging] = useState(false)
  const lastDraggedLineIdRef = useRef<string | null>(null)
  const lineIdsInRange = useMemo(() => {
    if (!lineRangeSelection) return new Set<string>()
    const anchor = lines.findIndex((line) => line.id === lineRangeSelection.anchorLineId)
    const focus = lines.findIndex((line) => line.id === lineRangeSelection.focusLineId)
    if (anchor < 0 || focus < 0) return new Set<string>()
    const [start, end] = anchor < focus ? [anchor, focus] : [focus, anchor]
    return new Set(lines.slice(start, end + 1).map((line) => line.id))
  }, [lineRangeSelection, lines])
  const speakerOptions = useMemo(() => buildSpeakerSuggestions(lines, characters, ""), [lines, characters])
  const isSingleFocusRange =
    lineRangeSelection?.anchorLineId === lineRangeSelection?.focusLineId

  useEffect(() => {
    if (!typewriterMode || !activeLineId) return
    lineRefs.current[activeLineId]?.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [activeLineId, typewriterMode])

  useEffect(() => {
    if (!scrollRequest) return
    lineRefs.current[scrollRequest.lineId]?.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [scrollRequest])

  useEffect(() => {
    if (!focusRequest) return
    const frame = window.requestAnimationFrame(() => {
      const input = focusRequest.field === "speaker"
        ? speakerInputRefs.current[focusRequest.lineId]
        : contentInputRefs.current[focusRequest.lineId]
      if (!input) return
      input.focus()
      input.setSelectionRange(input.value.length, input.value.length)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusRequest])

  useEffect(() => {
    if (!isRangeDragging) return
    const handleMove = (event: PointerEvent) => {
      event.preventDefault()
      const lineElement = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-script-line-id]")
      const lineId = lineElement?.dataset.scriptLineId
      if (!lineId || lineId === lastDraggedLineIdRef.current) return
      lastDraggedLineIdRef.current = lineId
      onExtendRangeSelection(lineId)
    }
    const endDrag = () => setIsRangeDragging(false)
    window.addEventListener("pointermove", handleMove, { passive: false })
    window.addEventListener("pointerup", endDrag, { once: true })
    window.addEventListener("pointercancel", endDrag, { once: true })
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", endDrag)
      window.removeEventListener("pointercancel", endDrag)
    }
  }, [isRangeDragging, onExtendRangeSelection])

  const handleGutterPointerDown = (lineId: string, event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    ;(document.activeElement as HTMLElement | null)?.blur()
    onBeginRangeSelection(lineId, event.shiftKey)
    lastDraggedLineIdRef.current = lineId
    setIsRangeDragging(true)
  }

  const handleSwitchTextField = (lineId: string, currentField: FocusField) => {
    const target = currentField === "speaker"
      ? contentInputRefs.current[lineId]
      : speakerInputRefs.current[lineId]

    target?.focus()
  }

  return (
    <main className={`panel panel-editor ${isRangeDragging ? "is-range-dragging" : ""}`.trim()}>
      <div className="panel-header"><h2>{"\u811a\u672c\u7f16\u8f91\u533a"}</h2></div>
      {!isTextEditing ? <BatchToolbar focusedCount={lineIdsInRange.size} onCopy={onCopyRange} onCut={onCutRange} onPasteBelow={onPasteRange} onDelete={onDeleteRange} /> : null}
      <div className="editor-column-labels"><span className="editor-select-label" /><span>{"\u8bf4\u8bdd\u4eba"}</span><span>{"\u5185\u5bb9"}</span></div>
      <div className="editor-scroll-area"><div className="editor-list editor-body" style={{ "--reading-wrap-width": `${readingWrapChars}em`, "--editor-font-size": `${editorFontSize}px` } as CSSProperties}>
        {lines.map((line) => {
          const normalizedSpeaker = line.speaker.trim()
          const profile = characters[normalizedSpeaker]
          const speakerColor = isCharacterSpeakerName(normalizedSpeaker) ? resolveCharacterColor(profile?.color ?? DEFAULT_CHARACTER_COLOR) : undefined
          return <LineEditor key={line.id} line={line} speakerColor={speakerColor} speakerOptions={speakerOptions}
            readingWrapChars={readingWrapChars} editorFontSize={editorFontSize}
            onSpeakerChange={onSpeakerChange} onSpeakerCommit={onSpeakerCommit} onContentChange={onContentChange}
            onBeginTextEdit={onBeginTextEdit} onEndTextEdit={onEndTextEdit} onTextEditFocus={onTextEditFocus}
            onBlankLineClick={onBlankLineClick} onGutterPointerDown={handleGutterPointerDown}
            isActive={activeLineId === line.id} isSearchCurrent={searchMatchLineId === line.id}
            isDimmed={typewriterMode && activeLineId !== null && activeLineId !== line.id}
            isRangeSelected={lineIdsInRange.has(line.id)}
            isSingleFocusRange={isSingleFocusRange}
            onInsertBelow={onInsertLineBelow}
            onSwitchTextField={handleSwitchTextField}
            containerRef={(element) => { lineRefs.current[line.id] = element }}
            speakerInputRef={(element) => { speakerInputRefs.current[line.id] = element }}
            contentInputRef={(element) => { contentInputRefs.current[line.id] = element }} />
        })}
      </div></div>
    </main>
  )
}
