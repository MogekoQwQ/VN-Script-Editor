export const DEFAULT_CHARACTER_COLOR = "#000000"

export function isValidHexColor(color: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(color.trim())
}

export function resolveCharacterColor(color: string) {
  return isValidHexColor(color) ? color : DEFAULT_CHARACTER_COLOR
}
