import { isPromiseLike, JourneyTimeoutError, withAbortSignal, withTimeout } from "./helpers";

import type {
  JourneyAfterTransition,
  JourneyBaseEvent,
  JourneyEffectRejectedBranch,
  JourneyEffectResolvedBranch,
  JourneyJsonObject,
  JourneyStepEffect
} from "../types";
import type { JourneyMachineAsyncStateController } from "./async-state";
import type { JourneyMachineRuntime } from "./runtime";

export type JourneyMachineStepWorkController<TStepId extends string> = {
  runStepEffect: (stepId: TStepId, runVersion: number) => void;
  runStepTimers: (stepId: TStepId, runVersion: number) => void;
  /** Aborts and closes the in-flight effect and any pending `after` timers. */
  cancelStepWork: () => void;
};

/**
 * Runs a step's declarative async work: its `effect` on entry and its `after`
 * timers. One effect and one timer set are in-flight at a time; their
 * lifecycle controllers cancel on step exit (`cancelStepWork`), reset, or
 * dispose. The run/timeout/abort shell is engine-agnostic — what happens to
 * an outcome is not: the graph engine re-enters the serialized send pipeline
 * with synthetic events, the linear engine commits an internal branch move.
 * Callers inject that difference through the `route*` callbacks, which fire
 * only when the effect declares the corresponding branch (`onResolved` /
 * `onRejected`); without a branch the outcome lands in async state instead.
 */
export const createJourneyMachineStepWorkController = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent,
  THandlers extends Record<string, unknown>
>({
  runtime,
  asyncState,
  handlers,
  defaultTimeoutMs,
  getEffect,
  getAfter,
  effectLoadingEventType,
  effectErrorEventType,
  routeEffectResolved,
  routeEffectRejected,
  routeAfterElapsed
}: {
  runtime: JourneyMachineRuntime<TContext, TStepId, TEvents>;
  asyncState: JourneyMachineAsyncStateController<TStepId>;
  handlers: THandlers;
  defaultTimeoutMs: number | undefined;
  getEffect: (stepId: TStepId) => JourneyStepEffect<TContext, TStepId, THandlers> | undefined;
  getAfter: (
    stepId: TStepId
  ) => Record<number, JourneyAfterTransition<TContext, TStepId>> | undefined;
  /** Event type recorded in async state while the effect is invoking. */
  effectLoadingEventType: string;
  /** Event type recorded in async state when a branch-less effect rejects. */
  effectErrorEventType: string;
  routeEffectResolved: (args: {
    stepId: TStepId;
    onResolved: JourneyEffectResolvedBranch<TContext, TStepId, unknown>;
    output: unknown;
    runVersion: number;
  }) => void;
  routeEffectRejected: (args: {
    stepId: TStepId;
    onRejected: JourneyEffectRejectedBranch<TContext, TStepId>;
    error: unknown;
    runVersion: number;
  }) => void;
  routeAfterElapsed: (args: {
    stepId: TStepId;
    delayMs: number;
    transition: JourneyAfterTransition<TContext, TStepId>;
    runVersion: number;
  }) => void;
}): JourneyMachineStepWorkController<TStepId> => {
  let activeEffectController: AbortController | null = null;
  let activeAfterController: AbortController | null = null;

  const cancelStepWork = () => {
    for (const controller of [activeEffectController, activeAfterController]) {
      if (controller) {
        if (!controller.signal.aborted) {
          controller.abort();
        }
        runtime.closeLifecycle(controller);
      }
    }
    activeEffectController = null;
    activeAfterController = null;
  };

  const runStepEffect = (stepId: TStepId, runVersion: number) => {
    const effect = getEffect(stepId);
    if (!effect || !runtime.isRunActive(runVersion)) {
      return;
    }

    const controller = runtime.openLifecycle(runVersion);
    if (!controller) {
      return;
    }
    activeEffectController = controller;
    const { signal } = controller;

    asyncState.setStepLoading(stepId, "invoking", effectLoadingEventType, undefined, runVersion);

    void (async () => {
      let output: unknown;
      let failure: { error: unknown } | null = null;
      try {
        const result = effect.run({
          snapshot: runtime.getSnapshot(),
          context: runtime.peekSnapshot().context,
          from: stepId,
          handlers,
          signal
        });
        output = isPromiseLike(result)
          ? await withTimeout(
              withAbortSignal(result as PromiseLike<unknown>, signal),
              effect.timeoutMs ?? defaultTimeoutMs,
              () =>
                new JourneyTimeoutError(
                  `Step effect timed out after ${effect.timeoutMs ?? defaultTimeoutMs}ms (step: ${String(stepId)}).`
                )
            )
          : result;
      } catch (error) {
        failure = { error };
      } finally {
        if (activeEffectController === controller) {
          activeEffectController = null;
        }
        runtime.closeLifecycle(controller);
      }

      if (
        signal.aborted ||
        !runtime.isRunActive(runVersion) ||
        runtime.peekSnapshot().currentStepId !== stepId
      ) {
        return;
      }

      if (failure) {
        if (effect.onRejected) {
          routeEffectRejected({
            stepId,
            onRejected: effect.onRejected,
            error: failure.error,
            runVersion
          });
        } else {
          asyncState.setStepError(
            stepId,
            effectErrorEventType,
            failure.error,
            undefined,
            runVersion
          );
        }
        return;
      }

      if (effect.onResolved) {
        routeEffectResolved({ stepId, onResolved: effect.onResolved, output, runVersion });
      } else {
        asyncState.setStepIdle(stepId, runVersion);
      }
    })();
  };

  const runStepTimers = (stepId: TStepId, runVersion: number) => {
    const after = getAfter(stepId);
    if (!after || !runtime.isRunActive(runVersion)) {
      return;
    }

    const controller = runtime.openLifecycle(runVersion);
    if (!controller) {
      return;
    }
    activeAfterController = controller;
    const { signal } = controller;

    for (const delayKey of Object.keys(after)) {
      const delayMs = Number(delayKey);
      const transition = after[delayMs] as JourneyAfterTransition<TContext, TStepId>;
      const handle = setTimeout(() => {
        if (
          signal.aborted ||
          !runtime.isRunActive(runVersion) ||
          runtime.peekSnapshot().currentStepId !== stepId
        ) {
          return;
        }
        routeAfterElapsed({ stepId, delayMs, transition, runVersion });
      }, delayMs);
      signal.addEventListener("abort", () => clearTimeout(handle), { once: true });
    }
  };

  return { runStepEffect, runStepTimers, cancelStepWork };
};
