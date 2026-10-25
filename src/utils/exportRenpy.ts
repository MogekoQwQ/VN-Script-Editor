import type { CharacterProfile, VNProject } from "../types"
import { parseScriptStructure } from "./scriptStructure"
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
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r\n|\r|\n/g, "\\n")
}

function exportFlat(project: VNProject, options: RenpyExportOptions) {
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

      output.push(...content.split(/\r?\n/).map((part) => `# ${part}`))

      if (options.includeBlankLinesAroundHeadings) {
        output.push("")
      }

      return
    }

    if (isNoteSpeaker(speaker)) {
      output.push(...content.split(/\r?\n/).map((part) => `# ${part}`))
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

export function exportRenpy(project: VNProject, options: RenpyExportOptions) {
  const { blocks, issues } = parseScriptStructure(project.lines)
  const errors = issues.filter((issue) => !issue.warning)
  if (errors.length) throw new Error(errors.map((issue) => `第 ${issue.line} 行：${issue.message}`).join("\n"))
  const menus = new Map(blocks.filter((block) => block.kind === "menu").map((block) => [block.start, block]))
  const output: string[] = []
  const flat = (start: number, end: number) => exportFlat({ ...project, lines: project.lines.slice(start, end) }, options)
  for (let index = 0; index < project.lines.length; index++) {
    const menu = menus.get(index)
    if (!menu) { const text = flat(index, index + 1); if (text) output.push(text); continue }
    output.push("menu:")
    const prompt = project.lines[index].content
    if (prompt.trim()) output.push(`    "${escapeRenpyText(prompt)}"`)
    const preamble = flat(index + 1, menu.options[0] ?? menu.end)
    if (preamble) output.push(...preamble.split("\n").map((part) => `    ${part}`))
    menu.options.forEach((option, position) => {
      output.push(`    "${escapeRenpyText(project.lines[option].content)}":`)
      const end = menu.options[position + 1] ?? menu.end
      const body = flat(option + 1, end)
      if (body) output.push(...body.split("\n").map((part) => `        ${part}`))
      if (issues.some((issue) => issue.warning && issue.line === option + 1)) output.push("        pass")
    })
    index = menu.end
  }
  return output.join("\n")
}
