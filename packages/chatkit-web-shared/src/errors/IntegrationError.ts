import { FRAME_SAFE_ERROR_KEY } from "./WrappedError"

export class IntegrationError extends Error {
  _name: string

  constructor(message: string) {
    super(message)
    this.name = "IntegrationError"
    this._name = this.name
  }

  static fromPossibleFrameSafeError(error: unknown): IntegrationError | null {
    if (
      error &&
      typeof error === "object" &&
      FRAME_SAFE_ERROR_KEY in error &&
      error[FRAME_SAFE_ERROR_KEY] === "IntegrationError"
    ) {
      const safeError = error as FrameSafeIntegrationError
      const parsedError = new IntegrationError(safeError.message)
      parsedError.stack = safeError.stack
      return parsedError
    }
    return null
  }
}

// does not extend Error so that it serializes correctly over structured clone
export class FrameSafeIntegrationError {
  [FRAME_SAFE_ERROR_KEY] = "IntegrationError"
  message: string
  stack?: string
  constructor(message: string) {
    this.message = message
    this.stack = new Error(message).stack
  }
}
