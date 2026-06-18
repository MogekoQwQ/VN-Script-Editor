import type { ScriptLine } from "../types"
import { createLineId } from "./ids"

export function cloneLine(line: ScriptLine): ScriptLine {
  return {
    id: createLineId(),
    speaker: line.speaker,
    content: line.content
  }
}

export function snapshotSelectedLines(lines: ScriptLine[], selectedLineIds: Set<string>) {
  return lines
    .filter((line) => selectedLineIds.has(line.id))
    .map((line) => ({
      ...line
    }))
}

export function duplicateSelectedLines(lines: ScriptLine[], selectedLineIds: Set<string>) {
  const selectedIndices = lines
    .map((line, index) => (selectedLineIds.has(line.id) ? index : -1))
    .filter((index) => index >= 0)

  if (selectedIndices.length === 0) {
    return {
      lines,
      duplicatedLineIds: []
    }
  }

  const insertIndex = selectedIndices[selectedIndices.length - 1] + 1
  const duplicatedLines = lines
    .filter((line) => selectedLineIds.has(line.id))
    .map(cloneLine)

  return {
    lines: [...lines.slice(0, insertIndex), ...duplicatedLines, ...lines.slice(insertIndex)],
    duplicatedLineIds: duplicatedLines.map((line) => line.id)
  }
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

export function moveSelectedLines(
  lines: ScriptLine[],
  selectedLineIds: Set<string>,
  direction: -1 | 1
) {
  if (lines.length <= 1 || selectedLineIds.size === 0) {
    return lines
  }

  if (direction === -1 && selectedLineIds.has(lines[0]?.id ?? "")) {
    return lines
  }

  if (direction === 1 && selectedLineIds.has(lines[lines.length - 1]?.id ?? "")) {
    return lines
  }

  const nextLines = [...lines]

  if (direction === -1) {
    for (let index = 1; index < nextLines.length; index += 1) {
      if (
        selectedLineIds.has(nextLines[index].id) &&
        !selectedLineIds.has(nextLines[index - 1].id)
      ) {
        ;[nextLines[index - 1], nextLines[index]] = [nextLines[index], nextLines[index - 1]]
      }
    }

    return nextLines
  }

  for (let index = nextLines.length - 2; index >= 0; index -= 1) {
    if (
      selectedLineIds.has(nextLines[index].id) &&
      !selectedLineIds.has(nextLines[index + 1].id)
    ) {
      ;[nextLines[index], nextLines[index + 1]] = [nextLines[index + 1], nextLines[index]]
    }
  }

  return nextLines
}
