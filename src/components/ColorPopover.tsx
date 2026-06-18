import { useRef } from "react"
import {
  DEFAULT_CHARACTER_COLOR,
  isValidHexColor,
  resolveCharacterColor
} from "../utils/colors"

type ColorPopoverProps = {
  color: string
  label: string
  onChange: (color: string) => void
}

export function ColorPopover({ color, label, onChange }: ColorPopoverProps) {
  const colorInputRef = useRef<HTMLInputElement | null>(null)
  const isColorValid = isValidHexColor(color)

  const handleColorButtonClick = () => {
    colorInputRef.current?.click()
  }

  return (
    <div className="color-popover">
      <button
        type="button"
        className={`character-color-button character-color-swatch ${
          isColorValid ? "" : "is-invalid"
        }`.trim()}
        style={{ backgroundColor: resolveCharacterColor(color) }}
        title={`${label} 颜色`}
        onClick={handleColorButtonClick}
      />

      <input
        ref={colorInputRef}
        className="character-color-input character-color-native-input"
        type="color"
        value={isColorValid ? color : DEFAULT_CHARACTER_COLOR}
        tabIndex={-1}
        aria-label={`${label} 颜色选择器`}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
