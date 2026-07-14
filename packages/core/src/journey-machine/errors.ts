/**
 * Base class for every error thrown by the journey runtime. Catch this to
 * distinguish journey failures from unrelated errors, then narrow with the
 * specific subclasses and their `code` discriminants.
 */
export class JourneyError extends Error {
  override name = "JourneyError";
}

/** Discriminates the kind of invalid-definition failure on {@link JourneyDefinitionError}. */
export type JourneyDefinitionErrorCode =
  | "invalid-shape"
  | "unknown-step"
  | "reserved-step-id"
  | "duplicate-step"
  | "missing-initial"
  | "invalid-transition"
  | "invalid-timeout"
  | "invalid-effect"
  | "invalid-after"
  | "invalid-context"
  | "invalid-initial-snapshot"
  | "self-transition";

/**
 * Thrown at creation time when a journey definition is structurally invalid —
 * an unknown step target, a malformed transition, a self-transition, and so on.
 * The `code` field categorizes the failure.
 */
export class JourneyDefinitionError extends JourneyError {
  override name = "JourneyDefinitionError";
  readonly code: JourneyDefinitionErrorCode;

  constructor(code: JourneyDefinitionErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** Discriminates the kind of runtime/plugin-state failure on {@link JourneyStateError}. */
export type JourneyStateErrorCode =
  | "duplicate-registration"
  | "plugin-conflict"
  | "invalid-snapshot";

/**
 * Thrown when the runtime or its plugin wiring reaches an invalid state — a
 * duplicate devtools registration, a plugin extension collision, or a malformed
 * snapshot. The `code` field categorizes the failure.
 */
export class JourneyStateError extends JourneyError {
  override name = "JourneyStateError";
  readonly code: JourneyStateErrorCode;

  constructor(code: JourneyStateErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** Discriminates the kind of persistence-config failure on {@link JourneyPersistenceError}. */
export type JourneyPersistenceErrorCode = "invalid-path" | "invalid-config";

/**
 * Thrown when persistence configuration is invalid — a malformed allow/block
 * list path, or an option of the wrong shape. The `code` field categorizes the
 * failure.
 */
export class JourneyPersistenceError extends JourneyError {
  override name = "JourneyPersistenceError";
  readonly code: JourneyPersistenceErrorCode;

  constructor(code: JourneyPersistenceErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** Thrown when an async step effect or guard exceeds its configured `timeoutMs`. */
export class JourneyTimeoutError extends JourneyError {
  override name = "JourneyTimeoutError";

  constructor(message: string) {
    super(message);
  }
}

/** Thrown when an operation is attempted on a journey machine that has been disposed. */
export class JourneyDisposedError extends JourneyError {
  override name = "JourneyDisposedError";
  readonly operation: string;

  constructor(operation: string) {
    super(`Journey machine has been disposed; "${operation}" can no longer be used.`);
    this.operation = operation;
  }
}
