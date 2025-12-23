import { fetchEventSource } from "@microsoft/fetch-event-source"

import { FrameSafeHttpError } from "./errors/HttpError"
import { MAX_RETRY_ATTEMPTS, nextDelay } from "./requestRetry.js"

import type { FetchEventSourceInit } from "@microsoft/fetch-event-source"

class RetryableError extends Error {
  constructor(cause: FrameSafeHttpError) {
    super()
    this.cause = cause
  }
}

export const fetchEventSourceWithRetry = async (
  url: string,
  params: Omit<FetchEventSourceInit, "onerror" | "onclose">,
) => {
  let retryAttempt = 0
  const { onopen, ...restParams } = params
  await fetchEventSource(url, {
    ...restParams,
    onopen: async (res) => {
      onopen?.(res)
      if (res.ok && res.headers.get("content-type")?.startsWith("text/event-stream")) {
        // All is well, we can continue streaming.
        retryAttempt = 0 // reset on success
        return
      }

      // Throw FrameSafeHttpError so that it serializes correctly over postMessage
      const httpError = new FrameSafeHttpError(`Streaming failed: ${res.statusText}`, res)

      if (res.status >= 400 && res.status < 500) {
        // This is likely a fatal error, client's are supposed to send errors as SSE
        // but we can handle this gracefully by ending the streaming state. It could be
        // that this error is due to a misconfigured server or an upstream proxy returning
        // an error, etc.
        throw httpError
      } else {
        // A 5xx error, we can let the client retry.
        throw new RetryableError(httpError)
      }
    },
    onerror: (error) => {
      if (error instanceof RetryableError) {
        if (retryAttempt >= MAX_RETRY_ATTEMPTS) {
          throw error.cause
        }

        retryAttempt += 1
        return nextDelay(retryAttempt) // returning a number sets the retry wait
      }

      // All other errors are fatal and should not be retried.
      // TODO: log error for monitoring purposes
      throw error
    },
  })
}
