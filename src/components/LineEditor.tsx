import { memo, useLayoutEffect, useMemo, useRef, useState, type Ref } from "react"
import type { ScriptLine } from "../types"
import type { SpeakerSuggestion } from "../utils/characters"
import { getHeadingLevel, isNarrationSpeaker, isNoteSpeaker } from "../utils/lineTypes"
import type { FocusField } from "./Editor"
import { SpeakerAutocomplete } from "./SpeakerAutocomplete"
import { observeTextareaWidth, resizeTextarea } from "../utils/textareaLayout"

type LineEditorProps = {
  line: ScriptLine
  editingField: FocusField | null
  onRequestEdit: (lineId: string, field: FocusField, offset: number) => void
  foldable: boolean
  collapsed: boolean
  foldSummary?: string
  onToggleFold: (lineId: string) => void
  speakerColor?: string
  speakerOptions: SpeakerSuggestion[]
  readingWrapChars: number
  editorFontSize: number
  onSpeakerChange: (lineId: string, speaker: string) => void
  onSpeakerCommit: (lineId: string) => void
  onContentChange: (lineId: string, content: string) => void
  onBeginTextEdit: () => void
  onEndTextEdit: () => void
  onTextEditFocus: (lineId: string) => void
  onBlankLineClick: (lineId: string) => void
  onGutterPointerDown: (lineId: string, event: React.PointerEvent<HTMLButtonElement>) => void
  onInsertBelow: (lineId: string, focusField: FocusField, source?: ScriptLine | null) => void
  onSwitchTextField: (lineId: string, currentField: FocusField) => void
  isActive: boolean
  isSearchCurrent: boolean
  isDimmed: boolean
  isRangeSelected: boolean
  speakerInputRef?: Ref<HTMLInputElement>
  contentInputRef?: Ref<HTMLTextAreaElement>
}

function getLineVariant(speaker: string) {
  const headingLevel = getHeadingLevel(speaker)
  if (headingLevel) return `heading-${headingLevel}`
  if (isNoteSpeaker(speaker)) return "note"
  if (isNarrationSpeaker(speaker)) return "narration"
  return "dialogue"
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return
  if (typeof ref === "function") { ref(value); return }
  ;(ref as { current: T | null }).current = value
}

function textOffsetAtClick(event: React.MouseEvent<HTMLElement>, value: string) {
  if (!value) return 0
  const caret = document.caretRangeFromPoint?.(event.clientX, event.clientY)
  if (!caret || !event.currentTarget.contains(caret.startContainer)) return value.length
  const range = document.createRange()
  range.selectNodeContents(event.currentTarget)
  range.setEnd(caret.startContainer, caret.startOffset)
  return Math.min(value.length, range.toString().length)
}

