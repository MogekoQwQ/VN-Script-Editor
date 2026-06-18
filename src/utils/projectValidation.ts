import type { ScriptLine } from "../types"

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isScriptLineLike(value: unknown): value is Partial<ScriptLine> {
  return isObjectLike(value)
}

export function validateProjectLike(value: unknown): boolean {
  if (!isObjectLike(value)) {
    return false
  }

  if (!Array.isArray(value.lines)) {
    return false
  }

  if (value.characters !== undefined && !isObjectLike(value.characters)) {
    return false
  }

  if (value.settings !== undefined && !isObjectLike(value.settings)) {
    return false
  }

  return value.lines.every((line) => isScriptLineLike(line))
}
