export function normalizeSpeaker(speaker: string) {
  return speaker.trim()
}

export function isHeadingSpeaker(speaker: string): boolean {
  return /^#[1-4]$/.test(normalizeSpeaker(speaker))
}

export function getHeadingLevel(speaker: string): number | null {
  const match = normalizeSpeaker(speaker).match(/^#([1-4])$/)
  return match ? Number(match[1]) : null
}

export function isNoteSpeaker(speaker: string): boolean {
  return normalizeSpeaker(speaker) === "#"
}

export function isNarrationSpeaker(speaker: string): boolean {
  return normalizeSpeaker(speaker) === ""
}

export function isSpecialSpeaker(speaker: string): boolean {
  return isNarrationSpeaker(speaker) || isNoteSpeaker(speaker) || isHeadingSpeaker(speaker)
}

export function isCharacterSpeakerName(speaker: string): boolean {
  return !isSpecialSpeaker(speaker)
}

export function isRoleSpeaker(speaker: string): boolean {
  return isCharacterSpeakerName(speaker)
}
