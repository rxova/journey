/** Machine-readable reasons a judgement fails. Closed, so a `switch` over it is exhaustive. */
export type JudgeErrorCode =
  /** `createJudge` options or an `ask` input that cannot be judged. */
  | "invalid"
  /** Every call of a sample round failed, after its retries. */
  | "unreachable"
  /** The caller's signal aborted the judgement. */
  | "aborted";

/** Every error the judge rejects with itself. `cause` carries the underlying failure. */
export class JudgeError extends Error {
  readonly code: JudgeErrorCode;

  constructor(code: JudgeErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "JudgeError";
    this.code = code;
  }
}

/** Narrows an unknown rejection to a {@link JudgeError}. */
export const isJudgeError = (error: unknown): error is JudgeError => error instanceof JudgeError;
