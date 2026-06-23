export type CharacterProfile = {
  id: string
  color: string
}

export type CharacterMap = {
  [displayName: string]: CharacterProfile
}

export type ScriptLine = {
  id: string
  speaker: string
  content: string
}

export type ExportSettings = {
  exportHeadings: boolean
  indent: string
  readingWrapChars: number
  editorFontSize: number
  characterOrder?: string[]
}

export type ProjectMeta = {
  appName?: string
  appVersion?: string
  createdAt?: string
  updatedAt?: string
}

export type VNProject = {
  version: number
  title: string
  characters: CharacterMap
  lines: ScriptLine[]
  settings: ExportSettings
  meta?: ProjectMeta
}
