export function createLineId() {
  return `line_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
