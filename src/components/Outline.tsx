import { memo, useMemo, useState } from "react"
import type { ScriptLine } from "../types"
import { getHeadingLevel } from "../utils/lineTypes"
import { parseScriptStructure } from "../utils/scriptStructure"

type OutlineProps = { lines: ScriptLine[]; activeLineId: string | null; onSelectLine: (lineId: string) => void }
type OutlineNode = { id: string; title: string; depth: number; level?: number; children: OutlineNode[] }

function OutlineComponent({ lines, activeLineId, onSelectLine }: OutlineProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const tree = useMemo(() => {
    const roots: OutlineNode[] = []
    const headings: { level: number; node: OutlineNode }[] = []
    const { blocks } = parseScriptStructure(lines)
    const menuNodes = new Map<string, OutlineNode>()
    lines.forEach((line, index) => {
      const level = getHeadingLevel(line.speaker)
      if (level) {
        while (headings.length && headings[headings.length - 1].level >= level) headings.pop()
        const node: OutlineNode = { id: line.id, title: line.content || "未命名标题", depth: level - 1, level, children: [] }
        ;(headings[headings.length - 1]?.node.children ?? roots).push(node)
        headings.push({ level, node })
      } else if (line.speaker.trim() === "#menu") {
        const parent = headings[headings.length - 1]
        const node: OutlineNode = { id: line.id, title: `◇ ${line.content || "未命名 Menu"}`, depth: parent ? parent.level : 0, children: [] }
        ;(parent?.node.children ?? roots).push(node)
        menuNodes.set(line.id, node)
      } else if (line.speaker.trim() === "#option") {
        const owner = blocks.find((block) => block.kind === "menu" && block.options.includes(index))
        const parent = owner && menuNodes.get(owner.id)
        const node: OutlineNode = { id: line.id, title: line.content || "未命名选项", depth: parent ? parent.depth + 1 : 0, children: [] }
        ;(parent?.children ?? roots).push(node)
      }
    })
    return roots
  }, [lines])
  const renderNode = (node: OutlineNode): React.ReactNode => <div key={node.id}>
    <div className={`outline-tree-row ${activeLineId === node.id ? "is-active" : ""}`} style={{ paddingLeft: `calc(${node.depth} * var(--outline-indent, 0.75rem))` }}>
      {node.children.length ? <button type="button" className="outline-toggle" aria-expanded={!collapsed.has(node.id)} aria-label="展开或折叠目录" onClick={() => setCollapsed((previous) => { const next = new Set(previous); if (next.has(node.id)) next.delete(node.id); else next.add(node.id); return next })}>{collapsed.has(node.id) ? "▸" : "▾"}</button> : <span className="outline-toggle" />}
      <button type="button" className={`outline-item ${node.level ? `outline-level-${node.level}` : ""}`} onClick={() => onSelectLine(node.id)}><span className="outline-text">{node.title}</span></button>
    </div>
    {!collapsed.has(node.id) ? node.children.map(renderNode) : null}
  </div>
  return <aside className="panel panel-outline"><div className="panel-header"><h2>目录</h2></div><div className="outline-list">{tree.length ? tree.map(renderNode) : <p className="empty-state">当前还没有可显示的标题或 Menu。</p>}</div></aside>
}
export const Outline = memo(OutlineComponent)
