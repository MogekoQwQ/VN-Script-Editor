import type { VNProject } from "../types"

export const MAX_HISTORY = 100

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
