import type { ScriptLine } from "../types"
import { getHeadingLevel, isNarrationSpeaker, isNoteSpeaker } from "./lineTypes"

export function serializeLinesForPlainText(lines: ScriptLine[]): string {
  return lines
    .map((line) => {
      const speaker = line.speaker.trim()
      const headingLevel = getHeadingLevel(speaker)

      if (headingLevel) return `#${headingLevel} ${line.content}`.trimEnd()
      if (isNoteSpeaker(speaker)) return `# ${line.content}`.trimEnd()
      if (isNarrationSpeaker(speaker)) return line.content

      return `${speaker}\uFF1A${line.content}`
    })
    .join("\n")
}

export async function writeLinesToSystemClipboard(lines: ScriptLine[]): Promise<void> {
  if (!navigator.clipboard?.writeText) return
  try {
    await navigator.clipboard.writeText(serializeLinesForPlainText(lines))
  } catch {
    // The internal clipboard remains available when the browser denies access.
  }
}

export async function readExternalPlainText(): Promise<string | null> {
  if (!navigator.clipboard?.readText) return null
  try {
    return await navigator.clipboard.readText()
  } catch {
    return null
  }
}
