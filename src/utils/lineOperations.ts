import type { ScriptLine } from "../types"
import { createLineId } from "./ids"

export function cloneLine(line: ScriptLine): ScriptLine {
  return {
    id: createLineId(),
    speaker: line.speaker,
    content: line.content
  }
}

export type LineRangeSelection = {
  anchorLineId: string
  focusLineId: string
}

export function getLineRange(lines: ScriptLine[], selection: LineRangeSelection | null) {
  if (!selection) {
    return []
  }

  const anchorIndex = lines.findIndex((line) => line.id === selection.anchorLineId)
  const focusIndex = lines.findIndex((line) => line.id === selection.focusLineId)

  if (anchorIndex < 0 || focusIndex < 0) {
    return []
  }

  const startIndex = Math.min(anchorIndex, focusIndex)
  const endIndex = Math.max(anchorIndex, focusIndex)
  return lines.slice(startIndex, endIndex + 1)
}

export function pasteClipboardLines(
  lines: ScriptLine[],
  clipboardLines: ScriptLine[],
  anchorLineId: string | null
) {
  if (clipboardLines.length === 0) {
    return {
      lines,
      insertedLineIds: []
    }
  }

  const clonedLines = clipboardLines.map(cloneLine)
  const anchorIndex = anchorLineId
    ? lines.findIndex((line) => line.id === anchorLineId)
    : -1
  const insertIndex = anchorIndex >= 0 ? anchorIndex + 1 : lines.length

  return {
    lines: [...lines.slice(0, insertIndex), ...clonedLines, ...lines.slice(insertIndex)],
    insertedLineIds: clonedLines.map((line) => line.id)
  }
}
