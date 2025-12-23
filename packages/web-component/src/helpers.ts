// ChatKitElement.ts

import type { RemoveMethods } from "@xpert-ai/chatkit-web-shared"

export const removeMethods = <T>(obj: T, seen = new WeakSet<object>()): RemoveMethods<T> => {
  if (typeof obj === "function") return "[ChatKitMethod]" as RemoveMethods<T>
  if (typeof obj !== "object" || obj === null) return obj as RemoveMethods<T>
  if (seen.has(obj)) return obj as RemoveMethods<T>
  seen.add(obj)

  if (Array.isArray(obj)) {
    return obj.map((c) => removeMethods(c, seen)) as RemoveMethods<T>
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value !== "function") {
      result[key] = removeMethods(value as unknown, seen)
    } else {
      result[key] = "[ChatKitMethod]"
    }
  }
  return result as RemoveMethods<T>
}

export const debounce = (fn: () => void, delay = 150) => {
  let timer: ReturnType<typeof setTimeout>
  return () => {
    clearTimeout(timer)
    timer = setTimeout(fn, delay)
  }
}
