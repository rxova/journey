import React from "react";
import { linearToGraphDefinition } from "@rxova/journey-core/convert";
import { buildLinearSteps } from "./linear.helpers";
import { deriveStepsFromObject } from "./derive-steps";
import { useLinearJourney } from "./use-linear-journey";
import { useLinearJourneySelector } from "./use-linear-journey-selector";
import { useLinearJourneyStep } from "./use-linear-journey-step";
import { LinearJourney } from "./linear";
import type { AnyJourneyPlugin, GraphJourneyDefinition } from "@rxova/journey-core";
import type {
  UseLinearJourneyResult,
  LinearJourneyPersistProp,
  LinearJourneyProps,
  LinearJourneySnapshot,
  LinearJourneyStepHandler,
  LinearJourneyStepsProp
} from "./linear.types";

/** Render-time overrides accepted by a bundle's pre-bound LinearJourney. */
export type LinearJourneyBundleProps<TContext> = Partial<
  Pick<
    LinearJourneyProps<TContext>,
    | "context"
    | "startStepId"
    | "startIndex"
    | "header"
    | "footer"
    | "wrapper"
    | "fallback"
    | "onStepChange"
    | "onStepEnter"
    | "onStepLeave"
    | "onComplete"
    | "onError"
    | "machineRef"
  >
>;

export type LinearJourneyBundle<TContext, TStepId extends string> = {
  /** Pre-bound LinearJourney: no steps/context props needed; accepts render-time overrides. */
  LinearJourney: React.ComponentType<LinearJourneyBundleProps<TContext>>;
  useLinearJourney: () => UseLinearJourneyResult<TContext, TStepId>;
  useLinearJourneySelector: <TSelected>(
    selector: (snapshot: LinearJourneySnapshot<TContext, TStepId>) => TSelected,
    equalityFn?: (a: TSelected, b: TSelected) => boolean
  ) => TSelected;
  useLinearJourneyStep: (handler?: LinearJourneyStepHandler<TContext>) => void;
  /** Emits the equivalent core graph definition (linear→graph migration). */
  toGraphDefinition: () => GraphJourneyDefinition<TContext, TStepId>;
};

export type CreateLinearJourneyConfig<TContext, TSteps extends LinearJourneyStepsProp<TContext>> = {
  context: TContext;
  /** Object form only — the keys give the typed step-id union. */
  steps: TSteps;
  startStepId?: Extract<keyof TSteps, string>;
  persist?: LinearJourneyPersistProp;
  plugins?: readonly AnyJourneyPlugin[];
};

/**
 * The typed escape hatch over the zero-config `<LinearJourney>`: context and step-id
 * types are fully inferred from the config, so `bundle.useLinearJourney()` needs no
 * generics at call sites.
 *
 * Crucially, `createLinearJourney` does **not** create a machine — it returns typed
 * re-exports bound to the same internal React context; the machine is still
 * created per `<bundle.LinearJourney>` mount. Zero-config and bundle linear journeys share
 * one runtime path.
 */
export const createLinearJourney = <
  TContext,
  const TSteps extends LinearJourneyStepsProp<TContext>
>(
  config: CreateLinearJourneyConfig<TContext, TSteps>
): LinearJourneyBundle<TContext, Extract<keyof TSteps, string>> => {
  type TStepId = Extract<keyof TSteps, string>;

  const BundleLinearJourney: React.ComponentType<LinearJourneyBundleProps<TContext>> = (
    overrides
  ) =>
    React.createElement(LinearJourney as never, {
      steps: config.steps as LinearJourneyStepsProp,
      context: overrides.context ?? config.context,
      ...(config.startStepId !== undefined ? { startStepId: config.startStepId } : {}),
      ...(config.persist !== undefined ? { persist: config.persist } : {}),
      ...(config.plugins !== undefined ? { plugins: config.plugins } : {}),
      ...overrides
    });
  BundleLinearJourney.displayName = "LinearJourneyBundle";

  return {
    LinearJourney: BundleLinearJourney,
    useLinearJourney: () => useLinearJourney<TContext, TStepId>(),
    useLinearJourneySelector: (selector, equalityFn) =>
      useLinearJourneySelector(selector as never, equalityFn) as ReturnType<typeof selector>,
    useLinearJourneyStep: (handler) => useLinearJourneyStep<TContext>(handler),
    toGraphDefinition: () =>
      linearToGraphDefinition({
        steps: buildLinearSteps(deriveStepsFromObject(config.steps as never)),
        context: config.context
      }) as unknown as GraphJourneyDefinition<TContext, TStepId>
  };
};
