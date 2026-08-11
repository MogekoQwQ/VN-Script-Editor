import type { ScriptLine } from "../types"
import { quoteRenpySpeakerName } from "./characters"
import { createLineId } from "./ids"

export type SpeakerMatchMode = "chinese-colon" | "renpy" | "none"
export type HashMatchMode = "markdown-heading" | "note-and-internal-heading" | "none"

export type PlainTextPatternOptions = {
  speakerMatch: SpeakerMatchMode
  hashMatch: HashMatchMode
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
  speakerCount: number
}

export type SpeakerCandidate = {
  speaker: string
  count: number
}

type ParsedLine = {
  line: ScriptLine
  originalText: string
  kind: "narration" | "dialogue" | "note" | "heading"
  candidateSpeaker?: string
  characterIdHint?: string
}

export type PlainTextParseResult = {
  lines: ScriptLine[]
  stats: PlainTextParseStats
  characterIdHints: Record<string, string>
  speakerCandidates: SpeakerCandidate[]
  parsedLines: ParsedLine[]
}

export const DEFAULT_PLAIN_TEXT_OPTIONS: PlainTextPatternOptions = {
  speakerMatch: "chinese-colon",
  hashMatch: "note-and-internal-heading",
  trimLines: true,
  skipEmptyLines: true
}

function createScriptLine(speaker: string, content: string): ScriptLine {
  return { id: createLineId(), speaker, content }
}

function normalizeLine(rawLine: string, trimLines: boolean) {
  const line = rawLine.replace(/\r/g, "")
  return trimLines ? line.trim() : line
}

function isValidCandidateSpeaker(value: string) {
  return value.length > 0 && value.length <= 30 && !/[\r\n]/.test(value)
}

function parseRenpyString(source: string, startIndex: number) {
  if (source[startIndex] !== '"') return null
  let value = ""
  let index = startIndex + 1
  while (index < source.length) {
    const character = source[index]
    if (character === "\\") {
      const next = source[index + 1]
      if (next === '"' || next === "\\") {
        value += next
        index += 2
        continue
      }
    }
    if (character === '"') return { value, endIndex: index + 1 }
    value += character
    index += 1
  }
  return null
}

