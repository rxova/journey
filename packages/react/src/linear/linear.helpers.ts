import { createPersistencePlugin } from "@rxova/journey-core/persistence";
import type { AnyJourneyPlugin, LinearStepConfig } from "@rxova/journey-core";
import type { JourneyStorage } from "@rxova/journey-core/persistence";
import type { DerivedLinearJourneyStep } from "./derive-steps";
import type { LinearJourneyPersistProp } from "./linear.types";

/** Signature used to detect step-list changes across renders (order-sensitive). */
export const stepListSignature = (steps: readonly DerivedLinearJourneyStep[]): string =>
  steps.map((step) => step.id).join(" ");

/** Maps derived linear journey steps onto core linear step configs (`meta` → `metadata`). */
export const buildLinearSteps = (
  steps: readonly DerivedLinearJourneyStep[]
): LinearStepConfig<unknown, string, unknown>[] => {
  if (steps.length === 0) {
    throw new Error("<LinearJourney> needs at least one step.");
  }
  return steps.map((step) => ({
    id: step.id,
    ...(step.config.meta !== undefined ? { metadata: step.config.meta } : {}),
    ...(step.config.onEnter !== undefined ? { onEnter: step.config.onEnter } : {}),
    ...(step.config.onLeave !== undefined ? { onLeave: step.config.onLeave } : {})
  }));
};

/** Expands the `persist` sugar into the core persistence plugin. */
export const buildPersistPlugin = (persist: LinearJourneyPersistProp): AnyJourneyPlugin =>
  createPersistencePlugin({
    key: persist.key,
    storage: persist.storage ?? (globalThis.localStorage as JourneyStorage)
  });

export type InterceptorState = {
  readonly pending: boolean;
  readonly error: unknown;
};

/**
 * Per-journey registry for `useLinearJourneyStep` handlers, with an observable
 * pending/error state. The core dropped navigation interceptors — cancellation
 * belongs to `onLeave` — so the linear journey tier awaits the active step's handler
 * before forwarding `goToNextStep` to the machine.
 */
export type InterceptorStore = {
  register(stepId: string, handler: (() => void | Promise<void>) | undefined): () => void;
  /** Runs the handler for `stepId`; returns false when it threw (navigation must not proceed). */
  run(stepId: string): Promise<boolean>;
  getState(): InterceptorState;
  clearError(): void;
  subscribe(listener: () => void): () => void;
};

export const createInterceptorStore = (
  onHandlerError?: (error: unknown) => void
): InterceptorStore => {
  const handlers = new Map<string, () => void | Promise<void>>();
  const listeners = new Set<() => void>();
  let state: InterceptorState = { pending: false, error: null };

  const setState = (next: InterceptorState) => {
    state = next;
    for (const listener of [...listeners]) listener();
  };

  return {
    register(stepId, handler) {
      if (handler) {
        handlers.set(stepId, handler);
      } else {
        handlers.delete(stepId);
      }
      return () => {
        handlers.delete(stepId);
      };
    },
    async run(stepId) {
      const handler = handlers.get(stepId);
      if (!handler) return true;
      setState({ pending: true, error: null });
      try {
        await handler();
        setState({ pending: false, error: null });
        return true;
      } catch (error) {
        setState({ pending: false, error });
        onHandlerError?.(error);
        return false;
      }
    },
    getState: () => state,
    clearError: () => {
      if (state.error !== null) setState({ ...state, error: null });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
};
