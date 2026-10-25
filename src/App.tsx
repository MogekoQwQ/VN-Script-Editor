import { useEffect, useMemo, useRef, useState } from "react"
import { APP_NAME, APP_VERSION } from "./constants/app"
import { Editor, type FocusField, type FocusRequest, type ScrollRequest } from "./components/Editor"
import { Outline } from "./components/Outline"
import { RightPanel } from "./components/RightPanel"
import type { PlainTextInsertMode } from "./components/PlainTextInsertPanel"
import { defaultProject } from "./data/defaultProject"
import type { CharacterMap, CharacterProfile, ScriptLine, VNProject } from "./types"
import { areProjectsEqual, cloneProject, pushHistorySnapshot } from "./utils/history"
import { createLineId } from "./utils/ids"
import {
  pasteClipboardLines,
  getLineRange,
  type LineRangeSelection
} from "./utils/lineOperations"
import {
  readExternalPlainText,
  serializeLinesForPlainText,
  writeLinesToSystemClipboard
} from "./utils/clipboard"
import {
  clampEditorFontSize,
  clampReadingWrapChars,
  migrateProject
} from "./utils/projectMigration"
import {
  clearLocalProject,
  loadProjectFromLocal,
  saveProjectToLocal
} from "./utils/projectStorage"
import { validateProjectLike } from "./utils/projectValidation"
import { buildTimestampedFilename } from "./utils/filenames"
import { findMatches, type SearchMatch } from "./utils/search"
import {
  createDefaultCharacterProfile,
  ensureCharacterProfile,
  getActiveSpeakers,
  renameCharacterOrderEntry,
  resolveCharacterDisplayOrder
} from "./utils/characters"
import { isRoleSpeaker } from "./utils/lineTypes"

type SaveStatus = "idle" | "saving" | "saved" | "error"
type FocusTarget = FocusRequest | null
type ScrollTarget = ScrollRequest | null
type LineClipboard = {
  lines: ScriptLine[]
  plainText: string
}

type InitialProjectState = {
  project: VNProject
  restoredFromLocal: boolean
}

function createEmptyLine(): ScriptLine {
  return {
    id: createLineId(),
    speaker: "",
    content: ""
  }
}

