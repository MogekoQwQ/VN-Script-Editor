import assert from "node:assert/strict"
import { defaultProject } from "../src/data/defaultProject"
import { resolveHistoryFocus } from "../src/utils/history"

const project = (ids: string[]) => ({ ...defaultProject, lines: ids.map((id) => ({ id, speaker: "", content: id })) })
const before = project(["a", "b", "c", "d"])
const inserted = project(["a", "b", "x", "y", "c", "d"])
assert.deepEqual(resolveHistoryFocus(before, inserted, "y", { anchorLineId: "b", focusLineId: "b" }), { anchorLineId: "b", focusLineId: "b" }, "Undo insertion restores the original insertion anchor")
assert.deepEqual(resolveHistoryFocus(inserted, before, "b", { anchorLineId: "x", focusLineId: "y" }), { anchorLineId: "x", focusLineId: "y" }, "Redo restores the inserted range")
assert.equal(resolveHistoryFocus(before, inserted, "y")?.focusLineId, "d", "Missing history metadata stays near the old index instead of jumping to the first row")
assert.equal(resolveHistoryFocus(before, inserted, "c")?.focusLineId, "c")
assert.deepEqual(resolveHistoryFocus(before, inserted, "b", { anchorLineId: "missing", focusLineId: "b" }), { anchorLineId: "b", focusLineId: "b" })
assert.equal(resolveHistoryFocus(project([]), before, "c"), null)
const deleted = project(["a", "b"])
assert.equal(resolveHistoryFocus(deleted, before, "d")?.focusLineId, "b", "Deleting the document tail keeps the nearest surviving row")
assert.equal(resolveHistoryFocus(before, deleted, "b", { anchorLineId: "c", focusLineId: "d" })?.focusLineId, "d", "Undo deletion restores the previous focus endpoint")
assert.equal(resolveHistoryFocus(project(["blank"]), before, "d")?.focusLineId, "blank", "Deleting all content focuses the remaining blank row")
console.log("History focus restoration and nearby fallback passed.")
