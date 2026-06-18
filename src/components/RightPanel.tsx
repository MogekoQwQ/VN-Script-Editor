import { useEffect, useState, type ReactNode, type Ref } from "react"
import type { CharacterMap, CharacterProfile, VNProject } from "../types"
import { AboutPanel } from "./AboutPanel"
import { CharacterMapEditor } from "./CharacterMapEditor"
import { ExportPanel } from "./ExportPanel"
import { SavePanel } from "./SavePanel"
import { SearchReplacePanel } from "./SearchReplacePanel"
import { StatsPanel } from "./StatsPanel"

type RightPanelProps = {
  project: VNProject
  activeSpeakers: string[]
  characters: CharacterMap
  typewriterMode: boolean
  onTypewriterModeChange: (enabled: boolean) => void
  onReadingWrapCharsChange: (value: number) => void
  onEditorFontSizeChange: (value: number) => void
  onExportHeadingsChange: (enabled: boolean) => void
  onRenameCharacter: (currentName: string, nextName: string) => boolean
  onUpdateCharacter: (
    displayName: string,
    patch: Partial<CharacterProfile>,
    mode?: "live" | "commit"
  ) => void
  onBeginCharacterEdit: () => void
  onEndCharacterEdit: () => void
  saveStatusText: string
  searchQuery: string
  replaceValue: string
  searchMatchCount: number
  currentSearchMatchIndex: number
  searchStatusText: string
  searchInputRef?: Ref<HTMLInputElement>
  onExportProjectFile: () => void
  onImportProjectFile: (file: File) => void | Promise<void>
  onCreateBlankProject: () => void
  onResetToDefaultProject: () => void
  onClearLocalProject: () => void
  onSearchQueryChange: (value: string) => void
  onReplaceValueChange: (value: string) => void
  onPreviousMatch: () => void
  onNextMatch: () => void
  onReplaceCurrent: () => void
  onReplaceAll: () => void
  onSearchFocusChange: (focused: boolean) => void
}

type SectionKey = "save" | "characters" | "settings" | "search" | "export" | "about"

type SectionProps = {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}

const LABELS = {
  save: "保存",
  characters: "角色映射",
  settings: "写作设置",
  search: "查找替换",
  export: "导出",
  about: "关于",
  typewriterMode: "打字机模式",
  readingWrap: "每行字数",
  editorFontSize: "文字大小"
}

function Section({ title, open, onToggle, children }: SectionProps) {
  return (
    <section className="panel-section">
      <button type="button" className="panel-section-header" onClick={onToggle}>
        <span className="panel-section-caret" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
        <span>{title}</span>
      </button>

      {open ? <div className="panel-section-body">{children}</div> : null}
    </section>
  )
}

