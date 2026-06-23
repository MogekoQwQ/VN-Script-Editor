import type { CharacterMap, CharacterProfile, VNProject } from "../types"
import { DEFAULT_CHARACTER_COLOR } from "./colors"
import { isRoleSpeaker, normalizeSpeaker } from "./lineTypes"

export type SpeakerSuggestion = {
  displayName: string
  id: string
  matchValues: string[]
}

export function quoteRenpySpeakerName(name: string): string {
  const normalizedName = normalizeSpeaker(name)
  return `"${normalizedName.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

export function createDefaultCharacterProfile(
  displayName: string,
  preferredId?: string
): CharacterProfile {
  const normalizedName = normalizeSpeaker(displayName)
  const normalizedPreferredId = typeof preferredId === "string" ? preferredId.trim() : ""

  return {
    id: normalizedPreferredId || quoteRenpySpeakerName(normalizedName),
    color: DEFAULT_CHARACTER_COLOR
  }
}

export function getCharacterProfile(
  project: VNProject,
  speaker: string
): CharacterProfile | undefined {
  const normalizedSpeaker = normalizeSpeaker(speaker)
  return project.characters[normalizedSpeaker]
}

export function ensureCharacterProfile(
  characters: CharacterMap,
  speaker: string,
  preferredId?: string
): CharacterMap {
  const normalizedSpeaker = normalizeSpeaker(speaker)

  if (!isRoleSpeaker(normalizedSpeaker) || characters[normalizedSpeaker]) {
    return characters
  }

  return {
    ...characters,
    [normalizedSpeaker]: createDefaultCharacterProfile(normalizedSpeaker, preferredId)
  }
}

export function getActiveSpeakers(lines: VNProject["lines"]) {
  const activeSpeakers: string[] = []
  const seen = new Set<string>()

  lines.forEach((line) => {
    const speaker = normalizeSpeaker(line.speaker)

    if (!isRoleSpeaker(speaker) || seen.has(speaker)) {
      return
    }

    seen.add(speaker)
    activeSpeakers.push(speaker)
  })

  return activeSpeakers
}

export function resolveCharacterDisplayOrder(
  activeSpeakers: string[],
  characterOrder: string[] | undefined
) {
  const normalizedOrder = Array.isArray(characterOrder) ? characterOrder : []
  const activeSpeakerSet = new Set(activeSpeakers)
  const orderedSpeakers: string[] = []
  const seen = new Set<string>()

  normalizedOrder.forEach((displayName) => {
    if (!activeSpeakerSet.has(displayName) || seen.has(displayName)) {
      return
    }

    seen.add(displayName)
    orderedSpeakers.push(displayName)
  })

  activeSpeakers.forEach((displayName) => {
    if (seen.has(displayName)) {
      return
    }

    seen.add(displayName)
    orderedSpeakers.push(displayName)
  })

  return orderedSpeakers
}

export function renameCharacterOrderEntry(
  characterOrder: string[] | undefined,
  currentName: string,
  nextName: string
) {
  const normalizedOrder = Array.isArray(characterOrder) ? characterOrder : []
  const nextOrder: string[] = []
  const seen = new Set<string>()

  normalizedOrder.forEach((displayName) => {
    const nextDisplayName = displayName === currentName ? nextName : displayName

    if (seen.has(nextDisplayName)) {
      return
    }

    seen.add(nextDisplayName)
    nextOrder.push(nextDisplayName)
  })

  return nextOrder
}

function stripOuterQuotes(value: string) {
  const trimmedValue = value.trim()

  if (trimmedValue.length >= 2 && trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) {
    return trimmedValue.slice(1, -1)
  }

  return trimmedValue
}

export function buildSpeakerSuggestions(
  lines: VNProject["lines"],
  characters: CharacterMap,
  query: string
): SpeakerSuggestion[] {
  const normalizedQuery = normalizeSpeaker(query).toLowerCase()

  return getActiveSpeakers(lines)
    .map((displayName) => {
      const exportId = characters[displayName]?.id ?? ""
      const strippedExportId = stripOuterQuotes(exportId)

      return {
        displayName,
        id: exportId,
        matchValues: [
          displayName.toLowerCase(),
          exportId.toLowerCase(),
          strippedExportId.toLowerCase()
        ].filter(Boolean)
      }
    })
    .filter((suggestion) => {
      if (!normalizedQuery) {
        return true
      }

      return suggestion.matchValues.some((value) => value.includes(normalizedQuery))
    })
}
