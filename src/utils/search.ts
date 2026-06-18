import type { ScriptLine } from "../types"

export type SearchMatch = {
  lineId: string
  field: "speaker" | "content"
  start: number
  end: number
}

function collectMatches(
  lineId: string,
  field: "speaker" | "content",
  value: string,
  query: string
) {
  if (!query) {
    return []
  }

  const matches: SearchMatch[] = []
  const lowerValue = value.toLowerCase()
  const lowerQuery = query.toLowerCase()
  let searchFrom = 0

  while (searchFrom <= lowerValue.length - lowerQuery.length) {
    const matchIndex = lowerValue.indexOf(lowerQuery, searchFrom)

    if (matchIndex < 0) {
      break
    }

    matches.push({
      lineId,
      field,
      start: matchIndex,
      end: matchIndex + query.length
    })

    searchFrom = matchIndex + query.length
  }

  return matches
}

export function findMatches(lines: ScriptLine[], query: string): SearchMatch[] {
  if (!query) {
    return []
  }

  return lines.flatMap((line) => [
    ...collectMatches(line.id, "speaker", line.speaker, query),
    ...collectMatches(line.id, "content", line.content, query)
  ])
}
