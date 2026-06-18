import type { CharacterProfile, VNProject } from "../types"
import { isHeadingSpeaker, isNarrationSpeaker, isNoteSpeaker, normalizeSpeaker } from "./lineTypes"

export type RenpyExportOptions = {
  exportHeadings: boolean
  includeBlankLinesAroundHeadings: boolean
}

function resolveCharacterId(value: string | CharacterProfile | undefined, fallback: string) {
  if (typeof value === "string") {
    return value || fallback
  }

  return value?.id || fallback
}

export function escapeRenpyText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

export function exportRenpy(project: VNProject, options: RenpyExportOptions) {
  const output: string[] = []

  project.lines.forEach((line) => {
    const speaker = normalizeSpeaker(line.speaker)
    const rawContent = line.content
    const content = rawContent.trim()

    if (!content) {
      return
    }

    if (isHeadingSpeaker(speaker)) {
      if (!options.exportHeadings) {
        return
      }

      const lastLine = output[output.length - 1]

      if (options.includeBlankLinesAroundHeadings && output.length > 0 && lastLine !== "") {
        output.push("")
      }

      output.push(`# ${content}`)

      if (options.includeBlankLinesAroundHeadings) {
        output.push("")
      }

      return
    }

    if (isNoteSpeaker(speaker)) {
      output.push(`# ${content}`)
      return
    }

    if (isNarrationSpeaker(speaker)) {
      output.push(`"${escapeRenpyText(rawContent)}"`)
      return
    }

    const characterId = resolveCharacterId(project.characters[speaker], speaker)
    output.push(`${characterId} "${escapeRenpyText(rawContent)}"`)
  })

  while (output[0] === "") {
    output.shift()
  }

  while (output.length > 0 && output[output.length - 1] === "") {
    output.pop()
  }

  return output.join("\n")
}
