import type { ScriptLine } from "../types"
import { getHeadingLevel } from "./lineTypes"

// Estimates seed the virtual height map; mounted rows are measured by ResizeObserver.
export function estimateRowHeight(line: ScriptLine, fontSize: number, wrapChars: number, availableWidth: number) {
  const level = getHeadingLevel(line.speaker)
  const scale = level === 1 ? 1.35 : level === 2 ? 1.08 : level ? 0.95 : 1
  const textSize = fontSize * scale
  const capacity = Math.max(1, Math.min(wrapChars * fontSize, availableWidth) / textSize)
  let wrappedLines = 0
  for (const paragraph of line.content.split(/\r\n|\r|\n/)) {
    let units = 0
    for (const character of paragraph) units += /[\x00-\xff]/.test(character) ? 0.55 : 1
    wrappedLines += Math.max(1, Math.ceil(units / capacity))
  }
  const lineHeight = level === 1 ? 1.45 : level === 2 ? 1.5 : level ? 1.55 : 1.65
  const padding = level === 1 ? 1.55 * fontSize : level === 2 ? 1.25 * fontSize : level === 3 ? 0.85 * fontSize : level === 4 ? 0.6 * fontSize : 3.84
  const margins = level === 1 ? 23.2 : level === 2 ? 16 : level ? 11.2 : 0
  return Math.max(27.2, wrappedLines * textSize * lineHeight + 1) + padding + margins + 0.8
}
