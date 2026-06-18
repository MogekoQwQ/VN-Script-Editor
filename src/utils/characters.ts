import type { CharacterMap, CharacterProfile, VNProject } from "../types"
import { DEFAULT_CHARACTER_COLOR } from "./colors"
import { isRoleSpeaker, normalizeSpeaker } from "./lineTypes"

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
