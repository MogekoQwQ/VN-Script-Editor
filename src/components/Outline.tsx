import { memo, useMemo } from "react"
import type { ScriptLine } from "../types"
import { getHeadingLevel, isHeadingSpeaker } from "../utils/lineTypes"

type OutlineProps = {
  lines: ScriptLine[]
  activeLineId: string | null
  onSelectLine: (lineId: string) => void
}

const TEXT = {
  title: "目录",
  empty: "当前还没有可显示的标题。",
  untitled: "未命名标题"
}

function OutlineComponent({ lines, activeLineId, onSelectLine }: OutlineProps) {
  const headings = useMemo(
    () => lines.filter((line) => isHeadingSpeaker(line.speaker)),
    [lines]
  )

  return (
    <aside className="panel panel-outline">
      <div className="panel-header">
        <h2>{TEXT.title}</h2>
      </div>

      <div className="outline-list">
        {headings.length === 0 ? (
          <p className="empty-state">{TEXT.empty}</p>
        ) : (
          headings.map((line) => {
            const level = getHeadingLevel(line.speaker) ?? 1

            return (
              <button
                key={line.id}
                type="button"
                className={[
                  "outline-item",
                  `outline-level-${level}`,
                  activeLineId === line.id ? "is-active" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onSelectLine(line.id)}
              >
                <span className="outline-text">{line.content || TEXT.untitled}</span>
              </button>
            )
          })
        )}
      </div>
    </aside>
  )
}

export const Outline = memo(OutlineComponent)
