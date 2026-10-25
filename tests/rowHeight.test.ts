import assert from "node:assert/strict"
import { estimateRowHeight } from "../src/utils/rowHeight"

const line = { id: "test", speaker: "", content: "中文测试".repeat(30) }
const height = (width: number, size = 16) => estimateRowHeight(line, size, 32, width)
assert(height(200) > height(500), "Narrow viewports must estimate more wrapped rows")
assert(height(500, 22) > height(500, 16), "Larger fonts must reserve more space")
assert(estimateRowHeight({ ...line, content: "正文\n\n" }, 16, 32, 500) > estimateRowHeight({ ...line, content: "正文" }, 16, 32, 500), "Manual blank lines contribute to estimated height")
for (const speaker of ["", "#", "#1", "#2", "#3", "#4", "#menu", "#endmenu"]) {
  assert(estimateRowHeight({ ...line, speaker, content: "" }, 16, 32, 500) >= 27.2)
}
console.log("Virtual row estimates cover wrapping, font changes, manual newlines and reserved markers.")
