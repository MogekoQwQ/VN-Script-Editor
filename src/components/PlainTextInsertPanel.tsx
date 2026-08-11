import { useEffect, useMemo, useState } from "react"
import type { ScriptLine } from "../types"
import {
  applySpeakerConfirmation,
  DEFAULT_PLAIN_TEXT_OPTIONS,
  parsePlainTextToLines,
  type HashMatchMode,
  type PlainTextPatternOptions,
  type SpeakerMatchMode
} from "../utils/importPlainText"

export type PlainTextInsertMode = "below-focus" | "append" | "replace-all"

type PlainTextInsertPanelProps = {
  onInsert: (payload: { lines: ScriptLine[]; characterIdHints: Record<string, string>; insertMode: PlainTextInsertMode }) => boolean
}

const TEXT = {
  speakerMatch: "\u8BF4\u8BDD\u4EBA\u5339\u914D",
  chineseColon: "\u4E2D\u6587\u5192\u53F7\uFF1AA\uFF1AB",
  renpy: "Ren\u2019Py\uFF1AA \"B\" / \"A\" \"B\" / \"B\"",
  noMatch: "\u4E0D\u5339\u914D",
  hashMatch: "# \u5339\u914D",
  markdownHeading: "Markdown \u6807\u9898",
  noteAndInternalHeading: "\u5907\u6CE8 + \u5185\u90E8\u6807\u9898",
  extraOptions: "\u989D\u5916\u9009\u9879",
  skipEmptyLines: "\u8DF3\u8FC7\u7A7A\u884C",
  trimLines: "\u53BB\u9664\u9996\u5C3E\u7A7A\u683C",
  speakerConfirmation: "\u8BF4\u8BDD\u4EBA\u786E\u8BA4",
  insertMode: "\u63D2\u5165\u4F4D\u7F6E",
  belowFocus: "\u5F53\u524D\u7126\u70B9\u884C\u4E0B\u65B9",
  append: "\u6587\u672B",
  replaceAll: "\u66FF\u6362\u5168\u6587",
  clear: "\u6E05\u7A7A",
  insert: "\u63D2\u5165\u5230\u811A\u672C",
  empty: "\u6CA1\u6709\u53EF\u63D2\u5165\u7684\u6587\u672C\u3002",
  inserted: "\u5DF2\u63D2\u5165",
  inputLines: "\u8F93\u5165\u884C\u6570",
  importedLines: "\u5C06\u63D2\u5165",
  dialogueLines: "\u53F0\u8BCD\u884C\u6570",
  narrationLines: "\u65C1\u767D\u884C\u6570",
  noteLines: "\u5907\u6CE8\u884C\u6570",
  headingLines: "\u6807\u9898\u884C\u6570",
  speakerCount: "\u8BC6\u522B\u5230\u7684\u8BF4\u8BDD\u4EBA\u6570"
}

const speakerOptions: Array<[SpeakerMatchMode, string]> = [
  ["chinese-colon", TEXT.chineseColon], ["renpy", TEXT.renpy], ["none", TEXT.noMatch]
]
const hashOptions: Array<[HashMatchMode, string]> = [
  ["markdown-heading", TEXT.markdownHeading], ["note-and-internal-heading", TEXT.noteAndInternalHeading], ["none", TEXT.noMatch]
]

