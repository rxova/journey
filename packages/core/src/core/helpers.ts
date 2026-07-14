import type { StepAsyncState } from "./types";

/** Hard cap on events processed from one raise cascade before it is dropped. */
export const MAX_RAISED_EVENTS = 25;

export const SUCCESS_ASYNC: StepAsyncState = Object.freeze({
  isLoading: false,
  isSuccess: true,
  isError: false,
  error: null
});

export const LOADING_ASYNC: StepAsyncState = Object.freeze({
  isLoading: true,
  isSuccess: false,
  isError: false,
  error: null
});

/** Subscriber exceptions are isolated so one listener cannot break the pipeline. */
export function reportListenerError(error: unknown): void {
  console.error("[journey] subscriber threw:", error);
}
