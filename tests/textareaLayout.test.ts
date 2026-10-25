import assert from "node:assert/strict"
import { observeTextareaWidth, resizeTextarea } from "../src/utils/textareaLayout"

const frames: FrameRequestCallback[] = []
const operations: string[] = []
let notify: ResizeObserverCallback
globalThis.requestAnimationFrame = (callback) => { frames.push(callback); return frames.length }
globalThis.ResizeObserver = class {
  constructor(callback: ResizeObserverCallback) { notify = callback }
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

function textarea(name: string, height: number) {
  return {
    isConnected: true,
    clientWidth: 300,
    style: { set height(value: string) { operations.push(`${name}:write:${value}`) } },
    get scrollHeight() { operations.push(`${name}:read`); return height }
  } as unknown as HTMLTextAreaElement
}

const first = textarea("first", 80)
const second = textarea("second", 120)
const stopFirst = observeTextareaWidth(first)
const stopSecond = observeTextareaWidth(second)
const emit = (width: number) => notify([
  { target: first, contentRect: { width } },
  { target: second, contentRect: { width } }
] as ResizeObserverEntry[], {} as ResizeObserver)
const flush = () => { const callbacks = frames.splice(0); callbacks.forEach((callback) => callback(0)) }

resizeTextarea(first)
resizeTextarea(second)
emit(300)
assert.equal(frames.length, 1, "All rows share one pending animation frame")
flush()
assert.deepEqual(operations, [
  "first:write:0px", "second:write:0px", "first:read", "second:read",
  "first:write:80px", "second:write:120px"
])
emit(300)
assert.equal(frames.length, 0, "Height-only notifications must not trigger another measurement")
emit(300.2)
assert.equal(frames.length, 0, "Subpixel observer widths must match the cached client width")
emit(200)
assert.equal(frames.length, 1, "A width change schedules one shared update")
stopFirst()
stopSecond()
operations.length = 0
flush()
assert.equal(operations.length, 0, "Unmounted rows are removed from queued updates")
console.log("Textarea batching, width-only observation and unmount cleanup passed.")
