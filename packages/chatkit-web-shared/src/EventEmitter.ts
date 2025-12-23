import type { AnyFunction } from "./types"

export class EventEmitter<T extends Record<string, unknown> = Record<string, unknown>> {
  private callbacks = new Map<keyof T, Set<AnyFunction>>()

  on<E extends keyof T>(event: E, callback: (data: T[E]) => void) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, new Set())
    }
    this.callbacks.get(event)!.add(callback)
  }

  emit<E extends keyof T>(event: E, ...args: T[E] extends void ? [data?: T[E]] : [data: T[E]]) {
    // If T[E] is void, args is [], so data is undefined
    // If T[E] is not void, args is [data]
    const data = args[0] as T[E]
    this.callbacks.get(event)?.forEach((callback) => callback(data))
  }

  off<E extends keyof T>(event: E, callback?: (data: T[E]) => void) {
    if (!callback) {
      this.callbacks.delete(event)
    } else {
      this.callbacks.get(event)?.delete(callback)
    }
  }

  allOff() {
    this.callbacks.clear()
  }
}
