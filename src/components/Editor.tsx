import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import type { CharacterMap, ScriptLine } from "../types"
import type { LineRangeSelection } from "../utils/lineOperations"
import { isCharacterSpeakerName } from "../utils/lineTypes"
import { DEFAULT_CHARACTER_COLOR, resolveCharacterColor } from "../utils/colors"
import { buildSpeakerSuggestions } from "../utils/characters"
import { BatchToolbar } from "./BatchToolbar"
import { LineEditor } from "./LineEditor"
import { hiddenLineIds, parseScriptStructure, revealLineIndices } from "../utils/scriptStructure"

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
  rangeVisibilityGuard: React.MutableRefObject<(() => boolean) | null>
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
  const completedScrollRequest = useRef<string | null>(null)
  const completedFocusRequest = useRef<string | null>(null)
  const [isRangeDragging, setIsRangeDragging] = useState(false)
  const lastDraggedLineIdRef = useRef<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [foldNotice, setFoldNotice] = useState("")
  const structure = useMemo(() => parseScriptStructure(lines), [lines])
  const hidden = useMemo(() => hiddenLineIds(lines, structure.blocks, collapsed), [lines, structure, collapsed])
  const reveal = (lineId: string) => {
    const index = lines.findIndex((line) => line.id === lineId)
    setCollapsed((previous) => revealLineIndices(structure.blocks, previous, [index]))
  }
  props.rangeVisibilityGuard.current = () => {
    if (![...lineIdsInRange].some((id) => hidden.has(id))) return true
    setCollapsed((previous) => revealLineIndices(structure.blocks, previous, lines.flatMap((line, index) => lineIdsInRange.has(line.id) ? [index] : [])))
    setFoldNotice("已展开选区内的隐藏内容，请确认范围后再次操作。")
    return false
  }
  useEffect(() => {
    const valid = new Set(structure.blocks.filter((block) => block.complete).map((block) => block.id))
    setCollapsed((previous) => [...previous].every((id) => valid.has(id)) ? previous : new Set([...previous].filter((id) => valid.has(id))))
  }, [structure])
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
    const frame = requestAnimationFrame(() => lineRefs.current[activeLineId]?.scrollIntoView({ block: "center", behavior: "smooth" }))
    return () => cancelAnimationFrame(frame)
  }, [activeLineId, typewriterMode])

  useEffect(() => {
    if (activeLineId) reveal(activeLineId)
  }, [activeLineId])

  useLayoutEffect(() => {
    if (!scrollRequest || completedScrollRequest.current === scrollRequest.requestKey) return
    if (hidden.has(scrollRequest.lineId)) { reveal(scrollRequest.lineId); return }
    const frame = requestAnimationFrame(() => {
      const element = lineRefs.current[scrollRequest.lineId]
      if (!element) return
      completedScrollRequest.current = scrollRequest.requestKey
      element.scrollIntoView({ block: "center", behavior: "smooth" })
    })
    return () => cancelAnimationFrame(frame)
  }, [scrollRequest, hidden])

  useLayoutEffect(() => {
    if (!focusRequest || completedFocusRequest.current === focusRequest.requestKey) return
    if (hidden.has(focusRequest.lineId)) { reveal(focusRequest.lineId); return }
    const frame = window.requestAnimationFrame(() => {
      const input = focusRequest.field === "speaker"
        ? speakerInputRefs.current[focusRequest.lineId]
        : contentInputRefs.current[focusRequest.lineId]
      if (!input) return
      completedFocusRequest.current = focusRequest.requestKey
      input.focus()
      input.setSelectionRange(input.value.length, input.value.length)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusRequest, hidden])

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

    if (target?.disabled) {
      speakerInputRefs.current[lineId]?.focus()
      return
    }
    target?.focus()
  }

  return (
    <main className={`panel panel-editor ${isRangeDragging ? "is-range-dragging" : ""}`.trim()}>
      <div className="panel-header"><h2>{"\u811a\u672c\u7f16\u8f91\u533a"}</h2></div>
      {!isTextEditing ? <BatchToolbar focusedCount={lineIdsInRange.size} onCopy={onCopyRange} onCut={onCutRange} onPasteBelow={onPasteRange} onDelete={onDeleteRange} /> : null}
      {foldNotice ? <div role="status">{foldNotice}</div> : null}
      <div className="editor-column-labels"><span className="editor-select-label" /><span>{"\u8bf4\u8bdd\u4eba"}</span><span>{"\u5185\u5bb9"}</span></div>
      <div className="editor-scroll-area"><div className="editor-list editor-body" style={{ "--reading-wrap-width": `${readingWrapChars}em`, "--editor-font-size": `${editorFontSize}px` } as CSSProperties}>
        {lines.map((line) => {
          if (hidden.has(line.id)) return null
          const block = structure.blocks.find((block) => block.id === line.id && block.complete && block.end > block.start)
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
            foldable={Boolean(block)} collapsed={collapsed.has(line.id)}
            foldSummary={block?.kind === "menu" && collapsed.has(line.id) ? `${block.options.length} 个选项` : undefined}
            onToggleFold={() => {
              if (!block) return
              if (!collapsed.has(line.id)) {
                ;(document.activeElement as HTMLElement | null)?.blur()
                onBlankLineClick(line.id)
              }
              setFoldNotice("")
              setCollapsed((previous) => { const next = new Set(previous); if (next.has(line.id)) next.delete(line.id); else next.add(line.id); return next })
            }}
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
