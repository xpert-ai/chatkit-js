import { FRAME_SAFE_ERROR_KEY } from "./WrappedError"

export interface ChatKitResponseMetadata {
  requestId?: string
  [key: string]: unknown
}

export class HttpError extends Error {
  status?: number
  statusText?: string
  metadata?: ChatKitResponseMetadata

  constructor(
    message: string,
    res: Response | { status?: number; statusText?: string },
    metadata?: ChatKitResponseMetadata,
  ) {
    super(message)
    this.name = "HttpError"
    this.statusText = res.statusText
    this.status = res.status
    this.metadata = metadata
  }

  static fromPossibleFrameSafeError(error: unknown): HttpError | null {
    if (error instanceof HttpError) {
      return error
    }

    if (
      error &&
      typeof error === "object" &&
      FRAME_SAFE_ERROR_KEY in error &&
      error[FRAME_SAFE_ERROR_KEY] === "HttpError"
    ) {
      const safeError = error as FrameSafeHttpError
      const parsedError = new HttpError(
        safeError.message,
        {
          status: safeError.status,
          statusText: safeError.statusText,
        },
        safeError.metadata,
      )
      parsedError.stack = safeError.stack
      return parsedError
    }

    return null
  }
}

// does not extend Error so that it serializes correctly over structured clone
export class FrameSafeHttpError {
  [FRAME_SAFE_ERROR_KEY] = "HttpError"
  message: string
  stack?: string
  status?: number
  statusText?: string
  metadata?: ChatKitResponseMetadata

  constructor(
    message: string,
    res: Response | { status?: number; statusText?: string },
    metadata?: ChatKitResponseMetadata,
  ) {
    this.message = message
    this.stack = new Error(message).stack
    this.status = res.status
    this.statusText = res.statusText
    this.metadata = metadata
  }

  static fromHttpError(error: HttpError): FrameSafeHttpError {
    return new FrameSafeHttpError(
      error.message,
      {
        status: error.status,
        statusText: error.statusText,
      },
      error.metadata,
    )
  }
}
