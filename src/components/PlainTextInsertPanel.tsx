import { useMemo, useState } from "react"
import type { ScriptLine } from "../types"
import {
  DEFAULT_PLAIN_TEXT_OPTIONS,
  parsePlainTextToLines,
  type PlainTextPatternOptions
} from "../utils/importPlainText"

export type PlainTextInsertMode = "below-focus" | "append" | "replace-all"

type PlainTextInsertPanelProps = {
  onInsert: (payload: {
    lines: ScriptLine[]
    characterIdHints: Record<string, string>
    insertMode: PlainTextInsertMode
  }) => boolean
}

const TEXT = {
  chineseColon: "中文冒号",
  westernColon: "西文冒号",
  chineseQuote: "中文引号",
  westernQuote: "西文引号",
  renpy: "Ren’Py 格式",
  heading: "标题",
  note: "备注",
  trimLines: "去除每行首尾空格",
  skipEmptyLines: "跳过空行",
  insertMode: "插入位置",
  belowFocus: "当前焦点行下方",
  append: "文末",
  replaceAll: "替换全文",
  clear: "清空",
  insert: "插入到脚本",
  empty: "没有可插入的文本。",
  inserted: "已插入",
  line: "行",
  inputLines: "输入行数",
  importedLines: "将插入",
  dialogueLines: "台词",
  narrationLines: "旁白",
  noteLines: "备注",
  headingLines: "标题"
}

const CHECKBOX_FIELDS: Array<{
  key: keyof PlainTextPatternOptions
  label: string
}> = [
  { key: "chineseColon", label: TEXT.chineseColon },
  { key: "westernColon", label: TEXT.westernColon },
  { key: "chineseQuote", label: TEXT.chineseQuote },
  { key: "westernQuote", label: TEXT.westernQuote },
  { key: "renpy", label: TEXT.renpy },
  { key: "heading", label: TEXT.heading },
  { key: "note", label: TEXT.note },
  { key: "skipEmptyLines", label: TEXT.skipEmptyLines },
  { key: "trimLines", label: TEXT.trimLines }
]

export function PlainTextInsertPanel({ onInsert }: PlainTextInsertPanelProps) {
  const [text, setText] = useState("")
  const [insertMode, setInsertMode] = useState<PlainTextInsertMode>("below-focus")
  const [options, setOptions] = useState<PlainTextPatternOptions>(DEFAULT_PLAIN_TEXT_OPTIONS)
  const [statusText, setStatusText] = useState("")

  const parseResult = useMemo(() => parsePlainTextToLines(text, options), [text, options])
  const hasInsertableLines = parseResult.lines.length > 0

  const handleToggleOption = (key: keyof PlainTextPatternOptions, checked: boolean) => {
    setOptions((current) => ({
      ...current,
      [key]: checked
    }))
  }

  const handleInsert = () => {
    if (!hasInsertableLines) {
      setStatusText(TEXT.empty)
      return
    }

    const didInsert = onInsert({
      lines: parseResult.lines,
      characterIdHints: parseResult.characterIdHints,
      insertMode
    })

    if (!didInsert) {
      return
    }

    setStatusText(`${TEXT.inserted} ${parseResult.lines.length} ${TEXT.line}。`)
    setText("")
  }

  const handleClear = () => {
    setText("")
    setStatusText("")
  }

  return (
    <div className="plain-text-insert-panel">
      <textarea
        className="plain-text-insert-textarea"
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          setStatusText("")
        }}
        rows={7}
      />

      <div className="plain-text-insert-options">
        {CHECKBOX_FIELDS.map((field) => (
          <label key={field.key} className="plain-text-insert-check">
            <input
              type="checkbox"
              checked={options[field.key]}
              onChange={(event) => handleToggleOption(field.key, event.target.checked)}
            />
            <span>{field.label}</span>
          </label>
        ))}
      </div>

      <label className="plain-text-insert-option">
        <span className="panel-field-label">{TEXT.insertMode}</span>
        <select
          value={insertMode}
          onChange={(event) => setInsertMode(event.target.value as PlainTextInsertMode)}
        >
          <option value="below-focus">{TEXT.belowFocus}</option>
          <option value="append">{TEXT.append}</option>
          <option value="replace-all">{TEXT.replaceAll}</option>
        </select>
      </label>

      <div className="plain-text-insert-preview">
        <div>
          {TEXT.inputLines}：{parseResult.stats.totalInputLines}
        </div>
        <div>
          {TEXT.importedLines}：{parseResult.stats.importedLines}
        </div>
        <div>
          {TEXT.dialogueLines}：{parseResult.stats.dialogueLines}
        </div>
        <div>
          {TEXT.narrationLines}：{parseResult.stats.narrationLines}
        </div>
        <div>
          {TEXT.noteLines}：{parseResult.stats.noteLines}
        </div>
        <div>
          {TEXT.headingLines}：{parseResult.stats.headingLines}
        </div>
      </div>

      <div className="panel-actions">
        <button type="button" onClick={handleInsert} disabled={!hasInsertableLines}>
          {TEXT.insert}
        </button>
        <button type="button" onClick={handleClear}>
          {TEXT.clear}
        </button>
      </div>

      <div className="panel-hint">{statusText || (!hasInsertableLines ? TEXT.empty : "")}</div>
    </div>
  )
}
