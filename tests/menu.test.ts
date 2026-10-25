import assert from "node:assert/strict"
import { parseScriptStructure, hiddenLineIds, revealLineIndices } from "../src/utils/scriptStructure"
import { exportRenpy } from "../src/utils/exportRenpy"
import { isRoleSpeaker } from "../src/utils/lineTypes"
import { parsePlainTextToLines } from "../src/utils/importPlainText"
import { defaultProject } from "../src/data/defaultProject"

assert.equal(parseScriptStructure(defaultProject.lines).issues.length, 0)
assert.equal(new Set(defaultProject.lines.map((line) => line.id)).size, defaultProject.lines.length)
assert(exportRenpy(defaultProject, { exportHeadings: true, includeBlankLinesAroundHeadings: false }).includes("menu:"))

const lines = [
  ["#1", "第一幕"], ["#2", "导入"], ["#3", "晚上"],
  ["#menu", "联系谁？"], ["#option", "兰恩"], ["兰恩", '你好 "朋友"\n第二行'],
  ["#option", "瑠璃"], ["#", "空选项"], ["#endmenu", ""],
  ["", "共通剧情"], ["#3", "第二天"], ["", "旁白"],
  ["#2", "发展"], ["#4", "细节"], ["", "细节正文"], ["#1", "第二幕"]
].map(([speaker, content], index) => ({ id: String(index), speaker, content }))
const project = { version: 1, title: "测试", lines, characters: { "兰恩": { id: "lan", color: "#000000" } }, settings: { exportHeadings: true, indent: "", readingWrapChars: 32, editorFontSize: 16 } }
const options = { exportHeadings: true, includeBlankLinesAroundHeadings: false }
const structure = parseScriptStructure(lines)
assert.equal(structure.issues.filter((issue) => !issue.warning).length, 0)
assert.equal(structure.blocks.find((block) => block.id === "0")?.end, 14)
assert.equal(structure.blocks.find((block) => block.id === "1")?.end, 11)
assert.equal(structure.blocks.find((block) => block.id === "2")?.end, 9)
assert.equal(structure.blocks.find((block) => block.id === "13")?.end, 14)
const collapsed = new Set(["1", "3"])
assert(hiddenLineIds(lines, structure.blocks, collapsed).has("8"))
collapsed.delete("1")
const hidden = hiddenLineIds(lines, structure.blocks, collapsed)
assert(hidden.has("8"))
assert(!hidden.has("9"))
assert(!hidden.has("3"))
const ancestors = new Set(["0", "1", "2", "3", "13"])
assert.deepEqual([...revealLineIndices(structure.blocks, ancestors, [4])], ["13"])
assert.deepEqual([...revealLineIndices(structure.blocks, ancestors, [3])], ["3", "13"])
assert.equal(revealLineIndices(structure.blocks, collapsed, [0]), collapsed, "Visible navigation must not trigger an unnecessary fold-state render")
const output = exportRenpy(project, options)
assert(output.includes('menu:\n    "联系谁？"\n    "兰恩":\n        lan "你好 \\"朋友\\"\\n第二行"'))
assert(output.includes('    "瑠璃":\n        # 空选项\n        pass'))
assert(output.includes('\n"共通剧情"'))
for (const speaker of ["#menu", "#option", "#endmenu"]) assert(!isRoleSpeaker(speaker))
for (const bad of [
  [["#menu", ""]], [["#option", "x"]], [["#endmenu", ""]],
  [["#menu", ""], ["#endmenu", ""]],
  [["#menu", ""], ["#option", ""], ["#endmenu", ""]],
  [["#menu", ""], ["#menu", ""], ["#endmenu", ""], ["#endmenu", ""]]
]) {
  const badLines = bad.map(([speaker, content], index) => ({ id: String(index), speaker, content }))
  assert.throws(() => exportRenpy({ ...project, lines: badLines }, options), /第 \d+ 行/)
  const parsed = parseScriptStructure(badLines)
  if (parsed.blocks.some((block) => !block.complete)) assert.equal(hiddenLineIds(badLines, parsed.blocks, new Set(["0"])).size, 0)
}
const inserted = parsePlainTextToLines("#menu 提示\n#option 选项\n#endmenu")
assert.deepEqual(inserted.lines.map((line) => line.speaker), ["#menu", "#option", "#endmenu"])
console.log("Menu parsing, validation, export, heading ranges, nested folding and plain-text markers passed.")
