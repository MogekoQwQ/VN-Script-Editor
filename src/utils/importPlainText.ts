import type { ScriptLine } from "../types"
import { createLineId } from "./ids"
import { quoteRenpySpeakerName } from "./characters"

const MAX_SPEAKER_PREFIX_CHARS = 10
const TIME_PREFIX_PATTERN = /^\s*\d{1,2}[:：]\d{2}(\s|$|[^\d])/u
const INVALID_SPEAKER_PUNCTUATION = /[。！？；，、]/u

export type PlainTextPatternOptions = {
  chineseColon: boolean
  westernColon: boolean
  chineseQuote: boolean
  westernQuote: boolean
  renpy: boolean
  heading: boolean
  note: boolean
  trimLines: boolean
  skipEmptyLines: boolean
}

export type PlainTextParseStats = {
  totalInputLines: number
  importedLines: number
  narrationLines: number
  dialogueLines: number
  noteLines: number
  headingLines: number
}

export type PlainTextParseResult = {
  lines: ScriptLine[]
  stats: PlainTextParseStats
  characterIdHints: Record<string, string>
}

type ParsedLineResult = {
  line: ScriptLine
  characterIdHint?: string
}

type ParsedQuotedString = {
  value: string
  endIndex: number
}

export const DEFAULT_PLAIN_TEXT_OPTIONS: PlainTextPatternOptions = {
  chineseColon: true,
  westernColon: false,
  chineseQuote: true,
  westernQuote: true,
  renpy: false,
  heading: true,
  note: false,
  trimLines: true,
  skipEmptyLines: true
}

function createScriptLine(speaker: string, content: string): ScriptLine {
  return {
    id: createLineId(),
    speaker,
    content
  }
}

function normalizeLine(rawLine: string, trimLines: boolean) {
  const line = rawLine.replace(/\r/g, "")
  return trimLines ? line.trim() : line
}

function stripTrailingQuote(content: string, quote: string) {
  return content.endsWith(quote) ? content.slice(0, -1).trimEnd() : content
}

function isLikelySpeaker(rawSpeaker: string): boolean {
  const speaker = rawSpeaker.trim()

  if (!speaker || speaker.length > 30) {
    return false
  }

  if (INVALID_SPEAKER_PUNCTUATION.test(speaker)) {
    return false
  }

  return /^[\p{L}\p{N}_\-\s]+$/u.test(speaker)
}

function classifyLine(speaker: string) {
  if (speaker === "") {
    return "narration" as const
  }

  if (speaker === "#") {
    return "note" as const
  }

  if (/^#[1-4]$/u.test(speaker)) {
    return "heading" as const
  }

  return "dialogue" as const
}

function buildSpeakerContentLine(
  rawSpeaker: string,
  rawContent: string,
  characterIdHint?: string
): ParsedLineResult | null {
  const speaker = rawSpeaker.trim()
  const content = rawContent.trim()

  if (!isLikelySpeaker(speaker) || content === "") {
    return null
  }

  return {
    line: createScriptLine(speaker, content),
    characterIdHint
  }
}