function LineEditorComponent(props: LineEditorProps) {
  const {
    line, editingField, onRequestEdit, speakerColor, speakerOptions, readingWrapChars, editorFontSize,
    onSpeakerChange, onSpeakerCommit, onContentChange, onBeginTextEdit, onEndTextEdit,
    onTextEditFocus, onBlankLineClick, onGutterPointerDown, onInsertBelow, onSwitchTextField,
    isActive, isSearchCurrent, isDimmed, isRangeSelected, speakerInputRef, contentInputRef
  } = props
  const [isSpeakerFocused, setIsSpeakerFocused] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false)
  const contentElementRef = useRef<HTMLTextAreaElement | null>(null)
  const variant = getLineVariant(line.speaker)
  const isEndMenu = line.speaker.trim() === "#endmenu"
  const filteredSpeakerOptions = useMemo(() => {
    const query = line.speaker.trim().toLowerCase()
    if (!isSpeakerFocused || !query) return []
    return speakerOptions.filter((option) => option.matchValues.some((value) => value.includes(query)))
  }, [isSpeakerFocused, line.speaker, speakerOptions])

  useLayoutEffect(() => { resizeTextarea(contentElementRef.current) }, [line.content, variant, readingWrapChars, editorFontSize, editingField])
  useLayoutEffect(() => {
    const element = contentElementRef.current
    if (!element) return
    return observeTextareaWidth(element)
  }, [editingField])

  const commitSpeaker = () => { onSpeakerCommit(line.id); onEndTextEdit() }
  const applySpeakerOption = (displayName: string) => { onSpeakerChange(line.id, displayName); setIsAutocompleteOpen(false); setHighlightedIndex(0) }
  const requestEdit = (event: React.MouseEvent<HTMLElement>, field: FocusField, value: string) => {
    event.stopPropagation()
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed && event.currentTarget.contains(selection.anchorNode)) return
    onRequestEdit(line.id, field, textOffsetAtClick(event, value))
  }
  return (
    <div data-script-line-id={line.id}
      className={["line-editor", `line-${variant}`, isActive ? "is-active" : "", isSearchCurrent ? "is-search-current" : "", isRangeSelected ? "is-range-selected" : "", isDimmed ? "is-dimmed" : ""].filter(Boolean).join(" ")}
      onPointerDown={(event) => {
        const target = event.target as HTMLElement
        if (target.closest("input, textarea, button, .speaker-autocomplete")) return
        event.preventDefault()
        ;(document.activeElement as HTMLElement | null)?.blur()
        onBlankLineClick(line.id)
      }}>
      <div className="line-gutter-cell">
        <button type="button" className="line-gutter" title="拖拽选择连续行" aria-label="选择当前行" tabIndex={-1}
          onPointerDown={(event) => { event.stopPropagation(); onGutterPointerDown(line.id, event) }} />
        {props.foldable ? <button type="button" className="line-fold-toggle" aria-label={props.collapsed ? "展开" : "折叠"} aria-expanded={!props.collapsed} tabIndex={-1}
          onPointerDown={(event) => { event.preventDefault(); event.stopPropagation() }}
          onClick={(event) => { event.stopPropagation(); props.onToggleFold(line.id) }}>{props.collapsed ? "▸" : "▾"}</button> : null}
      </div>
      <div className="line-speaker-cell">
        {editingField === "speaker" ? <input ref={speakerInputRef} className="line-speaker-input" type="text" value={line.speaker} aria-label="说话人"
          placeholder={isSpeakerFocused ? "\u8bf4\u8bdd\u4eba / # / #1 / #4" : ""} style={speakerColor ? { color: speakerColor } : undefined}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => { onSpeakerChange(line.id, event.target.value); setIsAutocompleteOpen(event.target.value.trim() !== ""); setHighlightedIndex(0) }}
          onFocus={() => { setIsSpeakerFocused(true); setIsAutocompleteOpen(line.speaker.trim() !== ""); onBeginTextEdit(); onTextEditFocus(line.id) }}
          onBlur={() => { setIsSpeakerFocused(false); setIsAutocompleteOpen(false); commitSpeaker() }}
          onKeyDown={(event) => {
            if (event.key === "Tab") { event.preventDefault(); onSwitchTextField(line.id, "speaker"); return }
            if (event.key === "ArrowDown" && filteredSpeakerOptions.length > 0) { event.preventDefault(); setIsAutocompleteOpen(true); setHighlightedIndex((index) => (index + 1) % filteredSpeakerOptions.length); return }
            if (event.key === "ArrowUp" && filteredSpeakerOptions.length > 0) { event.preventDefault(); setIsAutocompleteOpen(true); setHighlightedIndex((index) => index === 0 ? filteredSpeakerOptions.length - 1 : index - 1); return }
            if (event.key === "Escape" && isAutocompleteOpen) { event.preventDefault(); setIsAutocompleteOpen(false); return }
            if (event.key === "Enter") {
              if (isAutocompleteOpen && filteredSpeakerOptions[highlightedIndex]) { event.preventDefault(); applySpeakerOption(filteredSpeakerOptions[highlightedIndex].displayName); return }
              event.preventDefault(); commitSpeaker(); onInsertBelow(line.id, "speaker")
            }
          }} /> : <div className="line-speaker-display" role="textbox" aria-label="说话人" aria-readonly="true" tabIndex={-1}
            style={speakerColor ? { color: speakerColor } : undefined}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => requestEdit(event, "speaker", line.speaker)}>{line.speaker || "\u00a0"}</div>}
        {isSpeakerFocused && isAutocompleteOpen && filteredSpeakerOptions.length > 0 ? <SpeakerAutocomplete options={filteredSpeakerOptions} highlightedIndex={highlightedIndex} onHover={setHighlightedIndex} onSelect={(option) => applySpeakerOption(option.displayName)} /> : null}
      </div>
      <div className="line-content-cell">
        {props.foldSummary ? <span className="fold-summary">（{props.foldSummary}）</span> : null}
        {editingField === "content" && !isEndMenu ? <textarea ref={(element) => { contentElementRef.current = element; assignRef(contentInputRef, element) }} className="line-content-textarea line-content-field" value={line.content} rows={1} wrap="soft" aria-label="脚本内容" placeholder="输入脚本内容"
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => { onContentChange(line.id, event.target.value); resizeTextarea(event.target) }}
          onFocus={() => { onBeginTextEdit(); onTextEditFocus(line.id) }} onBlur={onEndTextEdit}
          onKeyDown={(event) => {
            if (event.key === "Tab") { event.preventDefault(); onSwitchTextField(line.id, "content"); return }
            if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSpeakerCommit(line.id); onEndTextEdit(); onInsertBelow(line.id, "speaker") }
          }} /> : <div className="line-content-display line-content-field" role="textbox" aria-label="脚本内容" aria-readonly="true" aria-disabled={isEndMenu} tabIndex={-1}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { if (!isEndMenu) requestEdit(event, "content", line.content) }}>{line.content || (isEndMenu ? "\u00a0" : <span className="line-content-placeholder">输入脚本内容</span>)}</div>}
      </div>
    </div>
  )
}

function areLineEditorPropsEqual(previousProps: LineEditorProps, nextProps: LineEditorProps) {
  if (previousProps.editingField !== nextProps.editingField) return false
  if (previousProps.foldable !== nextProps.foldable || previousProps.collapsed !== nextProps.collapsed || previousProps.foldSummary !== nextProps.foldSummary || previousProps.onToggleFold !== nextProps.onToggleFold) return false
  return previousProps.line === nextProps.line && previousProps.speakerColor === nextProps.speakerColor && previousProps.speakerOptions === nextProps.speakerOptions && previousProps.readingWrapChars === nextProps.readingWrapChars && previousProps.editorFontSize === nextProps.editorFontSize && previousProps.isActive === nextProps.isActive && previousProps.isSearchCurrent === nextProps.isSearchCurrent && previousProps.isDimmed === nextProps.isDimmed && previousProps.isRangeSelected === nextProps.isRangeSelected
}

export const LineEditor = memo(LineEditorComponent, areLineEditorPropsEqual)
