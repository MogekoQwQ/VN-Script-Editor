import { useEffect, useLayoutEffect, useState, type ReactNode, type Ref } from "react"
import type { CharacterMap, CharacterProfile, ScriptLine, VNProject } from "../types"
import { AboutPanel } from "./AboutPanel"
import { CharacterMapEditor } from "./CharacterMapEditor"
import { ExportPanel } from "./ExportPanel"
import { PlainTextInsertPanel, type PlainTextInsertMode } from "./PlainTextInsertPanel"
import { SavePanel } from "./SavePanel"
import { SearchReplacePanel } from "./SearchReplacePanel"
import { StatsPanel } from "./StatsPanel"

type RightPanelProps = {
  isCollapsed: boolean
  searchFocusRequest: number
  onToggleCollapsed: () => void
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
  onReorderCharacters: (nextOrder: string[]) => void
  onBeginCharacterEdit: () => void
  onEndCharacterEdit: () => void
  saveStatusText: string
  onProjectTitleChange: (title: string) => void
  searchQuery: string
  replaceValue: string
  searchMatchCount: number
  currentSearchMatchIndex: number
  searchStatusText: string
  searchInputRef?: Ref<HTMLInputElement>
  onExportProjectFile: () => void
  onImportProjectFile: (file: File) => void | Promise<void>
  onInsertPlainText: (payload: {
    lines: ScriptLine[]
    characterIdHints: Record<string, string>
    insertMode: PlainTextInsertMode
  }) => boolean
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

type SectionKey =
  | "save"
  | "characters"
  | "settings"
  | "plainTextInsert"
  | "search"
  | "export"
  | "about"

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
  plainTextInsert: "从纯文本插入",
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
  isCollapsed,
  searchFocusRequest,
  onToggleCollapsed,
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
  onReorderCharacters,
  onBeginCharacterEdit,
  onEndCharacterEdit,
  saveStatusText,
  onProjectTitleChange,
  searchQuery,
  replaceValue,
  searchMatchCount,
  currentSearchMatchIndex,
  searchStatusText,
  searchInputRef,
  onExportProjectFile,
  onImportProjectFile,
  onInsertPlainText,
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
    plainTextInsert: false,
    search: false,
    export: false,
    about: false
  })

  useLayoutEffect(() => {
    if (searchFocusRequest > 0) setOpenSections((sections) => ({ ...sections, search: true }))
  }, [searchFocusRequest])

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
    <aside className={`panel panel-sidebar right-panel ${isCollapsed ? "is-collapsed" : ""}`}>
      <div className="panel-header panel-collapse-header"><h2>工具</h2>
        <button type="button" className="panel-collapse-toggle" aria-label={isCollapsed ? "展开右侧面板" : "收起右侧面板"} aria-expanded={!isCollapsed} aria-controls="sidebar-content" onClick={onToggleCollapsed}>
          <span className="collapse-arrow-side" aria-hidden="true">{isCollapsed ? "‹" : "›"}</span><span className="collapse-arrow-top" aria-hidden="true">{isCollapsed ? "▾" : "▴"}</span><span className="panel-restore-label">工具</span>
        </button>
      </div>
      <div id="sidebar-content" className="sidebar-contents" hidden={isCollapsed}>
      <Section title={LABELS.save} open={openSections.save} onToggle={() => toggleSection("save")}>
        <SavePanel
          projectTitle={project.title}
          statusText={saveStatusText}
          onProjectTitleChange={onProjectTitleChange}
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
          onReorderCharacters={onReorderCharacters}
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
        title={LABELS.plainTextInsert}
        open={openSections.plainTextInsert}
        onToggle={() => toggleSection("plainTextInsert")}
      >
        <PlainTextInsertPanel onInsert={onInsertPlainText} />
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
      </div>
    </aside>
  )
}
