import { useEffect, useState, type DragEvent } from "react"
import type { CharacterMap, CharacterProfile } from "../types"
import { createDefaultCharacterProfile } from "../utils/characters"
import { ColorPopover } from "./ColorPopover"

type CharacterMapEditorProps = {
  activeSpeakers: string[]
  characters: CharacterMap
  onRenameCharacter: (currentName: string, nextName: string) => boolean
  onUpdateCharacter: (
    displayName: string,
    patch: Partial<CharacterProfile>,
    mode?: "live" | "commit"
  ) => void
  onReorderCharacters: (nextOrder: string[]) => void
  onBeginEdit: () => void
  onEndEdit: () => void
}

type CharacterRowProps = {
  displayName: string
  profile: CharacterProfile
  isDragging: boolean
  isDragOver: boolean
  onRenameCharacter: (currentName: string, nextName: string) => boolean
  onUpdateCharacter: (
    displayName: string,
    patch: Partial<CharacterProfile>,
    mode?: "live" | "commit"
  ) => void
  onBeginEdit: () => void
  onEndEdit: () => void
  onDragStart: (displayName: string, event: DragEvent<HTMLButtonElement>) => void
  onDragOver: (displayName: string, event: DragEvent<HTMLDivElement>) => void
  onDrop: (displayName: string, event: DragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
}

const LABELS = {
  name: "显示名",
  exportId: "导出 ID",
  color: "颜色",
  order: "顺序",
  empty: "当前正文里还没有角色说话人。",
  drag: "拖拽调整顺序"
}

function moveCharacterOrder(order: string[], sourceName: string, targetName: string) {
  if (sourceName === targetName) {
    return order
  }

  const sourceIndex = order.indexOf(sourceName)
  const targetIndex = order.indexOf(targetName)

  if (sourceIndex < 0 || targetIndex < 0) {
    return order
  }

  const nextOrder = [...order]
  const [movedItem] = nextOrder.splice(sourceIndex, 1)
  nextOrder.splice(targetIndex, 0, movedItem)
  return nextOrder
}

function CharacterRow({
  displayName,
  profile,
  isDragging,
  isDragOver,
  onRenameCharacter,
  onUpdateCharacter,
  onBeginEdit,
  onEndEdit,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd
}: CharacterRowProps) {
  const [nameDraft, setNameDraft] = useState(displayName)

  useEffect(() => {
    setNameDraft(displayName)
  }, [displayName])

  const commitRename = () => {
    const nextName = nameDraft.trim()

    if (!nextName || nextName === displayName) {
      setNameDraft(displayName)
      onEndEdit()
      return
    }

    const didRename = onRenameCharacter(displayName, nextName)

    if (!didRename) {
      setNameDraft(displayName)
    }

    onEndEdit()
  }

  return (
    <div
      className={`character-row ${isDragging ? "is-dragging" : ""} ${isDragOver ? "is-drag-over" : ""}`.trim()}
      onDragOver={(event) => onDragOver(displayName, event)}
      onDrop={(event) => onDrop(displayName, event)}
    >
      <input
        type="text"
        value={nameDraft}
        aria-label={`${displayName} ${LABELS.name}`}
        onFocus={onBeginEdit}
        onChange={(event) => setNameDraft(event.target.value)}
        onBlur={commitRename}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            commitRename()
            event.currentTarget.blur()
          }
        }}
      />

      <input
        type="text"
        value={profile.id}
        aria-label={`${displayName} ${LABELS.exportId}`}
        onFocus={onBeginEdit}
        onChange={(event) => onUpdateCharacter(displayName, { id: event.target.value }, "live")}
        onBlur={onEndEdit}
      />

      <ColorPopover
        color={profile.color}
        label={displayName}
        onChange={(color) => onUpdateCharacter(displayName, { color }, "commit")}
      />

      <button
        type="button"
        className="character-drag-handle"
        title={LABELS.drag}
        draggable
        onDragStart={(event) => onDragStart(displayName, event)}
        onDragEnd={onDragEnd}
      >
        ⋮⋮
      </button>
    </div>
  )
}

export function CharacterMapEditor({
  activeSpeakers,
  characters,
  onRenameCharacter,
  onUpdateCharacter,
  onReorderCharacters,
  onBeginEdit,
  onEndEdit
}: CharacterMapEditorProps) {
  const [draggingDisplayName, setDraggingDisplayName] = useState<string | null>(null)
  const [dragOverDisplayName, setDragOverDisplayName] = useState<string | null>(null)

  useEffect(() => {
    if (
      draggingDisplayName &&
      !activeSpeakers.includes(draggingDisplayName)
    ) {
      setDraggingDisplayName(null)
      setDragOverDisplayName(null)
    }
  }, [activeSpeakers, draggingDisplayName])

  const handleDragStart = (displayName: string, event: DragEvent<HTMLButtonElement>) => {
    setDraggingDisplayName(displayName)
    setDragOverDisplayName(displayName)
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", displayName)
  }

  const handleDragOver = (displayName: string, event: DragEvent<HTMLDivElement>) => {
    if (!draggingDisplayName) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    setDragOverDisplayName(displayName)
  }

  const handleDrop = (displayName: string, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()

    if (!draggingDisplayName) {
      return
    }

    const nextOrder = moveCharacterOrder(activeSpeakers, draggingDisplayName, displayName)

    if (nextOrder !== activeSpeakers) {
      onReorderCharacters(nextOrder)
    }

    setDraggingDisplayName(null)
    setDragOverDisplayName(null)
  }

  const handleDragEnd = () => {
    setDraggingDisplayName(null)
    setDragOverDisplayName(null)
  }

  return (
    <div className="character-map">
      <div className="character-map-header">
        <span>{LABELS.name}</span>
        <span>{LABELS.exportId}</span>
        <span>{LABELS.color}</span>
        <span>{LABELS.order}</span>
      </div>

      {activeSpeakers.length === 0 ? (
        <div className="character-map-empty">{LABELS.empty}</div>
      ) : (
        activeSpeakers.map((displayName) => (
          <CharacterRow
            key={displayName}
            displayName={displayName}
            profile={characters[displayName] ?? createDefaultCharacterProfile(displayName)}
            isDragging={draggingDisplayName === displayName}
            isDragOver={dragOverDisplayName === displayName && draggingDisplayName !== displayName}
            onRenameCharacter={onRenameCharacter}
            onUpdateCharacter={onUpdateCharacter}
            onBeginEdit={onBeginEdit}
            onEndEdit={onEndEdit}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        ))
      )}
    </div>
  )
}
