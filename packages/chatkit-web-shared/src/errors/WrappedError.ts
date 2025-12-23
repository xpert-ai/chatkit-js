import type { ChatKitResponseMetadata } from "./HttpError"

export const FRAME_SAFE_ERROR_KEY = "__chatkit_error__"

export class FrameSafeWrappedError {
  [FRAME_SAFE_ERROR_KEY]: string
  message: string
  stack?: string

  constructor(error: Error) {
    this[FRAME_SAFE_ERROR_KEY] = error.name
    this.message = error.message
    this.stack = error.stack
  }
}

// Wraps an original with a context-aware error message and name
// while preserving the original error stack.
export abstract class WrappedError extends Error {
  override cause: unknown
  eventName: string
  metadata?: ChatKitResponseMetadata;
  // TODO(jiwon): remove after Kakao moves away from referencing __chatkit_error__ directly.
  [FRAME_SAFE_ERROR_KEY]: string

  // Define an explicit getter for the error name so that it is not minified away.
  protected get canonicalName(): string {
    if (import.meta.env["DEV"]) {
      throw new Error("Subclass must override canonicalName")
    }
    return "AppError"
  }

  constructor(original: unknown, messagePrefix?: string) {
    const errorMessage = original instanceof Error ? original.message : String(original)
    const cause = original instanceof Error ? original : undefined
    super(errorMessage, { cause })

    // Make sure we set the name as the runtime subclass name
    this.name = this.canonicalName

    const prefix = messagePrefix ? messagePrefix + ": " : ""
    if (!errorMessage.startsWith(prefix)) {
      this.message = `${prefix}${errorMessage}`
    }

    // TODO(jiwon): remove this once partner moves away from referencing __chatkit_error__ directly
    this[FRAME_SAFE_ERROR_KEY] = this.name

    // MyComponentError -> error.myComponent
    this.eventName =
      this.name.length > 0
        ? `error.${this.name.charAt(0).toLowerCase() + this.name.slice(1).replace(/Error$/i, "")}`
        : "error.app"

    // Copy over original error stack and metadata (these won't get copied over by default).
    if (cause && cause.stack) {
      this.stack = cause.stack
    }
    if (cause && "metadata" in cause && cause.metadata) {
      this.metadata = cause.metadata as ChatKitResponseMetadata
    }
  }

  static fromPossibleFrameSafeError(error: unknown): WrappedError | null {
    if (
      error &&
      typeof error === "object" &&
      FRAME_SAFE_ERROR_KEY in error &&
      typeof error[FRAME_SAFE_ERROR_KEY] === "string" &&
      NAME_TO_ERROR_CLASS[error[FRAME_SAFE_ERROR_KEY] as keyof typeof NAME_TO_ERROR_CLASS]
    ) {
      const safeError = error as FrameSafeWrappedError
      const ErrorCls =
        NAME_TO_ERROR_CLASS[error[FRAME_SAFE_ERROR_KEY] as keyof typeof NAME_TO_ERROR_CLASS]!
      const parsedError = new ErrorCls(safeError.message)
      parsedError.stack = safeError.stack
      parsedError.name = safeError[FRAME_SAFE_ERROR_KEY]
      // TODO(jiwon): remove this once partner moves away from referencing __chatkit_error__ directly.
      parsedError[FRAME_SAFE_ERROR_KEY] = safeError[FRAME_SAFE_ERROR_KEY]
      return parsedError
    }
    return null
  }
}

// The public error version of StreamError defined in chatkit-web-inner/src/lib/errors/StreamError.ts
export class StreamError extends WrappedError {
  override get canonicalName(): string {
    return "StreamError"
  }
}

export class StreamEventParsingError extends WrappedError {
  override get canonicalName(): string {
    return "StreamEventParsingError"
  }
  constructor(original: unknown) {
    const messagePrefix = "Failed to parse stream event"
    super(original, messagePrefix)
  }
}

export class StreamEventHandlingError extends WrappedError {
  override get canonicalName(): string {
    return "StreamEventHandlingError"
  }
  constructor(original: unknown) {
    const messagePrefix = "Failed to handle stream event"
    super(original, messagePrefix)
  }
}

export class StreamStopError extends WrappedError {
  override get canonicalName(): string {
    return "StreamStopError"
  }
  constructor(original: unknown) {
    const messagePrefix = "Failed to stop stream"
    super(original, messagePrefix)
  }
}
export class ThreadRenderingError extends WrappedError {
  override get canonicalName(): string {
    return "ThreadRenderingError"
  }
}

export class HistoryViewError extends WrappedError {
  override get canonicalName(): string {
    return "HistoryViewError"
  }
  constructor(original: unknown) {
    const messagePrefix = "Failed to load conversation"
    super(original, messagePrefix)
  }
}

export class EntitySearchError extends WrappedError {
  override get canonicalName(): string {
    return "EntitySearchError"
  }
  static fromQuery(error: unknown, query: string) {
    const messagePrefix = `Failed to search entities for query: ${query}`
    return new EntitySearchError(error, messagePrefix)
  }
}

export class WidgetItemError extends WrappedError {
  override get canonicalName(): string {
    return "WidgetItemError"
  }
}

export class InitialThreadLoadError extends WrappedError {
  override get canonicalName(): string {
    return "InitialThreadLoadError"
  }
  constructor(original: unknown) {
    const messagePrefix = "Failed to load initial thread"
    super(original, messagePrefix)
  }
}

export class FileAttachmentError extends WrappedError {
  override get canonicalName(): string {
    return "FileAttachmentError"
  }
  constructor(original: unknown) {
    const messagePrefix = "Failed to upload file"
    super(original, messagePrefix)
  }
}

export class UnhandledError extends WrappedError {
  override get canonicalName(): string {
    return "UnhandledError"
  }
}

export class UnhandledPromiseRejectionError extends WrappedError {
  override get canonicalName(): string {
    return "UnhandledPromiseRejectionError"
  }
}

export class IntlError extends WrappedError {
  code: string

  override get canonicalName(): string {
    return "IntlError"
  }
  constructor(original: unknown) {
    const messagePrefix = "Intl error"
    super(original, messagePrefix)
    this.code =
      typeof original === "object" && original !== null && "code" in original
        ? String(original.code)
        : ""
  }
}

export class FatalAppError extends WrappedError {
  override get canonicalName(): string {
    return "FatalAppError"
  }
}

export class NetworkError extends WrappedError {
  override get canonicalName(): string {
    return "NetworkError"
  }
}

export class DomainVerificationRequestError extends WrappedError {
  override get canonicalName(): string {
    return "DomainVerificationRequestError"
  }
}

/** Generic app error class for one-off errors that don't fit into other categories. */
export class AppError extends WrappedError {
  override get canonicalName(): string {
    return "AppError"
  }
}

const NAME_TO_ERROR_CLASS = {
  StreamError,
  StreamEventParsingError,
  StreamEventHandlingError,
  StreamStopError,
  ThreadRenderingError,
  HistoryViewError,
  EntitySearchError,
  WidgetItemError,
  InitialThreadLoadError,
  FileAttachmentError,
  UnhandledError,
  UnhandledPromiseRejectionError,
  IntlError,
  DomainVerificationRequestError,
  NetworkError,
  FatalAppError,
} as const