export function RightPanel({
  project,
  activeSpeakers,
  characters,
  typewriterMode,
  onTypewriterModeChange,
  onReadingWrapCharsChange,
  onEditorFontSizeChange,
  onExportHeadingsChange,
  onRenameCharacter,
  onUpdateCharacter,
  onBeginCharacterEdit,
  onEndCharacterEdit,
  saveStatusText,
  searchQuery,
  replaceValue,
  searchMatchCount,
  currentSearchMatchIndex,
  searchStatusText,
  searchInputRef,
  onExportProjectFile,
  onImportProjectFile,
  onCreateBlankProject,
  onResetToDefaultProject,
  onClearLocalProject,
  onSearchQueryChange,
  onReplaceValueChange,
  onPreviousMatch,
  onNextMatch,
  onReplaceCurrent,
  onReplaceAll,
  onSearchFocusChange
}: RightPanelProps) {
  const [readingWrapInput, setReadingWrapInput] = useState(
    String(project.settings.readingWrapChars ?? 32)
  )
  const [editorFontSizeInput, setEditorFontSizeInput] = useState(
    String(project.settings.editorFontSize ?? 16)
  )
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    save: true,
    characters: true,
    settings: true,
    search: false,
    export: false,
    about: false
  })

  useEffect(() => {
    setReadingWrapInput(String(project.settings.readingWrapChars ?? 32))
  }, [project.settings.readingWrapChars])

  useEffect(() => {
    setEditorFontSizeInput(String(project.settings.editorFontSize ?? 16))
  }, [project.settings.editorFontSize])

  const commitReadingWrapInput = () => {
    const trimmedValue = readingWrapInput.trim()

    if (trimmedValue === "") {
      setReadingWrapInput(String(project.settings.readingWrapChars ?? 32))
      return
    }

    onReadingWrapCharsChange(Number(trimmedValue))
  }

  const commitEditorFontSizeInput = () => {
    const trimmedValue = editorFontSizeInput.trim()

    if (trimmedValue === "") {
      setEditorFontSizeInput(String(project.settings.editorFontSize ?? 16))
      return
    }

    onEditorFontSizeChange(Number(trimmedValue))
  }

  const toggleSection = (section: SectionKey) => {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section]
    }))
  }

  return (
    <aside className="panel panel-sidebar right-panel">
      <Section title={LABELS.save} open={openSections.save} onToggle={() => toggleSection("save")}>
        <SavePanel
          statusText={saveStatusText}
          onExportProjectFile={onExportProjectFile}
          onImportProjectFile={onImportProjectFile}
          onCreateBlankProject={onCreateBlankProject}
          onResetToDefaultProject={onResetToDefaultProject}
          onClearLocalProject={onClearLocalProject}
        />
      </Section>

      <Section
        title={LABELS.characters}
        open={openSections.characters}
        onToggle={() => toggleSection("characters")}
      >
        <CharacterMapEditor
          activeSpeakers={activeSpeakers}
          characters={characters}
          onRenameCharacter={onRenameCharacter}
          onUpdateCharacter={onUpdateCharacter}
          onBeginEdit={onBeginCharacterEdit}
          onEndEdit={onEndCharacterEdit}
        />
      </Section>

      <Section
        title={LABELS.settings}
        open={openSections.settings}
        onToggle={() => toggleSection("settings")}
      >
        <label className="panel-field">
          <span className="panel-field-label">{LABELS.typewriterMode}</span>
          <input
            type="checkbox"
            checked={typewriterMode}
            onChange={(event) => onTypewriterModeChange(event.target.checked)}
          />
        </label>

        <label className="panel-field">
          <span className="panel-field-label">{LABELS.readingWrap}</span>
          <div className="panel-inline-control">
            <input
              className="reading-wrap-input"
              type="number"
              min={16}
              max={60}
              step={1}
              value={readingWrapInput}
              onChange={(event) => setReadingWrapInput(event.target.value)}
              onBlur={commitReadingWrapInput}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  commitReadingWrapInput()
                  event.currentTarget.blur()
                }
              }}
            />
          </div>
        </label>

        <label className="panel-field">
          <span className="panel-field-label">{LABELS.editorFontSize}</span>
          <div className="panel-inline-control">
            <input
              className="reading-wrap-input"
              type="number"
              min={11}
              max={22}
              step={1}
              value={editorFontSizeInput}
              onChange={(event) => setEditorFontSizeInput(event.target.value)}
              onBlur={commitEditorFontSizeInput}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  commitEditorFontSizeInput()
                  event.currentTarget.blur()
                }
              }}
            />
            <span className="panel-inline-suffix">px</span>
          </div>
        </label>

        <StatsPanel project={project} />
      </Section>

      <Section
        title={LABELS.search}
        open={openSections.search}
        onToggle={() => toggleSection("search")}
      >
        <SearchReplacePanel
          searchQuery={searchQuery}
          replaceValue={replaceValue}
          matchCount={searchMatchCount}
          currentMatchIndex={currentSearchMatchIndex}
          statusText={searchStatusText}
          searchInputRef={searchInputRef}
          onSearchQueryChange={onSearchQueryChange}
          onReplaceValueChange={onReplaceValueChange}
          onPreviousMatch={onPreviousMatch}
          onNextMatch={onNextMatch}
          onReplaceCurrent={onReplaceCurrent}
          onReplaceAll={onReplaceAll}
          onFocusChange={onSearchFocusChange}
        />
      </Section>

      <Section
        title={LABELS.export}
        open={openSections.export}
        onToggle={() => toggleSection("export")}
      >
        <ExportPanel project={project} onExportHeadingsChange={onExportHeadingsChange} />
      </Section>

      <Section
        title={LABELS.about}
        open={openSections.about}
        onToggle={() => toggleSection("about")}
      >
        <AboutPanel />
      </Section>
    </aside>
  )
}