export function PlainTextInsertPanel({ onInsert }: PlainTextInsertPanelProps) {
  const [text, setText] = useState("")
  const [insertMode, setInsertMode] = useState<PlainTextInsertMode>("below-focus")
  const [options, setOptions] = useState<PlainTextPatternOptions>(DEFAULT_PLAIN_TEXT_OPTIONS)
  const [excludedSpeakers, setExcludedSpeakers] = useState<Set<string>>(new Set())
  const [statusText, setStatusText] = useState("")
  const provisional = useMemo(() => parsePlainTextToLines(text, options), [text, options])
  const result = useMemo(() => applySpeakerConfirmation(provisional, excludedSpeakers), [provisional, excludedSpeakers])

  useEffect(() => {
    const available = new Set(provisional.speakerCandidates.map((candidate) => candidate.speaker))
    setExcludedSpeakers((current) => new Set([...current].filter((speaker) => available.has(speaker))))
  }, [provisional.speakerCandidates])

  const toggleExcluded = (speaker: string, checked: boolean) => setExcludedSpeakers((current) => {
    const next = new Set(current)
    if (checked) next.delete(speaker)
    else next.add(speaker)
    return next
  })

  const insert = () => {
    if (result.lines.length === 0) { setStatusText(TEXT.empty); return }
    if (!onInsert({ lines: result.lines, characterIdHints: result.characterIdHints, insertMode })) return
    setStatusText(`${TEXT.inserted} ${result.lines.length} \u884C\u3002`)
    setText("")
    setExcludedSpeakers(new Set())
  }

  return <div className="plain-text-insert-panel">
    <textarea className="plain-text-insert-textarea" value={text} rows={7} onChange={(event) => { setText(event.target.value); setStatusText("") }} />
    <fieldset className="plain-text-insert-options"><legend>{TEXT.speakerMatch}</legend>
      {speakerOptions.map(([value, label]) => <label key={value} className="plain-text-insert-check"><input type="radio" name="speaker-match" checked={options.speakerMatch === value} onChange={() => setOptions((current) => ({ ...current, speakerMatch: value }))} /><span>{label}</span></label>)}
    </fieldset>
    <fieldset className="plain-text-insert-options"><legend>{TEXT.hashMatch}</legend>
      {hashOptions.map(([value, label]) => <label key={value} className="plain-text-insert-check"><input type="radio" name="hash-match" checked={options.hashMatch === value} onChange={() => setOptions((current) => ({ ...current, hashMatch: value }))} /><span>{label}</span></label>)}
    </fieldset>
    <fieldset className="plain-text-insert-options"><legend>{TEXT.extraOptions}</legend>
      <label className="plain-text-insert-check"><input type="checkbox" checked={options.skipEmptyLines} onChange={(event) => setOptions((current) => ({ ...current, skipEmptyLines: event.target.checked }))} /><span>{TEXT.skipEmptyLines}</span></label>
      <label className="plain-text-insert-check"><input type="checkbox" checked={options.trimLines} onChange={(event) => setOptions((current) => ({ ...current, trimLines: event.target.checked }))} /><span>{TEXT.trimLines}</span></label>
    </fieldset>
    {provisional.speakerCandidates.length > 0 ? <fieldset className="plain-text-insert-options"><legend>{TEXT.speakerConfirmation}</legend>
      {provisional.speakerCandidates.map((candidate) => <label key={candidate.speaker} className="plain-text-insert-check"><input type="checkbox" checked={!excludedSpeakers.has(candidate.speaker)} onChange={(event) => toggleExcluded(candidate.speaker, event.target.checked)} /><span>{`${candidate.speaker}\uFF08${candidate.count} \u884C\uFF09`}</span></label>)}
    </fieldset> : null}
    <label className="plain-text-insert-option"><span className="panel-field-label">{TEXT.insertMode}</span><select value={insertMode} onChange={(event) => setInsertMode(event.target.value as PlainTextInsertMode)}><option value="below-focus">{TEXT.belowFocus}</option><option value="append">{TEXT.append}</option><option value="replace-all">{TEXT.replaceAll}</option></select></label>
    <div className="plain-text-insert-preview">
      <div>{TEXT.inputLines}{"\uFF1A"}{result.stats.totalInputLines}</div><div>{TEXT.importedLines}{"\uFF1A"}{result.stats.importedLines}</div>
      <div>{TEXT.dialogueLines}{"\uFF1A"}{result.stats.dialogueLines}</div><div>{TEXT.narrationLines}{"\uFF1A"}{result.stats.narrationLines}</div>
      <div>{TEXT.noteLines}{"\uFF1A"}{result.stats.noteLines}</div><div>{TEXT.headingLines}{"\uFF1A"}{result.stats.headingLines}</div>
      <div>{TEXT.speakerCount}{"\uFF1A"}{result.stats.speakerCount}</div>
    </div>
    <div className="panel-actions"><button type="button" onClick={insert} disabled={result.lines.length === 0}>{TEXT.insert}</button><button type="button" onClick={() => { setText(""); setStatusText(""); setExcludedSpeakers(new Set()) }}>{TEXT.clear}</button></div>
    <div className="panel-hint">{statusText || (result.lines.length === 0 ? TEXT.empty : "")}</div>
  </div>
}
