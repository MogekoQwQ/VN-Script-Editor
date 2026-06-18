import { useEffect, useState } from "react"
import type { CharacterMap, CharacterProfile } from "../types"
import { DEFAULT_CHARACTER_COLOR } from "../utils/colors"
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
  onBeginEdit: () => void
  onEndEdit: () => void
}

type CharacterRowProps = {
  displayName: string
  profile: CharacterProfile
  onRenameCharacter: (currentName: string, nextName: string) => boolean
  onUpdateCharacter: (
    displayName: string,
    patch: Partial<CharacterProfile>,
    mode?: "live" | "commit"
  ) => void
  onBeginEdit: () => void
  onEndEdit: () => void
}

const LABELS = {
  name: "\u663e\u793a\u540d",
  exportId: "\u5bfc\u51fa ID",
  color: "\u989c\u8272",
  empty: "\u5f53\u524d\u6b63\u6587\u91cc\u8fd8\u6ca1\u6709\u89d2\u8272\u8bf4\u8bdd\u4eba\u3002"
}

function CharacterRow({
  displayName,
  profile,
  onRenameCharacter,
  onUpdateCharacter,
  onBeginEdit,
  onEndEdit
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
    <div className="character-row">
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
    </div>
  )
}

export function CharacterMapEditor({
  activeSpeakers,
  characters,
  onRenameCharacter,
  onUpdateCharacter,
  onBeginEdit,
  onEndEdit
}: CharacterMapEditorProps) {
  return (
    <div className="character-map">
      <div className="character-map-header">
        <span>{LABELS.name}</span>
        <span>{LABELS.exportId}</span>
        <span>{LABELS.color}</span>
      </div>

      {activeSpeakers.length === 0 ? (
        <div className="character-map-empty">{LABELS.empty}</div>
      ) : (
        activeSpeakers.map((displayName) => (
          <CharacterRow
            key={displayName}
            displayName={displayName}
            profile={
              characters[displayName] ?? {
                id: displayName,
                color: DEFAULT_CHARACTER_COLOR
              }
            }
            onRenameCharacter={onRenameCharacter}
            onUpdateCharacter={onUpdateCharacter}
            onBeginEdit={onBeginEdit}
            onEndEdit={onEndEdit}
          />
        ))
      )}
    </div>
  )
}