function tryParseHeading(
  line: string,
  options: PlainTextPatternOptions
): ParsedLineResult | null {
  if (!options.heading) {
    return null
  }

  const explicitMatch = line.match(/^(#([1-4]))(?:\s+|$)(.+)$/u)

  if (explicitMatch) {
    const content = explicitMatch[3].trim()
    return content
      ? {
          line: createScriptLine(explicitMatch[1], content)
        }
      : null
  }

  const markdownMatch = line.match(/^(#{1,4})(?:\s+|$)(.+)$/u)

  if (!markdownMatch) {
    return null
  }

  if (markdownMatch[1].length === 1 && options.note) {
    return null
  }

  const content = markdownMatch[2].trim()

  if (!content) {
    return null
  }

  return {
    line: createScriptLine(`#${markdownMatch[1].length}`, content)
  }
}

function tryParseNote(line: string, options: PlainTextPatternOptions): ParsedLineResult | null {
  if (!options.note) {
    return null
  }

  const noteMatch = line.match(/^#(?![1-4](?:\s|$))(?:\s+|$)(.+)$/u)

  if (!noteMatch) {
    return null
  }

  const content = noteMatch[1].trim()
  return content
    ? {
        line: createScriptLine("#", content)
      }
    : null
}

function isTimeLikeLine(line: string) {
  return TIME_PREFIX_PATTERN.test(line)
}

function findPrefixDelimiterIndex(line: string, delimiter: string) {
  const trimmedStart = line.trimStart()
  const delimiterIndex = trimmedStart.indexOf(delimiter)

  if (delimiterIndex <= 0 || delimiterIndex > MAX_SPEAKER_PREFIX_CHARS) {
    return null
  }

  return {
    source: trimmedStart,
    delimiterIndex
  }
}

function tryParseChineseQuote(
  line: string,
  options: PlainTextPatternOptions
): ParsedLineResult | null {
  if (!options.chineseQuote || isTimeLikeLine(line)) {
    return null
  }

  const prefix = findPrefixDelimiterIndex(line, "：")

  if (!prefix) {
    return null
  }

  const afterDelimiter = prefix.source.slice(prefix.delimiterIndex + 1).trimStart()

  if (!afterDelimiter.startsWith("“")) {
    return null
  }

  const rawSpeaker = prefix.source.slice(0, prefix.delimiterIndex)
  const rawContent = stripTrailingQuote(afterDelimiter.slice(1), "”")
  return buildSpeakerContentLine(rawSpeaker, rawContent)
}

function tryParseWesternQuote(
  line: string,
  options: PlainTextPatternOptions
): ParsedLineResult | null {
  if (!options.westernQuote || isTimeLikeLine(line)) {
    return null
  }

  const prefix = findPrefixDelimiterIndex(line, ":")

  if (!prefix) {
    return null
  }

  const afterDelimiter = prefix.source.slice(prefix.delimiterIndex + 1).trimStart()

  if (!afterDelimiter.startsWith('"')) {
    return null
  }

  const rawSpeaker = prefix.source.slice(0, prefix.delimiterIndex)
  const rawContent = stripTrailingQuote(afterDelimiter.slice(1), '"')
  return buildSpeakerContentLine(rawSpeaker, rawContent)
}

function tryParseColon(
  line: string,
  delimiter: "：" | ":",
  enabled: boolean
): ParsedLineResult | null {
  if (!enabled || isTimeLikeLine(line)) {
    return null
  }

  const prefix = findPrefixDelimiterIndex(line, delimiter)

  if (!prefix) {
    return null
  }

  const rawSpeaker = prefix.source.slice(0, prefix.delimiterIndex)
  const rawContent = prefix.source.slice(prefix.delimiterIndex + 1)
  return buildSpeakerContentLine(rawSpeaker, rawContent)
}

function parseDoubleQuotedString(source: string, startIndex: number): ParsedQuotedString | null {
  if (source[startIndex] !== '"') {
    return null
  }

  let value = ""
  let cursor = startIndex + 1

  while (cursor < source.length) {
    const currentChar = source[cursor]

    if (currentChar === "\\") {
      const nextChar = source[cursor + 1]

      if (typeof nextChar === "string") {
        value += nextChar
        cursor += 2
        continue
      }
    }

    if (currentChar === '"') {
      return {
        value,
        endIndex: cursor + 1
      }
    }

    value += currentChar
    cursor += 1
  }

  return {
    value,
    endIndex: source.length
  }
}

function tryParseRenpy(
  line: string,
  options: PlainTextPatternOptions
): ParsedLineResult | null {
  if (!options.renpy) {
    return null
  }

  const trimmedLine = line.trimStart()

  if (trimmedLine.startsWith('"')) {
    const speakerString = parseDoubleQuotedString(trimmedLine, 0)

    if (!speakerString) {
      return null
    }

    const remaining = trimmedLine.slice(speakerString.endIndex).trimStart()

    if (!remaining.startsWith('"')) {
      return null
    }

    const contentString = parseDoubleQuotedString(remaining, 0)

    if (!contentString) {
      return null
    }

    return buildSpeakerContentLine(
      speakerString.value,
      contentString.value,
      quoteRenpySpeakerName(speakerString.value)
    )
  }

  const bareSpeakerMatch = trimmedLine.match(/^([A-Za-z0-9_]+)\s+/u)

  if (!bareSpeakerMatch) {
    return null
  }

  const remaining = trimmedLine.slice(bareSpeakerMatch[0].length).trimStart()

  if (!remaining.startsWith('"')) {
    return null
  }

  const contentString = parseDoubleQuotedString(remaining, 0)

  if (!contentString) {
    return null
  }

  return buildSpeakerContentLine(
    bareSpeakerMatch[1],
    contentString.value,
    bareSpeakerMatch[1]
  )
}

function parseLine(line: string, options: PlainTextPatternOptions): ParsedLineResult {
  return (
    tryParseHeading(line, options) ??
    tryParseNote(line, options) ??
    tryParseRenpy(line, options) ??
    tryParseChineseQuote(line, options) ??
    tryParseWesternQuote(line, options) ??
    tryParseColon(line, "：", options.chineseColon) ??
    tryParseColon(line, ":", options.westernColon) ?? {
      line: createScriptLine("", line)
    }
  )
}

function createEmptyStats(totalInputLines: number): PlainTextParseStats {
  return {
    totalInputLines,
    importedLines: 0,
    narrationLines: 0,
    dialogueLines: 0,
    noteLines: 0,
    headingLines: 0
  }
}

export function parsePlainTextToLines(
  text: string,
  options: PlainTextPatternOptions = DEFAULT_PLAIN_TEXT_OPTIONS
): PlainTextParseResult {
  const mergedOptions = {
    ...DEFAULT_PLAIN_TEXT_OPTIONS,
    ...options
  }
  const rawLines = text === "" ? [] : text.split(/\r?\n/u)
  const stats = createEmptyStats(rawLines.length)
  const lines: ScriptLine[] = []
  const characterIdHints: Record<string, string> = {}

  rawLines.forEach((rawLine) => {
    const line = normalizeLine(rawLine, mergedOptions.trimLines)

    if (mergedOptions.skipEmptyLines && line.trim() === "") {
      return
    }

    const parsedResult = parseLine(line, mergedOptions)
    lines.push(parsedResult.line)
    stats.importedLines += 1

    if (parsedResult.characterIdHint) {
      characterIdHints[parsedResult.line.speaker] = parsedResult.characterIdHint
    }

    switch (classifyLine(parsedResult.line.speaker)) {
      case "dialogue":
        stats.dialogueLines += 1
        break
      case "note":
        stats.noteLines += 1
        break
      case "heading":
        stats.headingLines += 1
        break
      default:
        stats.narrationLines += 1
        break
    }
  })

  return {
    lines,
    stats,
    characterIdHints
  }
}
