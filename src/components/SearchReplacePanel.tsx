import { type KeyboardEvent, type Ref } from "react"

type SearchReplacePanelProps = {
  searchQuery: string
  replaceValue: string
  matchCount: number
  currentMatchIndex: number
  statusText: string
  searchInputRef?: Ref<HTMLInputElement>
  onSearchQueryChange: (value: string) => void
  onReplaceValueChange: (value: string) => void
  onPreviousMatch: () => void
  onNextMatch: () => void
  onReplaceCurrent: () => void
  onReplaceAll: () => void
  onFocusChange: (focused: boolean) => void
}

const TEXT = {
  find: "\u67e5\u627e",
  replace: "\u66ff\u6362",
  previous: "\u4e0a\u4e00\u4e2a",
  next: "\u4e0b\u4e00\u4e2a",
  replaceCurrent: "\u66ff\u6362\u5f53\u524d",
  replaceAll: "\u5168\u90e8\u66ff\u6362",
  countEmpty: "0 / 0"
}

export function SearchReplacePanel({
  searchQuery,
  replaceValue,
  matchCount,
  currentMatchIndex,
  statusText,
  searchInputRef,
  onSearchQueryChange,
  onReplaceValueChange,
  onPreviousMatch,
  onNextMatch,
  onReplaceCurrent,
  onReplaceAll,
  onFocusChange
}: SearchReplacePanelProps) {
  const hasMatches = matchCount > 0
  const canReplace = searchQuery !== "" && hasMatches
  const counterText = hasMatches
    ? `${currentMatchIndex + 1} / ${matchCount}`
    : TEXT.countEmpty

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()

      if (event.shiftKey) {
        onPreviousMatch()
      } else {
        onNextMatch()
      }
    }

    if (event.key === "Escape") {
      event.currentTarget.blur()
    }
  }

  const handleReplaceKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      onReplaceCurrent()
    }

    if (event.key === "Escape") {
      event.currentTarget.blur()
    }
  }

  return (
    <div
      className="search-panel"
      onFocusCapture={() => onFocusChange(true)}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget as Node | null

        if (nextTarget && event.currentTarget.contains(nextTarget)) {
          return
        }

        onFocusChange(false)
      }}
    >
      <div className="panel-field search-input-row">
        <span className="panel-field-label">{TEXT.find}</span>
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
      </div>

      <div className="panel-actions search-actions">
        <button type="button" onClick={onPreviousMatch} disabled={!hasMatches}>
          {TEXT.previous}
        </button>
        <button type="button" onClick={onNextMatch} disabled={!hasMatches}>
          {TEXT.next}
        </button>
        <span className="search-match-count">{counterText}</span>
      </div>

      <div className="panel-field search-input-row">
        <span className="panel-field-label">{TEXT.replace}</span>
        <input
          type="text"
          value={replaceValue}
          onChange={(event) => onReplaceValueChange(event.target.value)}
          onKeyDown={handleReplaceKeyDown}
        />
      </div>

      <div className="panel-actions search-actions">
        <button type="button" onClick={onReplaceCurrent} disabled={!canReplace}>
          {TEXT.replaceCurrent}
        </button>
        <button type="button" onClick={onReplaceAll} disabled={!canReplace}>
          {TEXT.replaceAll}
        </button>
      </div>

      <div className="export-status">{statusText || " "}</div>
    </div>
  )
}
