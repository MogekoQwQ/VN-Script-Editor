import type { VNProject } from "../types"
import type { LineRangeSelection } from "./lineOperations"

export const MAX_HISTORY = 100

export function resolveHistoryFocus(
  restored: VNProject,
  previous: VNProject,
  currentId: string | null,
  savedRange?: LineRangeSelection
): LineRangeSelection | null {
  const ids = new Set(restored.lines.map((line) => line.id))
  const previousIndex = previous.lines.findIndex((line) => line.id === currentId)
  const focusId = (savedRange && ids.has(savedRange.focusLineId) ? savedRange.focusLineId : null)
    ?? (currentId && ids.has(currentId) ? currentId : null)
    ?? restored.lines[Math.min(Math.max(previousIndex, 0), restored.lines.length - 1)]?.id
  return focusId ? {
    anchorLineId: savedRange && ids.has(savedRange.anchorLineId) ? savedRange.anchorLineId : focusId,
    focusLineId: focusId
  } : null
}

export function cloneProject(project: VNProject): VNProject {
  return JSON.parse(JSON.stringify(project)) as VNProject
}

export function areProjectsEqual(left: VNProject, right: VNProject) {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function pushHistorySnapshot(history: VNProject[], snapshot: VNProject) {
  const nextHistory = [...history, snapshot]

  if (nextHistory.length <= MAX_HISTORY) {
    return nextHistory
  }

  return nextHistory.slice(nextHistory.length - MAX_HISTORY)
}
