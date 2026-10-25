import { memo, useLayoutEffect, useMemo, useRef, useState, type Ref } from "react"
import type { ScriptLine } from "../types"
import type { SpeakerSuggestion } from "../utils/characters"
import { getHeadingLevel, isNarrationSpeaker, isNoteSpeaker } from "../utils/lineTypes"
import type { FocusField } from "./Editor"
import { SpeakerAutocomplete } from "./SpeakerAutocomplete"
import { observeTextareaWidth, resizeTextarea } from "../utils/textareaLayout"

type LineEditorProps = {
  line: ScriptLine
  foldable: boolean
  collapsed: boolean
  foldSummary?: string
  onToggleFold: () => void
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
  isSingleFocusRange: boolean
  containerRef?: Ref<HTMLDivElement>
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

function LineEditorComponent(props: LineEditorProps) {
  const {
    line, speakerColor, speakerOptions, readingWrapChars, editorFontSize,
    onSpeakerChange, onSpeakerCommit, onContentChange, onBeginTextEdit, onEndTextEdit,
    onTextEditFocus, onBlankLineClick, onGutterPointerDown, onInsertBelow, onSwitchTextField,
    isActive, isSearchCurrent, isDimmed, isRangeSelected, isSingleFocusRange, containerRef, speakerInputRef, contentInputRef
  } = props
  const [isSpeakerFocused, setIsSpeakerFocused] = useState(false)
  const [isContentFocused, setIsContentFocused] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false)
  const contentElementRef = useRef<HTMLTextAreaElement | null>(null)
  const variant = getLineVariant(line.speaker)
  const isEndMenu = line.speaker.trim() === "#endmenu"
  const filteredSpeakerOptions = useMemo(() => {
    const query = line.speaker.trim().toLowerCase()
    if (!query) return []
    return speakerOptions.filter((option) => option.matchValues.some((value) => value.includes(query)))
  }, [line.speaker, speakerOptions])

  useLayoutEffect(() => { resizeTextarea(contentElementRef.current) }, [line.content, variant, readingWrapChars, editorFontSize])
  useLayoutEffect(() => {
    const element = contentElementRef.current
    if (!element) return
    return observeTextareaWidth(element)
  }, [])

  const commitSpeaker = () => { onSpeakerCommit(line.id); onEndTextEdit() }
  const applySpeakerOption = (displayName: string) => { onSpeakerChange(line.id, displayName); setIsAutocompleteOpen(false); setHighlightedIndex(0) }
  const isSpeakerHighlighted =
    isHovered ||
    isSpeakerFocused ||
    isContentFocused ||
    (isSingleFocusRange && isActive)

  return (
    <div ref={containerRef} data-script-line-id={line.id}
      className={["line-editor", `line-${variant}`, isActive ? "is-active" : "", isSearchCurrent ? "is-search-current" : "", isRangeSelected ? "is-range-selected" : "", isSpeakerHighlighted ? "is-speaker-highlighted" : "", isDimmed ? "is-dimmed" : ""].filter(Boolean).join(" ")}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
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
          onClick={(event) => { event.stopPropagation(); props.onToggleFold() }}>{props.collapsed ? "▸" : "▾"}</button> : null}
      </div>
      <div className="line-speaker-cell">
        <input ref={speakerInputRef} className="line-speaker-input" type="text" value={line.speaker}
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
          }} />
        {isSpeakerFocused && isAutocompleteOpen && filteredSpeakerOptions.length > 0 ? <SpeakerAutocomplete options={filteredSpeakerOptions} highlightedIndex={highlightedIndex} onHover={setHighlightedIndex} onSelect={(option) => applySpeakerOption(option.displayName)} /> : null}
      </div>
      <div className="line-content-cell">
        {props.foldSummary ? <span className="fold-summary">（{props.foldSummary}）</span> : null}
        <textarea ref={(element) => { contentElementRef.current = element; assignRef(contentInputRef, element) }} className="line-content-textarea line-content-field" value={line.content} rows={1} wrap="soft" disabled={isEndMenu} placeholder={isEndMenu ? "" : "\u8f93\u5165\u811a\u672c\u5185\u5bb9"}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => { onContentChange(line.id, event.target.value); resizeTextarea(event.target) }}
          onFocus={() => { setIsContentFocused(true); onBeginTextEdit(); onTextEditFocus(line.id) }} onBlur={() => { setIsContentFocused(false); onEndTextEdit() }}
          onKeyDown={(event) => {
            if (event.key === "Tab") { event.preventDefault(); onSwitchTextField(line.id, "content"); return }
            if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSpeakerCommit(line.id); onEndTextEdit(); onInsertBelow(line.id, "speaker") }
          }} />
      </div>
    </div>
  )
}

function areLineEditorPropsEqual(previousProps: LineEditorProps, nextProps: LineEditorProps) {
  if (previousProps.foldable !== nextProps.foldable || previousProps.collapsed !== nextProps.collapsed || previousProps.foldSummary !== nextProps.foldSummary || previousProps.onToggleFold !== nextProps.onToggleFold) return false
  return previousProps.line === nextProps.line && previousProps.speakerColor === nextProps.speakerColor && previousProps.speakerOptions === nextProps.speakerOptions && previousProps.readingWrapChars === nextProps.readingWrapChars && previousProps.editorFontSize === nextProps.editorFontSize && previousProps.isActive === nextProps.isActive && previousProps.isSearchCurrent === nextProps.isSearchCurrent && previousProps.isDimmed === nextProps.isDimmed && previousProps.isRangeSelected === nextProps.isRangeSelected && previousProps.isSingleFocusRange === nextProps.isSingleFocusRange
}

export const LineEditor = memo(LineEditorComponent, areLineEditorPropsEqual)
