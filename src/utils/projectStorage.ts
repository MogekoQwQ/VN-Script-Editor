import type { VNProject } from "../types"

export const STORAGE_KEY = "vn-script-editor-current-project"

export function saveProjectToLocal(project: VNProject): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
    return true
  } catch {
    return false
  }
}

export function loadProjectFromLocal(): VNProject | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return null
    }

    return JSON.parse(raw) as VNProject
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore secondary storage failures.
    }

    return null
  }
}

export function clearLocalProject(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY)
    return true
  } catch {
    return false
  }
}