function parseHashLine(line: string, mode: HashMatchMode): ParsedLine | null {
  if (mode === "markdown-heading") {
    const match = line.match(/^(#{1,4})[\t ]+(.+)$/u)
    if (!match) return null
    return {
      line: createScriptLine(`#${match[1].length}`, match[2]),
      originalText: line,
      kind: "heading"
    }
  }

  if (mode === "note-and-internal-heading") {
    const headingMatch = line.match(/^#([1-4])(?:[\t ]+|$)(.*)$/u)
    if (headingMatch) {
      return {
        line: createScriptLine(`#${headingMatch[1]}`, headingMatch[2]),
        originalText: line,
        kind: "heading"
      }
    }
    if (!line.startsWith("#")) return null
    const content = line.slice(1).replace(/^[\t ]/, "")
    return { line: createScriptLine("#", content), originalText: line, kind: "note" }
  }

  return null
}

function parseChineseColonLine(line: string): ParsedLine | null {
  const delimiterIndex = line.indexOf("\uFF1A")
  if (delimiterIndex < 0) return null
  const speaker = line.slice(0, delimiterIndex).trim()
  if (!isValidCandidateSpeaker(speaker)) return null
  return {
    line: createScriptLine(speaker, line.slice(delimiterIndex + 1).trim()),
    originalText: line,
    kind: "dialogue",
    candidateSpeaker: speaker
  }
}

function parseRenpyLine(line: string): ParsedLine | null {
  const narration = parseRenpyString(line, 0)
  if (narration && narration.endIndex === line.length) {
    return { line: createScriptLine("", narration.value), originalText: line, kind: "narration" }
  }

  if (line.startsWith('"')) {
    const speakerString = parseRenpyString(line, 0)
    if (!speakerString || !/^[\t ]+/.test(line.slice(speakerString.endIndex))) return null
    const contentStart = speakerString.endIndex + line.slice(speakerString.endIndex).match(/^[\t ]+/)?.[0].length!
    const contentString = parseRenpyString(line, contentStart)
    if (!contentString || contentString.endIndex !== line.length || !isValidCandidateSpeaker(speakerString.value)) return null
    return {
      line: createScriptLine(speakerString.value, contentString.value),
      originalText: line,
      kind: "dialogue",
      candidateSpeaker: speakerString.value,
      characterIdHint: quoteRenpySpeakerName(speakerString.value)
    }
  }

  const bareMatch = line.match(/^([^\s"]+)[\t ]+/u)
  if (!bareMatch || !isValidCandidateSpeaker(bareMatch[1])) return null
  const contentString = parseRenpyString(line, bareMatch[0].length)
  if (!contentString || contentString.endIndex !== line.length) return null
  return {
    line: createScriptLine(bareMatch[1], contentString.value),
    originalText: line,
    kind: "dialogue",
    candidateSpeaker: bareMatch[1],
    characterIdHint: bareMatch[1]
  }
}

function parseSpeakerLine(line: string, mode: SpeakerMatchMode): ParsedLine | null {
  if (mode === "chinese-colon") return parseChineseColonLine(line)
  if (mode === "renpy") return parseRenpyLine(line)
  return null
}

function buildResult(parsedLines: ParsedLine[], totalInputLines: number, excludedSpeakers: Set<string>) {
  const lines: ScriptLine[] = []
  const characterIdHints: Record<string, string> = {}
  const stats: PlainTextParseStats = {
    totalInputLines,
    importedLines: parsedLines.length,
    narrationLines: 0,
    dialogueLines: 0,
    noteLines: 0,
    headingLines: 0,
    speakerCount: 0
  }
  const activeSpeakers = new Set<string>()

  parsedLines.forEach((parsed) => {
    const isRejectedSpeaker = parsed.candidateSpeaker && excludedSpeakers.has(parsed.candidateSpeaker)
    const outputLine = isRejectedSpeaker
      ? { ...parsed.line, speaker: "", content: parsed.originalText }
      : { ...parsed.line }
    lines.push(outputLine)

    if (isRejectedSpeaker || parsed.kind === "narration") stats.narrationLines += 1
    else if (parsed.kind === "note") stats.noteLines += 1
    else if (parsed.kind === "heading") stats.headingLines += 1
    else {
      stats.dialogueLines += 1
      activeSpeakers.add(outputLine.speaker)
      if (parsed.characterIdHint) characterIdHints[outputLine.speaker] = parsed.characterIdHint
    }
  })
  stats.speakerCount = activeSpeakers.size
  return { lines, stats, characterIdHints }
}

export function parsePlainTextToLines(text: string, options: PlainTextPatternOptions = DEFAULT_PLAIN_TEXT_OPTIONS): PlainTextParseResult {
  const merged = { ...DEFAULT_PLAIN_TEXT_OPTIONS, ...options }
  const rawLines = text === "" ? [] : text.split(/\r?\n/u)
  const parsedLines: ParsedLine[] = []
  const candidates = new Map<string, number>()

  rawLines.forEach((rawLine) => {
    const line = normalizeLine(rawLine, merged.trimLines)
    if (merged.skipEmptyLines && line === "") return
    const parsed = parseHashLine(line, merged.hashMatch) ?? parseSpeakerLine(line, merged.speakerMatch) ?? {
      line: createScriptLine("", line), originalText: line, kind: "narration" as const
    }
    parsedLines.push(parsed)
    if (parsed.candidateSpeaker) candidates.set(parsed.candidateSpeaker, (candidates.get(parsed.candidateSpeaker) ?? 0) + 1)
  })

  return {
    ...buildResult(parsedLines, rawLines.length, new Set()),
    parsedLines,
    speakerCandidates: Array.from(candidates, ([speaker, count]) => ({ speaker, count }))
  }
}

export function applySpeakerConfirmation(result: PlainTextParseResult, excludedSpeakers: Set<string>): PlainTextParseResult {
  return { ...result, ...buildResult(result.parsedLines, result.stats.totalInputLines, excludedSpeakers) }
}