function createBlankProject(): VNProject {
  const timestamp = new Date().toISOString()

  return {
    version: 1,
    title: "未命名项目",
    characters: {},
    lines: [createEmptyLine()],
    settings: {
      exportHeadings: true,
      indent: "",
      readingWrapChars: 32,
      editorFontSize: 16,
      characterOrder: []
    },
    meta: {
      appName: APP_NAME,
      appVersion: APP_VERSION,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  }
}

function stampProjectMeta(project: VNProject, timestamp = new Date().toISOString()): VNProject {
  return {
    ...project,
    meta: {
      appName: APP_NAME,
      appVersion: APP_VERSION,
      createdAt: project.meta?.createdAt ?? timestamp,
      updatedAt: timestamp
    }
  }
}

function ensureProjectHasLine(project: VNProject): VNProject {
  if (project.lines.length > 0) {
    return project
  }

  return {
    ...project,
    lines: [createEmptyLine()]
  }
}

function normalizeProjectData(raw: unknown): VNProject | null {
  if (!validateProjectLike(raw)) {
    return null
  }

  try {
    return ensureProjectHasLine(migrateProject(raw as VNProject))
  } catch {
    return null
  }
}

function loadInitialProjectState(): InitialProjectState {
  const localProject = loadProjectFromLocal()

  if (localProject) {
    const migratedProject = normalizeProjectData(localProject)

    if (migratedProject) {
      return {
        project: migratedProject,
        restoredFromLocal: true
      }
    }

    clearLocalProject()
  }

  return {
    project: ensureProjectHasLine(migrateProject(defaultProject)),
    restoredFromLocal: false
  }
}

function isEditableElement(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

function downloadBlob(content: BlobPart, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function replaceCurrentMatchValue(value: string, match: SearchMatch, replacement: string) {
  return `${value.slice(0, match.start)}${replacement}${value.slice(match.end)}`
}

function replaceAllOccurrences(value: string, query: string, replacement: string) {
  if (!query) {
    return {
      value,
      count: 0
    }
  }

  const lowerValue = value.toLowerCase()
  const lowerQuery = query.toLowerCase()
  let cursor = 0
  let replacedCount = 0
  let nextValue = ""

  while (cursor <= value.length - query.length) {
    const matchIndex = lowerValue.indexOf(lowerQuery, cursor)

    if (matchIndex < 0) {
      break
    }

    nextValue += value.slice(cursor, matchIndex)
    nextValue += replacement
    cursor = matchIndex + query.length
    replacedCount += 1
  }

  if (replacedCount === 0) {
    return {
      value,
      count: 0
    }
  }

  nextValue += value.slice(cursor)

  return {
    value: nextValue,
    count: replacedCount
  }
}

export default function App() {
  const initialProjectStateRef = useRef<InitialProjectState>(loadInitialProjectState())
  const [project, setProject] = useState<VNProject>(initialProjectStateRef.current.project)
  const [undoStack, setUndoStack] = useState<VNProject[]>([])
  const [redoStack, setRedoStack] = useState<VNProject[]>([])
  const initialLineId = initialProjectStateRef.current.project.lines[0]?.id ?? null
  const [activeLineId, setActiveLineId] = useState<string | null>(initialLineId)
  const [lastFocusedLineId, setLastFocusedLineId] = useState<string | null>(initialLineId)
  const [typewriterMode, setTypewriterMode] = useState(false)
  const [isOutlineCollapsed, setIsOutlineCollapsed] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [searchFocusRequest, setSearchFocusRequest] = useState(0)
  const [focusRequest, setFocusRequest] = useState<FocusTarget>(null)
  const [scrollRequest, setScrollRequest] = useState<ScrollTarget>(null)
  const [lineRangeSelection, setLineRangeSelection] = useState<LineRangeSelection | null>(
    initialLineId ? { anchorLineId: initialLineId, focusLineId: initialLineId } : null
  )
  const [lineClipboard, setLineClipboard] = useState<LineClipboard>({ lines: [], plainText: "" })
  const [isTextEditing, setIsTextEditing] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(
    initialProjectStateRef.current.restoredFromLocal ? "saved" : "idle"
  )
  const [saveStatusText, setSaveStatusText] = useState(
    initialProjectStateRef.current.restoredFromLocal
      ? "\u5df2\u6062\u590d\u672c\u5730\u9879\u76ee"
      : "\u672a\u4fdd\u5b58"
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [replaceValue, setReplaceValue] = useState("")
  const [currentSearchMatchIndex, setCurrentSearchMatchIndex] = useState(-1)
  const [searchStatusText, setSearchStatusText] = useState("")
  const [isSearchFocused, setIsSearchFocused] = useState(false)

  const projectRef = useRef(project)
  const undoStackRef = useRef(undoStack)
  const redoStackRef = useRef(redoStack)
  const lineRangeSelectionRef = useRef(lineRangeSelection)
  const activeLineIdRef = useRef(activeLineId)
  const lastFocusedLineIdRef = useRef(lastFocusedLineId)
  const lineClipboardRef = useRef(lineClipboard)
  const pendingEditSnapshotRef = useRef<VNProject | null>(null)
  const lastPersistedSnapshotRef = useRef<string | null>(
    initialProjectStateRef.current.restoredFromLocal
      ? JSON.stringify(initialProjectStateRef.current.project)
      : null
  )
  const autosaveSuspendedSnapshotRef = useRef<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const activeSpeakers = useMemo(() => getActiveSpeakers(project.lines), [project.lines])
  const orderedActiveSpeakers = useMemo(
    () => resolveCharacterDisplayOrder(activeSpeakers, project.settings.characterOrder),
    [activeSpeakers, project.settings.characterOrder]
  )
  const searchMatches = useMemo(() => {
    if (searchQuery.trim() === "") {
      return []
    }

    return findMatches(project.lines, searchQuery)
  }, [project.lines, searchQuery])
  const shouldShowSearchHighlight = isSearchFocused && searchQuery.trim() !== ""
  const currentSearchMatch =
    currentSearchMatchIndex >= 0 && currentSearchMatchIndex < searchMatches.length
      ? searchMatches[currentSearchMatchIndex]
      : null

  useEffect(() => {
    projectRef.current = project
  }, [project])

  useEffect(() => {
    undoStackRef.current = undoStack
  }, [undoStack])

  useEffect(() => {
    redoStackRef.current = redoStack
  }, [redoStack])

  useEffect(() => {
    lineRangeSelectionRef.current = lineRangeSelection
  }, [lineRangeSelection])

  useEffect(() => {
    activeLineIdRef.current = activeLineId
  }, [activeLineId])

  useEffect(() => {
    lastFocusedLineIdRef.current = lastFocusedLineId
  }, [lastFocusedLineId])

  useEffect(() => {
    lineClipboardRef.current = lineClipboard
  }, [lineClipboard])

  useEffect(() => {
    const lineIds = new Set(project.lines.map((line) => line.id))
    const fallbackLineId =
      (activeLineId && lineIds.has(activeLineId) ? activeLineId : null) ??
      (lastFocusedLineId && lineIds.has(lastFocusedLineId) ? lastFocusedLineId : null) ??
      project.lines[0]?.id ??
      null

    if (
      fallbackLineId &&
      (!lineRangeSelection ||
        !lineIds.has(lineRangeSelection.anchorLineId) ||
        !lineIds.has(lineRangeSelection.focusLineId))
    ) {
      setLineRangeSelection({ anchorLineId: fallbackLineId, focusLineId: fallbackLineId })
    }

    if (fallbackLineId && activeLineId !== fallbackLineId) {
      setActiveLineId(fallbackLineId)
    }

    if (fallbackLineId && lastFocusedLineId !== fallbackLineId) {
      setLastFocusedLineId(fallbackLineId)
    }

  }, [project.lines, activeLineId, lastFocusedLineId, lineRangeSelection])

  useEffect(() => {
    if (searchQuery === "" || searchMatches.length === 0) {
      setCurrentSearchMatchIndex(-1)
      return
    }

    setCurrentSearchMatchIndex((previousIndex) => {
      if (previousIndex < 0) {
        return 0
      }

      return Math.min(previousIndex, searchMatches.length - 1)
    })
  }, [searchMatches.length, searchQuery])

  useEffect(() => {
    const serializedProject = JSON.stringify(project)

    if (autosaveSuspendedSnapshotRef.current === serializedProject) {
      return
    }

    if (
      autosaveSuspendedSnapshotRef.current &&
      autosaveSuspendedSnapshotRef.current !== serializedProject
    ) {
      autosaveSuspendedSnapshotRef.current = null
    }

    if (lastPersistedSnapshotRef.current === serializedProject) {
      return
    }

    setSaveStatus("saving")
    setSaveStatusText("\u4fdd\u5b58\u4e2d")

    const timeoutId = window.setTimeout(() => {
      const persistedProject = stampProjectMeta(project)
      const didSave = saveProjectToLocal(persistedProject)

      if (didSave) {
        lastPersistedSnapshotRef.current = serializedProject
        setSaveStatus("saved")
        setSaveStatusText("\u5df2\u4fdd\u5b58")
      } else {
        setSaveStatus("error")
        setSaveStatusText("\u4fdd\u5b58\u5931\u8d25")
      }
    }, 700)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [project])

  const setProjectDirect = (nextProject: VNProject) => {
    projectRef.current = nextProject
    setProject(nextProject)
  }

  const setUndoHistory = (nextUndoStack: VNProject[]) => {
    undoStackRef.current = nextUndoStack
    setUndoStack(nextUndoStack)
  }

  const setRedoHistory = (nextRedoStack: VNProject[]) => {
    redoStackRef.current = nextRedoStack
    setRedoStack(nextRedoStack)
  }

  const beginProjectEdit = () => {
    if (!pendingEditSnapshotRef.current) {
      pendingEditSnapshotRef.current = cloneProject(projectRef.current)
    }
  }

  const finalizePendingEdit = () => {
    const beforeEditSnapshot = pendingEditSnapshotRef.current

    if (!beforeEditSnapshot) {
      return
    }

    pendingEditSnapshotRef.current = null

    if (areProjectsEqual(beforeEditSnapshot, projectRef.current)) {
      return
    }

    setUndoHistory(pushHistorySnapshot(undoStackRef.current, beforeEditSnapshot))
    setRedoHistory([])
  }

  const commitProject = (nextProject: VNProject, previousSnapshot?: VNProject) => {
    const beforeChange = previousSnapshot ?? cloneProject(projectRef.current)

    if (areProjectsEqual(beforeChange, nextProject)) {
      return
    }

    setUndoHistory(pushHistorySnapshot(undoStackRef.current, beforeChange))
    setRedoHistory([])
    setProjectDirect(nextProject)
  }

  const updateProjectLive = (updater: (currentProject: VNProject) => VNProject) => {
    const nextProject = updater(projectRef.current)

    if (nextProject !== projectRef.current) {
      setProjectDirect(nextProject)
    }
  }

  const commitProjectUpdate = (updater: (currentProject: VNProject) => VNProject) => {
    finalizePendingEdit()
    const beforeChange = cloneProject(projectRef.current)
    const nextProject = updater(projectRef.current)
    commitProject(nextProject, beforeChange)
  }

  const requestFocus = (lineId: string, field: FocusField) => {
    setActiveLineId(lineId)
    setLastFocusedLineId(lineId)
    setLineRangeSelection({ anchorLineId: lineId, focusLineId: lineId })
    setIsTextEditing(true)
    setFocusRequest({
      lineId,
      field,
      requestKey: createLineId()
    })
  }

  const requestScroll = (lineId: string) => {
    setScrollRequest({
      lineId,
      requestKey: createLineId()
    })
  }

  const setScriptFocus = (lineId: string) => {
    setActiveLineId(lineId)
    setLastFocusedLineId(lineId)
    setLineRangeSelection({ anchorLineId: lineId, focusLineId: lineId })
    setIsTextEditing(false)
  }

  const [editorSession, setEditorSession] = useState(0)
  const replaceProjectState = (nextProject: VNProject, saveMessage: string) => {
    setEditorSession((session) => session + 1)
    pendingEditSnapshotRef.current = null
    setProjectDirect(nextProject)
    setUndoHistory([])
    setRedoHistory([])
    setLineClipboard({ lines: [], plainText: "" })
    const firstLineId = nextProject.lines[0]?.id ?? null
    setActiveLineId(firstLineId)
    setLastFocusedLineId(firstLineId)
    setLineRangeSelection(firstLineId ? { anchorLineId: firstLineId, focusLineId: firstLineId } : null)
    setIsTextEditing(false)
    autosaveSuspendedSnapshotRef.current = null
    lastPersistedSnapshotRef.current = null
    setSearchStatusText("")
    setSaveStatus("saving")
    setSaveStatusText(saveMessage)
  }

  const focusSearchMatch = (match: SearchMatch | null) => {
    if (!match) {
      return
    }

    setScriptFocus(match.lineId)
    requestScroll(match.lineId)
  }

  const syncSearchAfterProjectChange = (statusText: string) => {
    const nextMatches = findMatches(projectRef.current.lines, searchQuery)

    if (nextMatches.length === 0) {
      setCurrentSearchMatchIndex(-1)
    } else {
      const nextIndex = Math.min(
        currentSearchMatchIndex >= 0 ? currentSearchMatchIndex : 0,
        nextMatches.length - 1
      )
      setCurrentSearchMatchIndex(nextIndex)
      focusSearchMatch(nextMatches[nextIndex])
    }

    setSearchStatusText(statusText)
  }

  const handleActiveLineChange = (lineId: string) => {
    setActiveLineId(lineId)
    setLastFocusedLineId(lineId)
  }

  const handleTextEditFocus = (lineId: string) => {
    setActiveLineId(lineId)
    setLastFocusedLineId(lineId)
    setLineRangeSelection({ anchorLineId: lineId, focusLineId: lineId })
    setIsTextEditing(true)
  }

  const handleBlankLineClick = (lineId: string) => {
    setScriptFocus(lineId)
  }

  const handleBeginRangeSelection = (lineId: string, extend: boolean) => {
    const anchorLineId = extend && lineRangeSelectionRef.current
      ? lineRangeSelectionRef.current.anchorLineId
      : lineId
    setLineRangeSelection({ anchorLineId, focusLineId: lineId })
    handleActiveLineChange(lineId)
    setIsTextEditing(false)
  }

  const handleExtendRangeSelection = (lineId: string) => {
    const currentSelection = lineRangeSelectionRef.current
    if (!currentSelection) return
    setLineRangeSelection({ ...currentSelection, focusLineId: lineId })
    handleActiveLineChange(lineId)
    setIsTextEditing(false)
  }

  const handleSpeakerChange = (lineId: string, speaker: string) => {
    updateProjectLive((currentProject) => ({
      ...currentProject,
      lines: currentProject.lines.map((line) =>
        line.id === lineId ? { ...line, speaker } : line
      )
    }))
  }

  const handleProjectTitleChange = (title: string) => {
    updateProjectLive((currentProject) => ({ ...currentProject, title }))
  }

  const handleSpeakerCommit = (lineId: string) => {
    updateProjectLive((currentProject) => {
      const targetLine = currentProject.lines.find((line) => line.id === lineId)

      if (!targetLine) {
        return currentProject
      }

      const normalizedSpeaker = targetLine.speaker.trim()
      const nextCharacters = ensureCharacterProfile(
        currentProject.characters,
        normalizedSpeaker
      )
      const needsSpeakerNormalization = targetLine.speaker !== normalizedSpeaker

      if (!needsSpeakerNormalization && nextCharacters === currentProject.characters) {
        return currentProject
      }

      return {
        ...currentProject,
        characters: nextCharacters,
        lines: currentProject.lines.map((line) =>
          line.id === lineId ? { ...line, speaker: normalizedSpeaker } : line
        )
      }
    })
  }

  const handleContentChange = (lineId: string, content: string) => {
    updateProjectLive((currentProject) => ({
      ...currentProject,
      lines: currentProject.lines.map((line) =>
        line.id === lineId ? { ...line, content } : line
      )
    }))
  }

  const handleInsertLineBelow = (
    lineId: string,
    focusField: FocusField,
    source: ScriptLine | null = null
  ) => {
    commitProjectUpdate((currentProject) => {
      const lineIndex = currentProject.lines.findIndex((line) => line.id === lineId)

      if (lineIndex === -1) {
        return currentProject
      }

      const newLine: ScriptLine = source
        ? {
            id: createLineId(),
            speaker: source.speaker,
            content: source.content
          }
        : createEmptyLine()

      const nextLines = [...currentProject.lines]
      nextLines.splice(lineIndex + 1, 0, newLine)

      requestFocus(newLine.id, focusField)
      return {
        ...currentProject,
        lines: nextLines
      }
    })
  }

  const removeLineIds = (lineIdsToRemove: string[]) => {
    commitProjectUpdate((currentProject) => {
      const lineIdSet = new Set(lineIdsToRemove)
      const firstRemovedIndex = currentProject.lines.findIndex((line) => lineIdSet.has(line.id))
      const remainingLines = currentProject.lines.filter((line) => !lineIdSet.has(line.id))

      if (remainingLines.length === 0) {
        const emptyLine = createEmptyLine()
        setScriptFocus(emptyLine.id)

        return {
          ...currentProject,
          lines: [emptyLine]
        }
      }

      const targetIndex =
        firstRemovedIndex < 0
          ? 0
          : Math.min(firstRemovedIndex, remainingLines.length - 1)
      const fallbackLine = remainingLines[targetIndex]

      if (fallbackLine) {
        setScriptFocus(fallbackLine.id)
      }

      return {
        ...currentProject,
        lines: remainingLines
      }
    })
  }

  const rangeVisibilityGuard = useRef<(() => boolean) | null>(null)
  const getRangeLines = () => getLineRange(projectRef.current.lines, lineRangeSelectionRef.current)

  const handleCopyRange = () => {
    if (rangeVisibilityGuard.current?.() === false) return
    const copiedLines = getRangeLines().map((line) => ({ ...line }))
    if (copiedLines.length === 0) return
    setLineClipboard({
      lines: copiedLines,
      plainText: serializeLinesForPlainText(copiedLines)
    })
    void writeLinesToSystemClipboard(copiedLines)
  }

  const removeCurrentRange = () => {
    if (rangeVisibilityGuard.current?.() === false) return
    const selectedLines = getRangeLines()
    if (selectedLines.length === 0) return
    removeLineIds(selectedLines.map((line) => line.id))
  }

  const handleCutRange = () => {
    if (rangeVisibilityGuard.current?.() === false) return
    handleCopyRange()
    removeCurrentRange()
  }

  const pasteAtScriptLevel = async () => {
    if (rangeVisibilityGuard.current?.() === false) return
    const systemText = await readExternalPlainText()
    const internalClipboard = lineClipboardRef.current
    const normalizedSystemText = systemText?.replace(/\r\n/g, "\n") ?? null
    const useInternalClipboard =
      internalClipboard.lines.length > 0 &&
      (normalizedSystemText === null || normalizedSystemText === internalClipboard.plainText)
    const clipboardLines = useInternalClipboard
      ? internalClipboard.lines.map((line) => ({ ...line }))
      : normalizedSystemText !== null && normalizedSystemText !== ""
        ? [{ id: createLineId(), speaker: "", content: normalizedSystemText }]
        : []
    if (clipboardLines.length === 0) return

    const selectedLines = getRangeLines()
    const anchorLineId =
      selectedLines[selectedLines.length - 1]?.id ??
      activeLineIdRef.current ??
      lastFocusedLineIdRef.current ??
      null
    commitProjectUpdate((currentProject) => {
      const result = pasteClipboardLines(currentProject.lines, clipboardLines, anchorLineId)
      if (result.insertedLineIds.length === 0) return currentProject
      const firstLineId = result.insertedLineIds[0]
      setScriptFocus(firstLineId)
      requestScroll(firstLineId)
      return { ...currentProject, lines: result.lines }
    })
  }

  const handleDeleteRange = () => removeCurrentRange()

  const handleSelectOutlineLine = (lineId: string) => {
    setScriptFocus(lineId)
    requestScroll(lineId)
  }

  const handleRenameCharacter = (currentName: string, nextName: string) => {
    const normalizedName = nextName.trim()

    if (
      !normalizedName ||
      !isRoleSpeaker(normalizedName) ||
      (normalizedName !== currentName && projectRef.current.characters[normalizedName])
    ) {
      return false
    }

    let didRename = false

    commitProjectUpdate((currentProject) => {
      const { [currentName]: currentProfile, ...restCharacters } = currentProject.characters

      if (!currentProfile) {
        return currentProject
      }

      const reorderedCharacters: CharacterMap = {}

      Object.entries(restCharacters).forEach(([displayName, profile]) => {
        reorderedCharacters[displayName] = profile
      })

      reorderedCharacters[normalizedName] = currentProfile
      didRename = true

      return {
        ...currentProject,
        characters: reorderedCharacters,
        settings: {
          ...currentProject.settings,
          characterOrder: renameCharacterOrderEntry(
            currentProject.settings.characterOrder,
            currentName,
            normalizedName
          )
        },
        lines: currentProject.lines.map((line) =>
          line.speaker.trim() === currentName ? { ...line, speaker: normalizedName } : line
        )
      }
    })

    return didRename
  }

  const handleUpdateCharacter = (
    displayName: string,
    patch: Partial<CharacterProfile>,
    mode: "live" | "commit" = "live"
  ) => {
    const applyCharacterPatch = (currentProject: VNProject) => {
      const currentProfile =
        currentProject.characters[displayName] ?? createDefaultCharacterProfile(displayName)

      return {
        ...currentProject,
        characters: {
          ...currentProject.characters,
          [displayName]: {
            ...currentProfile,
            ...patch
          }
        }
      }
    }

    if (mode === "commit") {
      commitProjectUpdate(applyCharacterPatch)
      return
    }

    updateProjectLive(applyCharacterPatch)
  }

  const handleReorderCharacters = (nextOrder: string[]) => {
    updateProjectLive((currentProject) => ({
      ...currentProject,
      settings: {
        ...currentProject.settings,
        characterOrder: [...nextOrder]
      }
    }))
  }

  const handleReadingWrapCharsChange = (value: number) => {
    commitProjectUpdate((currentProject) => ({
      ...currentProject,
      settings: {
        ...currentProject.settings,
        readingWrapChars: clampReadingWrapChars(value)
      }
    }))
  }

  const handleEditorFontSizeChange = (value: number) => {
    commitProjectUpdate((currentProject) => ({
      ...currentProject,
      settings: {
        ...currentProject.settings,
        editorFontSize: clampEditorFontSize(value)
      }
    }))
  }

  const handleExportHeadingsChange = (enabled: boolean) => {
    commitProjectUpdate((currentProject) => ({
      ...currentProject,
      settings: {
        ...currentProject.settings,
        exportHeadings: enabled
      }
    }))
  }

  const handleExportProjectFile = () => {
    const exportProject = stampProjectMeta(projectRef.current)

    downloadBlob(
      JSON.stringify(exportProject, null, 2),
      buildTimestampedFilename(exportProject.title, ".vns"),
      "application/json;charset=utf-8"
    )
    setSaveStatus("saved")
    setSaveStatusText("项目文件已导出")
  }

const handleInsertPlainText = ({
    lines: importedLines,
    characterIdHints,
    insertMode
  }: {
    lines: ScriptLine[]
    characterIdHints: Record<string, string>
    insertMode: PlainTextInsertMode
  }) => {

    if (importedLines.length === 0) {
      return false
    }

    if (
      insertMode === "replace-all" &&
      !window.confirm("这会替换当前全部脚本内容。请确认已经导出项目文件。确定继续吗？")
    ) {
      return false
    }

    commitProjectUpdate((currentProject) => {
      const anchorLineId = activeLineIdRef.current ?? lastFocusedLineIdRef.current ?? null
      let nextLines: ScriptLine[]

      if (insertMode === "replace-all") {
        nextLines = [...importedLines]
      } else if (insertMode === "append") {
        nextLines = [...currentProject.lines, ...importedLines]
      } else {
        const anchorIndex = anchorLineId
          ? currentProject.lines.findIndex((line) => line.id === anchorLineId)
          : -1
        const insertionIndex = anchorIndex >= 0 ? anchorIndex + 1 : currentProject.lines.length

        nextLines = [...currentProject.lines]
        nextLines.splice(insertionIndex, 0, ...importedLines)
      }

      const nextCharacters = importedLines.reduce((characters, line) => {
        const preferredId = characterIdHints[line.speaker]
        return ensureCharacterProfile(characters, line.speaker, preferredId)
      }, currentProject.characters)

      const firstImportedLineId = importedLines[0]?.id

      if (firstImportedLineId) {
        setActiveLineId(firstImportedLineId)
        setLastFocusedLineId(firstImportedLineId)
        requestScroll(firstImportedLineId)
        requestFocus(firstImportedLineId, "speaker")
      }

      setSaveStatus("saving")
      setSaveStatusText(`已从纯文本插入 ${importedLines.length} 行`)

      return {
        ...currentProject,
        characters: nextCharacters,
        lines: nextLines
      }
    })

    return true
  }

  const handleImportProjectFile = async (file: File) => {
    const confirmed = window.confirm("导入项目会替换当前内容。确定继续吗？")

    if (!confirmed) {
      return
    }

    try {
      const rawText = await file.text()
      let parsedValue: unknown

      try {
        parsedValue = JSON.parse(rawText) as unknown
      } catch {
        setSaveStatus("error")
        setSaveStatusText("导入失败：JSON 格式错误。")
        return
      }

      if (!validateProjectLike(parsedValue)) {
        setSaveStatus("error")
        setSaveStatusText("导入失败：文件不是有效的项目文件。")
        return
      }

      const importedProject = normalizeProjectData(parsedValue)

      if (!importedProject) {
        throw new Error("invalid project")
      }

      const stampedImportedProject = stampProjectMeta(importedProject)
      replaceProjectState(stampedImportedProject, "已导入，等待自动保存")
    } catch {
      setSaveStatus("error")
      setSaveStatusText("导入失败：文件不是有效的项目文件。")
    }
  }

  const handleCreateBlankProject = () => {
    const confirmed = window.confirm(
      "这会替换当前编辑内容。请确认已经导出项目文件。确定新建空白项目吗？"
    )

    if (!confirmed) {
      return
    }

    replaceProjectState(createBlankProject(), "已新建空白项目，等待自动保存")
  }

  const handleResetToDefaultProject = () => {
    const confirmed = window.confirm(
      "这会替换当前编辑内容。请确认已经导出项目文件。确定重置为示例项目吗？"
    )

    if (!confirmed) {
      return
    }

    const resetProject = stampProjectMeta(ensureProjectHasLine(migrateProject(defaultProject)))
    replaceProjectState(resetProject, "已重置为示例项目，等待自动保存")
  }

  const handleClearLocalProject = () => {
    const didClear = clearLocalProject()

    if (!didClear) {
      setSaveStatus("error")
      setSaveStatusText("清除失败")
      return
    }

    autosaveSuspendedSnapshotRef.current = JSON.stringify(projectRef.current)
    lastPersistedSnapshotRef.current = null
    setSaveStatus("idle")
    setSaveStatusText("本地自动保存已清除")
  }

  const handleSearchQueryChange = (value: string) => {
    setSearchQuery(value)
    setSearchStatusText("")
  }

  const handlePreviousMatch = () => {
    if (searchMatches.length === 0) {
      return
    }

    const nextIndex =
      currentSearchMatchIndex <= 0 ? searchMatches.length - 1 : currentSearchMatchIndex - 1

    setCurrentSearchMatchIndex(nextIndex)
    focusSearchMatch(searchMatches[nextIndex])
  }

  const handleNextMatch = () => {
    if (searchMatches.length === 0) {
      return
    }

    const nextIndex =
      currentSearchMatchIndex < 0 || currentSearchMatchIndex >= searchMatches.length - 1
        ? 0
        : currentSearchMatchIndex + 1

    setCurrentSearchMatchIndex(nextIndex)
    focusSearchMatch(searchMatches[nextIndex])
  }

  const handleReplaceCurrent = () => {
    if (!currentSearchMatch || searchQuery === "") {
      return
    }

    commitProjectUpdate((currentProject) => {
      let nextCharacters = currentProject.characters
      let didReplace = false

      const nextLines = currentProject.lines.map((line) => {
        if (line.id !== currentSearchMatch.lineId) {
          return line
        }

        didReplace = true

        if (currentSearchMatch.field === "content") {
          return {
            ...line,
            content: replaceCurrentMatchValue(line.content, currentSearchMatch, replaceValue)
          }
        }

        const nextSpeaker = replaceCurrentMatchValue(
          line.speaker,
          currentSearchMatch,
          replaceValue
        ).trim()

        nextCharacters = ensureCharacterProfile(nextCharacters, nextSpeaker)

        return {
          ...line,
          speaker: nextSpeaker
        }
      })

      if (!didReplace) {
        return currentProject
      }

      return {
        ...currentProject,
        characters: nextCharacters,
        lines: nextLines
      }
    })

    syncSearchAfterProjectChange("已替换当前匹配")
  }

  const handleReplaceAll = () => {
    if (searchQuery === "" || searchMatches.length === 0) {
      return
    }

    const confirmed = window.confirm(
      `将替换 ${searchMatches.length} 处匹配。确定继续吗？`
    )

    if (!confirmed) {
      return
    }

    let replacedCount = 0

    commitProjectUpdate((currentProject) => {
      let nextCharacters = currentProject.characters

      const nextLines = currentProject.lines.map((line) => {
        const speakerResult = replaceAllOccurrences(line.speaker, searchQuery, replaceValue)
        const contentResult = replaceAllOccurrences(line.content, searchQuery, replaceValue)

        if (speakerResult.count === 0 && contentResult.count === 0) {
          return line
        }

        replacedCount += speakerResult.count + contentResult.count

        const nextLine: ScriptLine = {
          ...line,
          speaker:
            speakerResult.count > 0 ? speakerResult.value.trim() : line.speaker,
          content: contentResult.count > 0 ? contentResult.value : line.content
        }

        nextCharacters = ensureCharacterProfile(nextCharacters, nextLine.speaker)
        return nextLine
      })

      if (replacedCount === 0) {
        return currentProject
      }

      return {
        ...currentProject,
        characters: nextCharacters,
        lines: nextLines
      }
    })

    syncSearchAfterProjectChange(`已替换 ${replacedCount} 处匹配`)
  }

  const performUndo = () => {
    const pendingSnapshot = pendingEditSnapshotRef.current

    if (pendingSnapshot && !areProjectsEqual(pendingSnapshot, projectRef.current)) {
      setRedoHistory(
        pushHistorySnapshot(redoStackRef.current, cloneProject(projectRef.current))
      )
      pendingEditSnapshotRef.current = null
      setProjectDirect(pendingSnapshot)
      return
    }

    if (undoStackRef.current.length === 0) {
      return
    }

    const nextUndoStack = [...undoStackRef.current]
    const previousProject = nextUndoStack.pop()

    if (!previousProject) {
      return
    }

    setUndoHistory(nextUndoStack)
    setRedoHistory(pushHistorySnapshot(redoStackRef.current, cloneProject(projectRef.current)))
    setProjectDirect(previousProject)
  }

  const performRedo = () => {
    if (redoStackRef.current.length === 0) {
      return
    }

    const nextRedoStack = [...redoStackRef.current]
    const nextProject = nextRedoStack.pop()

    if (!nextProject) {
      return
    }

    setRedoHistory(nextRedoStack)
    setUndoHistory(pushHistorySnapshot(undoStackRef.current, cloneProject(projectRef.current)))
    pendingEditSnapshotRef.current = null
    setProjectDirect(nextProject)
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isShortcutPressed = event.ctrlKey || event.metaKey
      const targetIsEditable = isEditableElement(event.target)
      const shortcutKey = event.key.toLowerCase()

      if (isShortcutPressed && shortcutKey === "f") {
        event.preventDefault()
        setIsSidebarCollapsed(false)
        setSearchFocusRequest((request) => request + 1)
        setIsSearchFocused(true)
        requestAnimationFrame(() => {
          searchInputRef.current?.focus()
          searchInputRef.current?.select()
        })
        return
      }

      if (isShortcutPressed && shortcutKey === "z") {
        event.preventDefault()

        if (event.shiftKey) {
          performRedo()
        } else {
          performUndo()
        }

        return
      }

      if (isShortcutPressed && shortcutKey === "y") {
        event.preventDefault()
        performRedo()
        return
      }

      if (targetIsEditable) {
        return
      }

      if (isShortcutPressed && shortcutKey === "c" && lineRangeSelectionRef.current) {
        event.preventDefault()
        handleCopyRange()
        return
      }

      if (isShortcutPressed && shortcutKey === "x" && lineRangeSelectionRef.current) {
        event.preventDefault()
        handleCutRange()
        return
      }

      if (isShortcutPressed && shortcutKey === "v") {
        event.preventDefault()
        void pasteAtScriptLevel()
        return
      }

      if ((event.key === "Delete" || event.key === "Backspace") && lineRangeSelectionRef.current) {
        event.preventDefault()
        handleDeleteRange()
        return
      }

    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [project.lines, searchMatches.length])

  return (
    <div className={`app-shell ${isOutlineCollapsed ? "is-outline-collapsed" : ""} ${isSidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
      <Outline
        isCollapsed={isOutlineCollapsed}
        onToggleCollapsed={() => setIsOutlineCollapsed((collapsed) => !collapsed)}
        key={`outline-${editorSession}`}
        lines={project.lines}
        activeLineId={activeLineId}
        onSelectLine={handleSelectOutlineLine}
      />

      <Editor
        key={`editor-${editorSession}`}
        rangeVisibilityGuard={rangeVisibilityGuard}
        lines={project.lines}
        characters={project.characters}
        readingWrapChars={project.settings.readingWrapChars}
        editorFontSize={project.settings.editorFontSize}
        lineRangeSelection={lineRangeSelection}
        activeLineId={activeLineId}
        searchMatchLineId={shouldShowSearchHighlight ? currentSearchMatch?.lineId ?? null : null}
        typewriterMode={typewriterMode}
        focusRequest={focusRequest}
        scrollRequest={scrollRequest}
        isTextEditing={isTextEditing}
        onTextEditFocus={handleTextEditFocus}
        onBlankLineClick={handleBlankLineClick}
        onBeginRangeSelection={handleBeginRangeSelection}
        onExtendRangeSelection={handleExtendRangeSelection}
        onSpeakerChange={handleSpeakerChange}
        onSpeakerCommit={handleSpeakerCommit}
        onContentChange={handleContentChange}
        onBeginTextEdit={beginProjectEdit}
        onEndTextEdit={() => {
          setIsTextEditing(false)
          finalizePendingEdit()
        }}
        onInsertLineBelow={handleInsertLineBelow}
        onCopyRange={handleCopyRange}
        onCutRange={handleCutRange}
        onDeleteRange={handleDeleteRange}
        onPasteRange={() => void pasteAtScriptLevel()}
      />

      <RightPanel
        searchFocusRequest={searchFocusRequest}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapsed={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
        project={project}
        activeSpeakers={orderedActiveSpeakers}
        characters={project.characters}
        typewriterMode={typewriterMode}
        saveStatusText={saveStatusText}
        searchQuery={searchQuery}
        replaceValue={replaceValue}
        searchMatchCount={searchMatches.length}
        currentSearchMatchIndex={currentSearchMatchIndex}
        searchStatusText={searchStatusText}
        searchInputRef={searchInputRef}
        onTypewriterModeChange={setTypewriterMode}
        onReadingWrapCharsChange={handleReadingWrapCharsChange}
        onEditorFontSizeChange={handleEditorFontSizeChange}
        onExportHeadingsChange={handleExportHeadingsChange}
        onRenameCharacter={handleRenameCharacter}
        onUpdateCharacter={handleUpdateCharacter}
        onReorderCharacters={handleReorderCharacters}
        onBeginCharacterEdit={beginProjectEdit}
        onEndCharacterEdit={finalizePendingEdit}
        onExportProjectFile={handleExportProjectFile}
        onImportProjectFile={handleImportProjectFile}
        onInsertPlainText={handleInsertPlainText}
        onCreateBlankProject={handleCreateBlankProject}
        onResetToDefaultProject={handleResetToDefaultProject}
        onClearLocalProject={handleClearLocalProject}
        onProjectTitleChange={handleProjectTitleChange}
        onSearchQueryChange={handleSearchQueryChange}
        onReplaceValueChange={setReplaceValue}
        onPreviousMatch={handlePreviousMatch}
        onNextMatch={handleNextMatch}
        onReplaceCurrent={handleReplaceCurrent}
        onReplaceAll={handleReplaceAll}
        onSearchFocusChange={setIsSearchFocused}
      />
    </div>
  )
}
