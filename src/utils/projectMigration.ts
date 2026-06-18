import { APP_NAME, APP_VERSION } from "../constants/app"
import { DEFAULT_CHARACTER_COLOR } from "./colors"
import type {
  CharacterMap,
  CharacterProfile,
  ExportSettings,
  ProjectMeta,
  ScriptLine,
  VNProject
} from "../types"

type LegacyCharacterValue = string | CharacterProfile

type LegacyProject = Partial<Omit<VNProject, "characters" | "lines" | "settings">> & {
  characters?: Record<string, LegacyCharacterValue>
  lines?: ScriptLine[]
  settings?: Partial<ExportSettings>
  meta?: Partial<ProjectMeta>
}

const defaultSettings: ExportSettings = {
  exportHeadings: true,
  indent: "",
  readingWrapChars: 32
}

function normalizeProjectMeta(meta: Partial<ProjectMeta> | undefined) {
  return {
    appName: typeof meta?.appName === "string" ? meta.appName : APP_NAME,
    appVersion: typeof meta?.appVersion === "string" ? meta.appVersion : APP_VERSION,
    createdAt: typeof meta?.createdAt === "string" ? meta.createdAt : undefined,
    updatedAt: typeof meta?.updatedAt === "string" ? meta.updatedAt : undefined
  }
}

export function clampReadingWrapChars(value: number) {
  if (Number.isNaN(value)) {
    return 32
  }

  return Math.min(60, Math.max(16, Math.round(value)))
}

export function normalizeCharacterProfile(value: LegacyCharacterValue): CharacterProfile {
  if (typeof value === "string") {
    return {
      id: value,
      color: DEFAULT_CHARACTER_COLOR
    }
  }

  return {
    id: typeof value?.id === "string" ? value.id : "",
    color: typeof value?.color === "string" ? value.color : DEFAULT_CHARACTER_COLOR
  }
}

export function normalizeCharacterMap(
  characters: Record<string, LegacyCharacterValue> | undefined
): CharacterMap {
  if (!characters || typeof characters !== "object") {
    return {}
  }

  return Object.fromEntries(
    Object.entries(characters).map(([displayName, value]) => [
      displayName,
      normalizeCharacterProfile(value)
    ])
  )
}

function normalizeLines(lines: ScriptLine[] | undefined) {
  if (!Array.isArray(lines)) {
    return []
  }

  return lines.map((line, index) => ({
    id: typeof line?.id === "string" && line.id ? line.id : `line_${index + 1}`,
    speaker: typeof line?.speaker === "string" ? line.speaker : "",
    content: typeof line?.content === "string" ? line.content : ""
  }))
}

export function migrateProject(project: LegacyProject): VNProject {
  return {
    version: typeof project?.version === "number" ? project.version : 1,
    title: typeof project?.title === "string" ? project.title : "",
    characters: normalizeCharacterMap(project.characters),
    lines: normalizeLines(project.lines),
    settings: {
      ...defaultSettings,
      ...project.settings,
      readingWrapChars: clampReadingWrapChars(
        Number(project.settings?.readingWrapChars ?? defaultSettings.readingWrapChars)
      )
    },
    meta: normalizeProjectMeta(project.meta)
  }
}
