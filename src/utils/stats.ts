import type { VNProject } from "../types"
import { isNarrationSpeaker, isRoleSpeaker } from "./lineTypes"

export type ProjectStats = {
  totalChars: number
  bodyChars: number
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

      if (isNarrationSpeaker(speaker) || isRoleSpeaker(speaker)) {
        stats.bodyChars += charCount
      }

      return stats
    },
    {
      totalChars: 0,
      bodyChars: 0
    }
  )
}
