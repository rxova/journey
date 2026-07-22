/**
 * Machine-readable reasons a journey can refuse to build or operate.
 *
 * Closed on purpose: consumers should be able to `switch` over it exhaustively.
 * Adding a member is a minor change; removing or repurposing one is not done
 * within a major.
 */
export type JourneyErrorCode =
  /** A definition declared no steps. */
  | "empty-definition"
  /** The same step id was declared twice. */
  | "duplicate-step-id"
  /** A step id was referenced that the definition does not declare. */
  | "unknown-step"
  /** `initial` names a step the definition does not declare. */
  | "unknown-initial-step"
  /** A transition's `from` or `to` names a step that does not exist. */
  | "dangling-transition"
  /** Two plugins claimed the same `name`. */
  | "duplicate-plugin-name"
  /** Persistence was requested but no usable storage could be resolved. */
  | "storage-unavailable"
  /** Navigation work's `commit` returned a promise; it must be synchronous. */
  | "async-commit";

export type JourneyErrorDetails = {
  /** The offending step id, where one caused the failure. */
  readonly stepId?: string;
  /** The offending event name, for transition failures. */
  readonly event?: string;
  /** The offending plugin name, for plugin failures. */
  readonly pluginName?: string;
};

/**
 * Every error core throws itself.
 *
 * Before this existed, distinguishing "duplicate plugin name" from "unknown step
 * in transition" meant matching on the message text — which quietly made every
 * message a compatibility promise. `code` is the stable contract; `message` is
 * for humans and may be reworded in any release.
 *
 * Errors surfaced through `NavigationResult.error` and the `error` subscription
 * event stay `unknown`: those carry whatever the caller's own work threw, which
 * core cannot constrain.
 */
export class JourneyError extends Error {
  readonly code: JourneyErrorCode;
  readonly stepId: string | undefined;
  readonly event: string | undefined;
  readonly pluginName: string | undefined;

  constructor(code: JourneyErrorCode, message: string, details: JourneyErrorDetails = {}) {
    super(`journey: ${message}`);
    this.name = "JourneyError";
    this.code = code;
    this.stepId = details.stepId;
    this.event = details.event;
    this.pluginName = details.pluginName;
  }
}

/** Narrowing helper, so consumers need not import the class to test for it. */
export const isJourneyError = (value: unknown): value is JourneyError =>
  value instanceof JourneyError;
