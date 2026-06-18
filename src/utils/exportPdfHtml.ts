import type { CharacterProfile, VNProject } from "../types"
import { getHeadingLevel, isHeadingSpeaker, isNarrationSpeaker, isNoteSpeaker, normalizeSpeaker } from "./lineTypes"
import { resolveCharacterColor } from "./colors"

export type PdfExportOptions = {
  includeHeadings: boolean
  includeNotes: boolean
}

const NOTE_LABEL = "\u3010\u5907\u6ce8\u3011"
const PREVIEW_TITLE = "PDF \u9605\u8bfb\u7a3f\u9884\u89c8"
const PRINT_BUTTON_TEXT = "\u6253\u5370 / \u4fdd\u5b58\u4e3a PDF"
const CLOSE_BUTTON_TEXT = "\u5173\u95ed"
const PRINT_HINT_TEXT =
  "\u8bf7\u5728\u6253\u5370\u5bf9\u8bdd\u6846\u4e2d\u9009\u62e9\u201c\u4fdd\u5b58\u4e3a PDF\u201d\u3002"

function getCharacterColor(value: string | CharacterProfile | undefined) {
  if (!value || typeof value === "string") {
    return "#000000"
  }

  return resolveCharacterColor(value.color)
}

function formatHtmlText(value: string) {
  return escapeHtml(value.trim()).replace(/\n/g, "<br />")
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function buildPrintableHtml(
  project: VNProject,
  options: PdfExportOptions = {
    includeHeadings: true,
    includeNotes: true
  }
): string {
  const contentBlocks = project.lines
    .map((line) => {
      const speaker = normalizeSpeaker(line.speaker)
      const content = line.content.trim()

      if (!content) {
        return ""
      }

      if (isHeadingSpeaker(speaker)) {
        if (!options.includeHeadings) {
          return ""
        }

        const level = getHeadingLevel(speaker) ?? 1
        const tag = `h${level}`
        return `<${tag}>${escapeHtml(content)}</${tag}>`
      }

      if (isNoteSpeaker(speaker)) {
        if (!options.includeNotes) {
          return ""
        }

        return `<p class="vn-line vn-note">${NOTE_LABEL}${formatHtmlText(content)}</p>`
      }

      if (isNarrationSpeaker(speaker)) {
        return `<p class="vn-line">${formatHtmlText(content)}</p>`
      }

      const speakerColor = getCharacterColor(project.characters[speaker])

      return [
        `<p class="vn-line">`,
        `<span class="vn-speaker" style="color: ${speakerColor};">`,
        `${escapeHtml(speaker)}\uff1a`,
        `</span>`,
        `${formatHtmlText(content)}`,
        `</p>`
      ].join("")
    })
    .filter(Boolean)
    .join("\n")

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(PREVIEW_TITLE)}</title>
    <style>
      @page {
        size: A4;
        margin: 18mm 18mm 20mm;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #fff;
      }

      body {
        font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Hiragino Sans GB", sans-serif;
        font-size: 12pt;
        line-height: 1.75;
        color: #222;
        background: #fff;
      }

      .print-toolbar {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid #ddd;
        background: #f7f7f7;
        font-size: 14px;
      }

      .print-toolbar button {
        padding: 7px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 999px;
        background: #fff;
        color: #1e293b;
        font: inherit;
        cursor: pointer;
      }

      .print-toolbar span {
        color: #475569;
      }

      .script-document {
        max-width: 760px;
        margin: 32px auto;
        padding: 0 24px 48px;
      }

      h1 {
        font-size: 20pt;
        margin: 0 0 16pt;
        page-break-before: always;
      }

      h1:first-of-type {
        page-break-before: auto;
      }

      h2 {
        font-size: 15pt;
        margin: 18pt 0 10pt;
      }

      h3 {
        font-size: 13pt;
        margin: 14pt 0 8pt;
      }

      h4 {
        font-size: 11.5pt;
        margin: 12pt 0 7pt;
        color: #475569;
      }

      .vn-line {
        margin: 0 0 8pt;
      }

      .vn-speaker {
        font-weight: 600;
      }

      .vn-note {
        color: #777;
        font-size: 10.5pt;
      }

      @media print {
        .print-toolbar {
          display: none !important;
        }

        .script-document {
          max-width: none;
          margin: 0;
          padding: 0;
        }
      }
    </style>
  </head>
  <body>
    <div class="print-toolbar">
      <button type="button" onclick="window.print()">${escapeHtml(PRINT_BUTTON_TEXT)}</button>
      <button type="button" onclick="window.close()">${escapeHtml(CLOSE_BUTTON_TEXT)}</button>
      <span>${escapeHtml(PRINT_HINT_TEXT)}</span>
    </div>
    <main class="script-document">
      ${contentBlocks}
    </main>
  </body>
</html>`
}

export function openPrintWindow(
  project: VNProject,
  options: PdfExportOptions = {
    includeHeadings: true,
    includeNotes: true
  }
): boolean {
  const printWindow = window.open("", "_blank")

  if (!printWindow) {
    return false
  }

  const html = buildPrintableHtml(project, options)
  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()

  return true
}
