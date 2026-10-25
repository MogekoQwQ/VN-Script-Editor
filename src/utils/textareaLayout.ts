const pending = new Set<HTMLTextAreaElement>()
const widths = new WeakMap<HTMLTextAreaElement, number>()
let frame: number | null = null
let observer: ResizeObserver | null = null

export function resizeTextarea(element: HTMLTextAreaElement | null) {
  if (!element) return
  queueResize(element)
}

function queueResize(element: HTMLTextAreaElement) {
  pending.add(element)
  if (frame !== null) return
  frame = requestAnimationFrame(() => {
    frame = null
    const elements = [...pending].filter((item) => item.isConnected)
    pending.clear()
    // Batch writes and reads so resizing many rows only measures layout once.
    elements.forEach((item) => { item.style.height = "0px" })
    const heights = elements.map((item) => item.scrollHeight)
    elements.forEach((item) => widths.set(item, item.clientWidth))
    elements.forEach((item, index) => { item.style.height = `${heights[index]}px` })
  })
}

export function observeTextareaWidth(element: HTMLTextAreaElement) {
  if (typeof ResizeObserver === "undefined") {
    const handleResize = () => queueResize(element)
    window.addEventListener("resize", handleResize)
    return () => { window.removeEventListener("resize", handleResize); pending.delete(element) }
  }
  observer ??= new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      const target = entry.target as HTMLTextAreaElement
      const width = Math.round(entry.contentRect.width)
      // Height changes are caused by auto-sizing itself; never observe them again.
      if (width <= 0 || widths.get(target) === width) return
      widths.set(target, width)
      queueResize(target)
    })
  })
  observer.observe(element)
  return () => {
    observer?.unobserve(element)
    widths.delete(element)
    pending.delete(element)
  }
}
