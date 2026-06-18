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
  moveSelectedLines,
  pasteClipboardLines,
  snapshotSelectedLines
} from "./utils/lineOperations"
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
import { findMatches, type SearchMatch } from "./utils/search"
import {
  createDefaultCharacterProfile,
  ensureCharacterProfile,
  getActiveSpeakers
} from "./utils/characters"
import { isRoleSpeaker } from "./utils/lineTypes"

type SaveStatus = "idle" | "saving" | "saved" | "error"
type FocusTarget = FocusRequest | null
type ScrollTarget = ScrollRequest | null

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
      editorFontSize: 16
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

function buildProjectFilename(title: string) {
  const normalizedTitle = title.trim().replace(/[\\/:*?"<>|]+/g, "_")
  const fallbackTitle = normalizedTitle || "vn_script_project"
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  return `${fallbackTitle}_${timestamp}.vns.json`
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
  const [activeLineId, setActiveLineId] = useState<string | null>(null)
  const [lastFocusedLineId, setLastFocusedLineId] = useState<string | null>(null)
  const [typewriterMode, setTypewriterMode] = useState(false)
  const [focusRequest, setFocusRequest] = useState<FocusTarget>(null)
  const [scrollRequest, setScrollRequest] = useState<ScrollTarget>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([])
  const [lastSelectedLineId, setLastSelectedLineId] = useState<string | null>(null)
  const [lineClipboard, setLineClipboard] = useState<ScriptLine[]>([])
  const [layoutVersion, setLayoutVersion] = useState(0)
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
  const selectionModeRef = useRef(selectionMode)
  const selectedLineIdsRef = useRef(selectedLineIds)
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
  const lineIndexMap = useMemo(
    () => new Map(project.lines.map((line, index) => [line.id, index])),
    [project.lines]
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
    selectionModeRef.current = selectionMode
  }, [selectionMode])

  useEffect(() => {
    selectedLineIdsRef.current = selectedLineIds
  }, [selectedLineIds])

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

    setSelectedLineIds((currentSelection) =>
      currentSelection.filter((lineId) => lineIds.has(lineId))
    )

    if (activeLineId && !lineIds.has(activeLineId)) {
      setActiveLineId(null)
    }

    if (lastFocusedLineId && !lineIds.has(lastFocusedLineId)) {
      setLastFocusedLineId(null)
    }

    if (lastSelectedLineId && !lineIds.has(lastSelectedLineId)) {
      setLastSelectedLineId(null)
    }
  }, [project.lines, activeLineId, lastFocusedLineId, lastSelectedLineId])

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

  const clearSelection = () => {
    setSelectedLineIds([])
    setLastSelectedLineId(null)
  }

  const replaceProjectState = (nextProject: VNProject, saveMessage: string) => {
    pendingEditSnapshotRef.current = null
    setProjectDirect(nextProject)
    setUndoHistory([])
    setRedoHistory([])
    setSelectionMode(false)
    clearSelection()
    setLineClipboard([])
    setActiveLineId(nextProject.lines[0]?.id ?? null)
    setLastFocusedLineId(nextProject.lines[0]?.id ?? null)
    autosaveSuspendedSnapshotRef.current = null
    lastPersistedSnapshotRef.current = null
    setSearchStatusText("")
    setSaveStatus("saving")
    setSaveStatusText(saveMessage)
  }

  const exitSelectionMode = () => {
    setSelectionMode(false)
    clearSelection()
    window.requestAnimationFrame(() => {
      setLayoutVersion((currentVersion) => currentVersion + 1)
    })
  }

  const enterSelectionMode = (lineId: string) => {
    setSelectionMode(true)
    setSelectedLineIds([lineId])
    setLastSelectedLineId(lineId)
    setActiveLineId(lineId)
    setLastFocusedLineId(lineId)
    window.requestAnimationFrame(() => {
      setLayoutVersion((currentVersion) => currentVersion + 1)
    })
  }

  const focusSearchMatch = (match: SearchMatch | null) => {
    if (!match) {
      return
    }

    setActiveLineId(match.lineId)
    setLastFocusedLineId(match.lineId)
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

  const handleSpeakerChange = (lineId: string, speaker: string) => {
    updateProjectLive((currentProject) => ({
      ...currentProject,
      lines: currentProject.lines.map((line) =>
        line.id === lineId ? { ...line, speaker } : line
      )
    }))
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
      clearSelection()
      return {
        ...currentProject,
        lines: nextLines
      }
    })
  }

  const removeLineIds = (lineIdsToRemove: string[]) => {
    commitProjectUpdate((currentProject) => {
      const lineIdSet = new Set(lineIdsToRemove)
      const remainingLines = currentProject.lines.filter((line) => !lineIdSet.has(line.id))

      clearSelection()

      if (remainingLines.length === 0) {
        const emptyLine = createEmptyLine()
        requestFocus(emptyLine.id, "speaker")

        return {
          ...currentProject,
          lines: [emptyLine]
        }
      }

      const fallbackLine = remainingLines[0]

      if (fallbackLine) {
        requestFocus(fallbackLine.id, "speaker")
      }

      return {
        ...currentProject,
        lines: remainingLines
      }
    })
  }

  const handleCopyLine = (lineId: string) => {
    const sourceLine = projectRef.current.lines.find((line) => line.id === lineId)

    if (!sourceLine) {
      return
    }

    setLineClipboard([{ ...sourceLine }])
  }

  const handleCutLine = (lineId: string) => {
    const sourceLine = projectRef.current.lines.find((line) => line.id === lineId)

    if (!sourceLine) {
      return
    }

    setLineClipboard([{ ...sourceLine }])
    removeLineIds([lineId])
  }

  const handleDeleteLine = (lineId: string) => {
    const currentProject = projectRef.current

    if (currentProject.lines.length === 1) {
      commitProjectUpdate(() => ({
        ...currentProject,
        lines: [{ ...currentProject.lines[0], speaker: "", content: "" }]
      }))
      requestFocus(lineId, "speaker")
      return
    }

    removeLineIds([lineId])
  }

  const handleMoveLine = (lineId: string, direction: -1 | 1) => {
    commitProjectUpdate((currentProject) => {
      const lineIndex = currentProject.lines.findIndex((line) => line.id === lineId)
      const targetIndex = lineIndex + direction

      if (
        lineIndex === -1 ||
        targetIndex < 0 ||
        targetIndex >= currentProject.lines.length
      ) {
        return currentProject
      }

      const nextLines = [...currentProject.lines]
      const [movedLine] = nextLines.splice(lineIndex, 1)
      nextLines.splice(targetIndex, 0, movedLine)
      requestFocus(lineId, "speaker")

      return {
        ...currentProject,
        lines: nextLines
      }
    })
  }

  const handleToggleLineSelection = (
    lineId: string,
    modifiers: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }
  ) => {
    if (!selectionMode) {
      return
    }

    if (modifiers.shiftKey && lastSelectedLineId && lineIndexMap.has(lastSelectedLineId)) {
      const wasTargetSelected = selectedLineIds.includes(lineId)
      const startIndex = lineIndexMap.get(lastSelectedLineId) ?? 0
      const endIndex = lineIndexMap.get(lineId) ?? 0
      const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex]
      const rangeSelection = project.lines.slice(from, to + 1).map((line) => line.id)

      if (wasTargetSelected) {
        setSelectedLineIds((currentSelection) =>
          currentSelection.filter((selectedId) => !rangeSelection.includes(selectedId))
        )
      } else {
        setSelectedLineIds((currentSelection) =>
          Array.from(new Set([...currentSelection, ...rangeSelection]))
        )
      }

      setLastSelectedLineId(lineId)
      return
    }

    setSelectedLineIds((currentSelection) => {
      const nextSelection = new Set(currentSelection)

      if (nextSelection.has(lineId)) {
        nextSelection.delete(lineId)
      } else {
        nextSelection.add(lineId)
      }

      return Array.from(nextSelection)
    })
    setLastSelectedLineId(lineId)
  }

  const handleCopySelectedLines = () => {
    if (selectedLineIdsRef.current.length === 0) {
      return
    }

    const selectedSet = new Set(selectedLineIdsRef.current)
    setLineClipboard(snapshotSelectedLines(projectRef.current.lines, selectedSet))
  }

  const handleCutSelectedLines = () => {
    if (selectedLineIdsRef.current.length === 0) {
      return
    }

    const selectedSet = new Set(selectedLineIdsRef.current)
    setLineClipboard(snapshotSelectedLines(projectRef.current.lines, selectedSet))
    removeLineIds(selectedLineIdsRef.current)
  }

  const handlePasteClipboard = () => {
    if (lineClipboardRef.current.length === 0) {
      return
    }

    const anchorLineId = activeLineIdRef.current ?? lastFocusedLineIdRef.current ?? null

    commitProjectUpdate((currentProject) => {
      const result = pasteClipboardLines(
        currentProject.lines,
        lineClipboardRef.current,
        anchorLineId
      )

      if (result.insertedLineIds.length === 0) {
        return currentProject
      }

      setActiveLineId(result.insertedLineIds[0])
      setLastFocusedLineId(result.insertedLineIds[0])
      requestScroll(result.insertedLineIds[0])
      requestFocus(result.insertedLineIds[0], "speaker")

      return {
        ...currentProject,
        lines: result.lines
      }
    })
  }

  const handlePasteClipboardBelowLine = (lineId: string) => {
    if (lineClipboardRef.current.length === 0) {
      return
    }

    commitProjectUpdate((currentProject) => {
      const result = pasteClipboardLines(currentProject.lines, lineClipboardRef.current, lineId)

      if (result.insertedLineIds.length === 0) {
        return currentProject
      }

      setActiveLineId(result.insertedLineIds[0] ?? null)
      setLastFocusedLineId(result.insertedLineIds[0] ?? null)
      requestScroll(result.insertedLineIds[0])
      requestFocus(result.insertedLineIds[0], "speaker")

      return {
        ...currentProject,
        lines: result.lines
      }
    })
  }

  const handleDeleteSelectedLines = () => {
    if (selectedLineIdsRef.current.length === 0) {
      return
    }

    removeLineIds(selectedLineIdsRef.current)
  }

  const handleMoveSelectedLines = (direction: -1 | 1) => {
    if (selectedLineIdsRef.current.length === 0) {
      return
    }

    commitProjectUpdate((currentProject) => ({
      ...currentProject,
      lines: moveSelectedLines(
        currentProject.lines,
        new Set(selectedLineIdsRef.current),
        direction
      )
    }))
  }

  const handleSelectAllLines = () => {
    setSelectionMode(true)
    const nextSelectedLineIds = project.lines.map((line) => line.id)
    setSelectedLineIds(nextSelectedLineIds)
    setLastSelectedLineId(nextSelectedLineIds[nextSelectedLineIds.length - 1] ?? null)
  }

  const handleSelectOutlineLine = (lineId: string) => {
    setActiveLineId(lineId)
    setLastFocusedLineId(lineId)
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
      buildProjectFilename(exportProject.title),
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

    setSelectionMode(false)
    clearSelection()
    window.requestAnimationFrame(() => {
      setLayoutVersion((currentVersion) => currentVersion + 1)
    })

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
        setIsSearchFocused(true)
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
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

      if (!selectionModeRef.current || targetIsEditable) {
        return
      }

      if (isShortcutPressed && shortcutKey === "c" && selectedLineIdsRef.current.length > 0) {
        event.preventDefault()
        handleCopySelectedLines()
        return
      }

      if (isShortcutPressed && shortcutKey === "x" && selectedLineIdsRef.current.length > 0) {
        event.preventDefault()
        handleCutSelectedLines()
        return
      }

      if (isShortcutPressed && shortcutKey === "v" && lineClipboardRef.current.length > 0) {
        event.preventDefault()
        handlePasteClipboard()
        return
      }

      if (isShortcutPressed && shortcutKey === "d") {
        event.preventDefault()
        exitSelectionMode()
        return
      }

      if (isShortcutPressed && shortcutKey === "a") {
        event.preventDefault()
        handleSelectAllLines()
        return
      }

      if (event.key === "Delete" && selectedLineIdsRef.current.length > 0) {
        event.preventDefault()
        handleDeleteSelectedLines()
        return
      }

      if (event.key === "Escape") {
        event.preventDefault()
        exitSelectionMode()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [project.lines, searchMatches.length])

  return (
    <div className="app-shell">
      <Outline
        lines={project.lines}
        activeLineId={activeLineId}
        onSelectLine={handleSelectOutlineLine}
      />

      <Editor
        lines={project.lines}
        characters={project.characters}
        readingWrapChars={project.settings.readingWrapChars}
        editorFontSize={project.settings.editorFontSize}
        selectionMode={selectionMode}
        layoutVersion={layoutVersion}
        selectedLineIds={selectedLineIds}
        activeLineId={activeLineId}
        searchMatchLineId={shouldShowSearchHighlight ? currentSearchMatch?.lineId ?? null : null}
        typewriterMode={typewriterMode}
        focusRequest={focusRequest}
        scrollRequest={scrollRequest}
        clipboardLineCount={lineClipboard.length}
        onActiveLineChange={handleActiveLineChange}
        onSpeakerChange={handleSpeakerChange}
        onSpeakerCommit={handleSpeakerCommit}
        onContentChange={handleContentChange}
        onBeginTextEdit={beginProjectEdit}
        onEndTextEdit={finalizePendingEdit}
        onInsertLineBelow={handleInsertLineBelow}
        onDeleteLine={handleDeleteLine}
        onCutLine={handleCutLine}
        onCopyLine={handleCopyLine}
        onPasteLineBelow={handlePasteClipboardBelowLine}
        onMoveLine={handleMoveLine}
        onEnterSelectionMode={enterSelectionMode}
        onToggleLineSelection={handleToggleLineSelection}
        onCopySelectedLines={handleCopySelectedLines}
        onCutSelectedLines={handleCutSelectedLines}
        onPasteClipboard={handlePasteClipboard}
        onDeleteSelectedLines={handleDeleteSelectedLines}
        onMoveSelectedLines={handleMoveSelectedLines}
        onClearSelection={clearSelection}
        onExitSelectionMode={exitSelectionMode}
      />

      <RightPanel
        project={project}
        activeSpeakers={activeSpeakers}
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
        onBeginCharacterEdit={beginProjectEdit}
        onEndCharacterEdit={finalizePendingEdit}
        onExportProjectFile={handleExportProjectFile}
        onImportProjectFile={handleImportProjectFile}
        onInsertPlainText={handleInsertPlainText}
        onCreateBlankProject={handleCreateBlankProject}
        onResetToDefaultProject={handleResetToDefaultProject}
        onClearLocalProject={handleClearLocalProject}
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
