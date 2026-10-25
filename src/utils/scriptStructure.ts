import type { ScriptLine } from "../types"
import { getHeadingLevel, isHeadingSpeaker, isNoteSpeaker } from "./lineTypes"

export type ScriptBlock = { id: string; start: number; end: number; kind: "heading" | "menu"; level: number; options: number[]; complete: boolean }
export type StructureIssue = { line: number; message: string; warning?: boolean }
export type ScriptStructure = { blocks: ScriptBlock[]; issues: StructureIssue[] }

export function parseScriptStructure(lines: ScriptLine[]): ScriptStructure {
  const blocks: ScriptBlock[] = []
  const issues: StructureIssue[] = []
  const stack: ScriptBlock[] = []
  const headings: ScriptBlock[] = []
  const issue = (index: number, message: string) => issues.push({ line: index + 1, message })
  lines.forEach((line, index) => {
    const level = getHeadingLevel(line.speaker)
    if (level) {
      while (headings.length && headings[headings.length - 1].level >= level) headings.pop()!.end = index - 1
      const heading: ScriptBlock = { id: line.id, start: index, end: lines.length - 1, kind: "heading", level, options: [], complete: true }
      blocks.push(heading)
      headings.push(heading)
    }
    const speaker = line.speaker.trim()
    if (speaker === "#menu") {
      if (stack.length) {
        issue(index, "不支持嵌套 Menu")
        stack.forEach((block) => { block.complete = false })
      }
      const block: ScriptBlock = { id: line.id, start: index, end: index, kind: "menu", level: 0, options: [], complete: stack.length === 0 }
      blocks.push(block)
      stack.push(block)
    } else if (speaker === "#option") {
      if (!stack.length) issue(index, "#option 位于 Menu 外")
      else stack[stack.length - 1].options.push(index)
      if (!line.content.trim()) issue(index, "选项文字为空")
    } else if (speaker === "#endmenu") {
      const block = stack.pop()
      if (!block) issue(index, "#endmenu 位于 Menu 外")
      else {
        block.end = index
        if (!block.options.length) issue(block.start, "Menu 内没有 Option")
      }
    } else if (stack.length && !stack[stack.length - 1].options.length && line.content.trim() && !isNoteSpeaker(speaker) && !isHeadingSpeaker(speaker)) {
      issue(index, "Menu 剧情必须放在 #option 之后")
    }
  })
  stack.forEach((block) => { block.complete = false; issue(block.start, "Menu 缺少 #endmenu") })
  blocks.filter((block) => block.kind === "menu" && block.complete).forEach((block) => {
    block.options.forEach((index, position) => {
      const end = block.options[position + 1] ?? block.end
      const executable = lines.slice(index + 1, end).some((line) => line.content.trim() && !isNoteSpeaker(line.speaker) && !isHeadingSpeaker(line.speaker))
      if (!executable) issues.push({ line: index + 1, message: "选项没有可执行剧情，将导出 pass", warning: true })
    })
  })
  return { blocks, issues }
}

export function hiddenLineIds(lines: ScriptLine[], blocks: ScriptBlock[], collapsed: Set<string>) {
  const hidden = new Set<string>()
  blocks.forEach((block) => {
    if (!block.complete || !collapsed.has(block.id)) return
    for (let index = block.start + 1; index <= block.end; index++) hidden.add(lines[index].id)
  })
  return hidden
}

export function revealLineIndices(blocks: ScriptBlock[], collapsed: Set<string>, indices: number[]) {
  const next = new Set([...collapsed].filter((id) => !blocks.some((block) => block.id === id && indices.some((index) => block.start < index && index <= block.end))))
  return next.size === collapsed.size ? collapsed : next
}
