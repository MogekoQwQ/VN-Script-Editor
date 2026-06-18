type SpeakerOption = {
  displayName: string
  id: string
}

type SpeakerAutocompleteProps = {
  options: SpeakerOption[]
  highlightedIndex: number
  onSelect: (option: SpeakerOption) => void
  onHover: (index: number) => void
}

export function SpeakerAutocomplete({
  options,
  highlightedIndex,
  onSelect,
  onHover
}: SpeakerAutocompleteProps) {
  if (options.length === 0) {
    return null
  }

  return (
    <div className="speaker-autocomplete" role="listbox">
      {options.map((option, index) => (
        <button
          key={`${option.displayName}:${option.id}`}
          type="button"
          className={`speaker-autocomplete-item ${highlightedIndex === index ? "is-active" : ""}`}
          onMouseDown={(event) => {
            event.preventDefault()
            onSelect(option)
          }}
          onMouseEnter={() => onHover(index)}
        >
          <span>{option.displayName}</span>
          <code>{option.id}</code>
        </button>
      ))}
    </div>
  )
}
