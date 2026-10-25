import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual"
import { estimateRowHeight } from "../utils/rowHeight"
import type { CharacterMap, ScriptLine } from "../types"
import type { LineRangeSelection } from "../utils/lineOperations"
import { isCharacterSpeakerName } from "../utils/lineTypes"
import { DEFAULT_CHARACTER_COLOR, resolveCharacterColor } from "../utils/colors"
import { buildSpeakerSuggestions, getActiveSpeakers } from "../utils/characters"
import { BatchToolbar } from "./BatchToolbar"
import { LineEditor } from "./LineEditor"
import { hiddenLineIds, revealLineIndices, type ScriptStructure } from "../utils/scriptStructure"

export type FocusField = "speaker" | "content"
export type FocusRequest = { lineId: string; field: FocusField; requestKey: string }
export type ScrollRequest = { lineId: string; requestKey: string }

type EditorProps = {
  structure: ScriptStructure
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
    lines, structure, characters, readingWrapChars, editorFontSize, lineRangeSelection, activeLineId,
    searchMatchLineId, typewriterMode, focusRequest, scrollRequest, isTextEditing,
    onTextEditFocus, onBlankLineClick, onBeginRangeSelection, onExtendRangeSelection,
    onSpeakerChange, onSpeakerCommit, onContentChange, onBeginTextEdit, onEndTextEdit,
    onInsertLineBelow, onCopyRange, onCutRange, onDeleteRange, onPasteRange
  } = props
  const speakerInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const contentInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const scrollElementRef = useRef<HTMLDivElement | null>(null)
  const paperRef = useRef<HTMLDivElement | null>(null)
  const [editingTarget, setEditingTarget] = useState<{ lineId: string; field: FocusField } | null>(null)
  const endTextEditRef = useRef(onEndTextEdit)
  endTextEditRef.current = onEndTextEdit
  const handleEndTextEdit = useCallback(() => {
    setEditingTarget(null)
    endTextEditRef.current()
  }, [])
  const pendingCaret = useRef<number | null>(null)
  const [geometry, setGeometry] = useState({ width: 600, offset: 0, viewportWidth: 1280 })
  const completedScrollRequest = useRef<string | null>(null)
  const completedFocusRequest = useRef<string | null>(null)
  const [isRangeDragging, setIsRangeDragging] = useState(false)
  const lastDraggedLineIdRef = useRef<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [foldNotice, setFoldNotice] = useState("")
  const foldableBlocks = useMemo(() => new Map(structure.blocks.filter((block) => block.complete && block.end > block.start).map((block) => [block.id, block])), [structure])
  const toggleFoldRef = useRef<(lineId: string) => void>(() => {})
  toggleFoldRef.current = (lineId) => {
    if (!foldableBlocks.has(lineId)) return
    if (!collapsed.has(lineId)) {
      ;(document.activeElement as HTMLElement | null)?.blur()
      setEditingTarget(null)
      onBlankLineClick(lineId)
    }
    setFoldNotice("")
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (next.has(lineId)) next.delete(lineId)
      else next.add(lineId)
      return next
    })
  }
  const handleToggleFold = useCallback((lineId: string) => toggleFoldRef.current(lineId), [])
  const hidden = useMemo(() => hiddenLineIds(lines, structure.blocks, collapsed), [lines, structure, collapsed])
  const visibleLines = useMemo(() => lines.filter((line) => !hidden.has(line.id)), [lines, hidden])
  const visibleIndexes = useMemo(() => new Map(visibleLines.map((line, index) => [line.id, index])), [visibleLines])
  const editingIndex = editingTarget ? visibleIndexes.get(editingTarget.lineId) ?? -1 : -1
  const editingContentDisabled = editingTarget?.field === "content" && editingIndex >= 0 && visibleLines[editingIndex].speaker.trim() === "#endmenu"
  useEffect(() => {
    if (editingTarget && (editingIndex < 0 || editingContentDisabled)) handleEndTextEdit()
  }, [editingTarget, editingIndex, editingContentDisabled, handleEndTextEdit])
  const getItemKey = useCallback((index: number) => visibleLines[index].id, [visibleLines])
  const rangeExtractor = useCallback((range: Parameters<typeof defaultRangeExtractor>[0]) => {
    const indexes = defaultRangeExtractor(range)
    if (editingIndex >= 0 && !indexes.includes(editingIndex)) indexes.push(editingIndex)
    return indexes.sort((a, b) => a - b)
  }, [editingIndex])
  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: visibleLines.length,
    getScrollElement: () => scrollElementRef.current,
    getItemKey,
    rangeExtractor,
    estimateSize: (index) => estimateRowHeight(visibleLines[index], editorFontSize, readingWrapChars,
      Math.max(40, geometry.width - (geometry.viewportWidth <= 640 ? 48 : geometry.viewportWidth <= 960 ? 146 : 196))),
    overscan: 10,
    scrollMargin: geometry.offset,
    useAnimationFrameWithResizeObserver: true
  })
  const virtualRows = virtualizer.getVirtualItems()
  useLayoutEffect(() => {
    const scroll = scrollElementRef.current
    const paper = paperRef.current
    if (!scroll || !paper) return
    const measure = () => {
      const style = getComputedStyle(paper)
      const width = paper.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      const offset = paper.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop + parseFloat(style.paddingTop) + 1
      setGeometry((previous) => previous.width === width && Math.abs(previous.offset - offset) < 0.5 && previous.viewportWidth === window.innerWidth ? previous : { width, offset, viewportWidth: window.innerWidth })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(scroll)
    observer.observe(paper)
    window.addEventListener("resize", measure)
    return () => { observer.disconnect(); window.removeEventListener("resize", measure) }
  }, [])
  useLayoutEffect(() => { virtualizer.measure() }, [geometry.width, editorFontSize, readingWrapChars])
  const requestEdit = (lineId: string, field: FocusField, offset: number) => {
    pendingCaret.current = offset
    setEditingTarget({ lineId, field })
  }
  useLayoutEffect(() => {
    if (!editingTarget || pendingCaret.current === null) return
    const input = editingTarget.field === "speaker" ? speakerInputRefs.current[editingTarget.lineId] : contentInputRefs.current[editingTarget.lineId]
    if (!input) return
    const offset = pendingCaret.current
    pendingCaret.current = null
    input.focus({ preventScroll: true })
    input.setSelectionRange(offset, offset)
  }, [editingTarget, virtualRows])
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
  const activeSpeakers = useMemo(() => getActiveSpeakers(lines), [lines])
  const speakerOptionsKey = JSON.stringify(activeSpeakers.map((name) => [name, characters[name]?.id ?? ""]))
  // Dialogue edits must not invalidate the suggestions passed to every row.
  const speakerOptions = useMemo(() => buildSpeakerSuggestions(lines, characters, ""), [speakerOptionsKey])

  useEffect(() => {
    if (!typewriterMode || !activeLineId) return
    const index = visibleIndexes.get(activeLineId)
    if (index !== undefined) virtualizer.scrollToIndex(index, { align: "center" })
  }, [activeLineId, typewriterMode, visibleIndexes])

  useEffect(() => {
    if (activeLineId) reveal(activeLineId)
  }, [activeLineId])

  useLayoutEffect(() => {
    if (!scrollRequest || completedScrollRequest.current === scrollRequest.requestKey) return
    if (hidden.has(scrollRequest.lineId)) { reveal(scrollRequest.lineId); return }
    const index = visibleIndexes.get(scrollRequest.lineId)
    if (index === undefined) return
    completedScrollRequest.current = scrollRequest.requestKey
    virtualizer.scrollToIndex(index, { align: "center" })
  }, [scrollRequest, hidden, visibleIndexes])

  useLayoutEffect(() => {
    if (!focusRequest || completedFocusRequest.current === focusRequest.requestKey) return
    if (hidden.has(focusRequest.lineId)) { reveal(focusRequest.lineId); return }
    const index = visibleIndexes.get(focusRequest.lineId)
    if (index === undefined) return
    if (editingTarget?.lineId !== focusRequest.lineId || editingTarget.field !== focusRequest.field) {
      setEditingTarget({ lineId: focusRequest.lineId, field: focusRequest.field })
      return
    }
    const input = focusRequest.field === "speaker" ? speakerInputRefs.current[focusRequest.lineId] : contentInputRefs.current[focusRequest.lineId]
    if (!input) return
    completedFocusRequest.current = focusRequest.requestKey
    virtualizer.scrollToIndex(index, { align: "auto" })
    input.focus({ preventScroll: true })
    input.setSelectionRange(input.value.length, input.value.length)
  }, [focusRequest, hidden, visibleIndexes, editingTarget, virtualRows])

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
    setEditingTarget(null)
    onBeginRangeSelection(lineId, event.shiftKey)
    lastDraggedLineIdRef.current = lineId
    setIsRangeDragging(true)
  }

  const handleSwitchTextField = (lineId: string, currentField: FocusField) => {
    if (currentField === "speaker" && lines.find((line) => line.id === lineId)?.speaker.trim() === "#endmenu") return
    ;(document.activeElement as HTMLElement | null)?.blur()
    requestEdit(lineId, currentField === "speaker" ? "content" : "speaker", 0)
  }

  return (
    <main className={`panel panel-editor ${isRangeDragging ? "is-range-dragging" : ""}`.trim()}>
      <div className="panel-header"><h2>{"\u811a\u672c\u7f16\u8f91\u533a"}</h2></div>
      {!isTextEditing ? <BatchToolbar focusedCount={lineIdsInRange.size} onCopy={onCopyRange} onCut={onCutRange} onPasteBelow={onPasteRange} onDelete={onDeleteRange} /> : null}
      {foldNotice ? <div role="status">{foldNotice}</div> : null}
      <div className="editor-column-labels"><span className="editor-select-label" /><span>{"\u8bf4\u8bdd\u4eba"}</span><span>{"\u5185\u5bb9"}</span></div>
      <div className="editor-scroll-area" ref={scrollElementRef} onWheel={() => virtualizer.cancelScroll()} onTouchStart={() => virtualizer.cancelScroll()} onPointerDownCapture={() => virtualizer.cancelScroll()}><div className="editor-list editor-body" ref={paperRef} style={{ "--reading-wrap-width": `${readingWrapChars}em`, "--editor-font-size": `${editorFontSize}px` } as CSSProperties}>
        <div className="virtual-script-surface" style={{ height: virtualizer.getTotalSize() }}>
        {virtualRows.map((virtualRow) => {
          const line = visibleLines[virtualRow.index]
          const block = foldableBlocks.get(line.id)
          const normalizedSpeaker = line.speaker.trim()
          const profile = characters[normalizedSpeaker]
          const speakerColor = isCharacterSpeakerName(normalizedSpeaker) ? resolveCharacterColor(profile?.color ?? DEFAULT_CHARACTER_COLOR) : undefined
          return <div key={line.id} data-index={virtualRow.index} ref={virtualizer.measureElement} className="virtual-script-row" style={{ transform: `translateY(${virtualRow.start - geometry.offset}px)` }}>
            <LineEditor line={line} editingField={editingTarget?.lineId === line.id ? editingTarget.field : null} onRequestEdit={requestEdit} speakerColor={speakerColor} speakerOptions={speakerOptions}
            readingWrapChars={readingWrapChars} editorFontSize={editorFontSize}
            onSpeakerChange={onSpeakerChange} onSpeakerCommit={onSpeakerCommit} onContentChange={onContentChange}
            onBeginTextEdit={onBeginTextEdit} onEndTextEdit={handleEndTextEdit} onTextEditFocus={onTextEditFocus}
            onBlankLineClick={(lineId) => { setEditingTarget(null); onBlankLineClick(lineId) }} onGutterPointerDown={handleGutterPointerDown}
            isActive={activeLineId === line.id} isSearchCurrent={searchMatchLineId === line.id}
            isDimmed={typewriterMode && activeLineId !== null && activeLineId !== line.id}
            isRangeSelected={lineIdsInRange.has(line.id)}
            foldable={Boolean(block)} collapsed={collapsed.has(line.id)}
            foldSummary={block?.kind === "menu" && collapsed.has(line.id) ? `${block.options.length} 个选项` : undefined}
            onToggleFold={handleToggleFold}
            onInsertBelow={onInsertLineBelow}
            onSwitchTextField={handleSwitchTextField}
            speakerInputRef={(element) => { speakerInputRefs.current[line.id] = element }}
            contentInputRef={(element) => { contentInputRefs.current[line.id] = element }} />
          </div>
        })}
      </div></div></div>
    </main>
  )
}
