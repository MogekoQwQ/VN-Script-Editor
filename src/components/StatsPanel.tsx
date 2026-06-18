import { useMemo } from "react"
import type { VNProject } from "../types"
import { calculateStats } from "../utils/stats"

type StatsPanelProps = {
  project: VNProject
}

const LABELS = {
  total: "\u5168\u6587\u5b57\u6570",
  body: "\u6b63\u6587\u5b57\u6570"
}

export function StatsPanel({ project }: StatsPanelProps) {
  const stats = useMemo(() => calculateStats(project), [project])

  return (
    <div className="stats-list">
      <div className="stats-row">
        <span>{LABELS.total}</span>
        <strong className="stats-value">{stats.totalChars}</strong>
      </div>
      <div className="stats-row">
        <span>{LABELS.body}</span>
        <strong className="stats-value">{stats.bodyChars}</strong>
      </div>
    </div>
  )
}
