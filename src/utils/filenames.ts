const FALLBACK_PROJECT_NAME = "\u672A\u547D\u540D\u9879\u76EE"

export function getDisplayProjectName(title: string | undefined): string {
  return title?.trim() || FALLBACK_PROJECT_NAME
}

export function sanitizeFilenamePart(title: string | undefined): string {
  return (
    getDisplayProjectName(title)
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, " ")
      .slice(0, 80) || FALLBACK_PROJECT_NAME
  )
}

export function buildTimestampedFilename(title: string | undefined, suffix: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  return `${sanitizeFilenamePart(title)}_${timestamp}${suffix}`
}
