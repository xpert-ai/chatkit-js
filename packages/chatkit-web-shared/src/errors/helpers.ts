import { HttpError } from "./HttpError"
import { IntegrationError } from "./IntegrationError"
import { WrappedError } from "./WrappedError"

export function fromPossibleFrameSafeError(
  error: unknown,
): IntegrationError | HttpError | WrappedError | unknown {
  const integrationError = IntegrationError.fromPossibleFrameSafeError(error)
  if (integrationError) return integrationError

  const httpError = HttpError.fromPossibleFrameSafeError(error)
  if (httpError) return httpError

  return WrappedError.fromPossibleFrameSafeError(error) ?? error
}
