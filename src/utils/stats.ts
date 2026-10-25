import type { VNProject } from "../types"
import { isNarrationSpeaker, isRoleSpeaker } from "./lineTypes"

export type ProjectStats = {
  totalChars: number
  bodyChars: number
  totalLines: number
  bodyLines: number
}

function countContentChars(content: string) {
  return content.replace(/\s+/g, "").length
}

export function calculateStats(project: VNProject): ProjectStats {
  return project.lines.reduce<ProjectStats>(
    (stats, line) => {
      const speaker = line.speaker.trim()
      const charCount = countContentChars(line.content)

      stats.totalChars += charCount
      stats.totalLines += 1

      if (isNarrationSpeaker(speaker) || isRoleSpeaker(speaker)) {
        stats.bodyChars += charCount
        stats.bodyLines += 1
      }

      return stats
    },
    {
      totalChars: 0,
      bodyChars: 0,
      totalLines: 0,
      bodyLines: 0
    }
  )
}
