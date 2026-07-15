import { createPersistencePlugin } from "@rxova/journey-core/persistence";
import type {
  AnyJourneyPlugin,
  LinearSnapshot,
  LinearStepConfig,
  NavigationWork
} from "@rxova/journey-core";
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

/**
 * Per-journey registry for `useLinearJourneyStep` work. Core owns execution,
 * pending state, errors, and transactional context commits.
 */
export type InterceptorStore = {
  register(stepId: string, work: RegisteredNavigationWork | undefined): () => void;
  get(stepId: string): RegisteredNavigationWork | undefined;
};

export type RegisteredNavigationWork = NavigationWork<
  unknown,
  string,
  LinearSnapshot<unknown, string, unknown>,
  never
>;

export const createInterceptorStore = (): InterceptorStore => {
  const handlers = new Map<string, RegisteredNavigationWork>();

  return {
    register(stepId, work) {
      if (work) {
        handlers.set(stepId, work);
      } else {
        handlers.delete(stepId);
      }
      return () => {
        handlers.delete(stepId);
      };
    },
    get: (stepId) => handlers.get(stepId)
  };
};
