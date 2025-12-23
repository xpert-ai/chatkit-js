// Retry backoff parameters.
// TODO: consider making this configurable since this concerns API requests made to
// the integrator's server.
const BASE_RETRY_DELAY_MS = 1000
const MAX_RETRY_DELAY_MS = 10_000
export const MAX_RETRY_ATTEMPTS = 5

// Backoff with half jitter.
// With the default parameters, results in the following retry delays:
// 1st: 1–2s, 2nd: 2–4s, 3rd: 4–8s, 4th+: 5–10s (capped).
export const nextDelay = (
  attempt: number,
  maxRetryDelay = MAX_RETRY_DELAY_MS,
  baseDelayMs = BASE_RETRY_DELAY_MS,
) => {
  const max = Math.min(maxRetryDelay, baseDelayMs * 2 ** attempt)
  // uniform in [0.5*max, max)
  return Math.floor(max * (0.5 + Math.random() * 0.5))
}
