import { FrameSafeHttpError } from "./HttpError"

/**
 * Host handlers may reject with DOM objects that postMessage cannot clone.
 * Send a cloneable error so the iframe's pending request settles instead of hanging at startup.
 */
export function serializeFrameError(error: unknown): unknown {
  try {
    return structuredClone(error)
  } catch {
    const message =
      error && typeof error === "object" && "message" in error && typeof error.message === "string"
        ? error.message
        : "ChatKit host request failed"

    if (error && typeof error === "object" && "status" in error && typeof error.status === "number") {
      return new FrameSafeHttpError(message, {
        status: error.status,
        statusText:
          "statusText" in error && typeof error.statusText === "string" ? error.statusText : undefined,
      })
    }

    // Do not forward the original cause or arbitrary properties: they may contain
    // ProgressEvent, XMLHttpRequest, callbacks, or other non-cloneable host state.
    return new Error(message)
  }
}
