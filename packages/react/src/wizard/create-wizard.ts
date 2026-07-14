import React from "react";

import { toGraphDefinition } from "@rxova/journey-core";

import { buildLinearDefinition } from "./build-machine";
import { deriveStepsFromObject } from "./derive-steps";
import { useWizard, useWizardSelector } from "./use-wizard";
import { useWizardStep } from "./use-wizard-step";
import { Wizard } from "./Wizard";

import type {
  JourneyDefinition,
  JourneyEqualityFn,
  JourneyJsonObject,
  JourneyMachinePlugin,
  LinearJourneyDefinition,
  LinearJourneySnapshot
} from "@rxova/journey-core";
import type {
  UseWizardResult,
  WizardPersistProp,
  WizardProps,
  WizardStepHandler,
  WizardStepsProp
} from "./types";

/** Render-time overrides accepted by a bundle's pre-bound Wizard. */
export type WizardBundleProps<TContext extends JourneyJsonObject> = Partial<
  Pick<
    WizardProps<TContext>,
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

export type WizardBundle<TContext extends JourneyJsonObject, TStepId extends string> = {
  /** Pre-bound Wizard: no steps/context props needed; accepts render-time overrides. */
  Wizard: React.ComponentType<WizardBundleProps<TContext>>;
  useWizard: () => UseWizardResult<TContext, TStepId>;
  useWizardSelector: <TSelected>(
    selector: (snapshot: LinearJourneySnapshot<TContext, TStepId>) => TSelected,
    equalityFn?: JourneyEqualityFn<TSelected>
  ) => TSelected;
  useWizardStep: (handler?: WizardStepHandler<TContext>) => void;
  /** Emits the equivalent core graph JourneyDefinition (linear→graph migration). */
  toGraphDefinition: () => JourneyDefinition<TContext, TStepId>;
};

export type CreateWizardConfig<
  TContext extends JourneyJsonObject,
  TSteps extends WizardStepsProp<TContext>
> = {
  context: TContext;
  /** Object form only — the keys give the typed step-id union. */
  steps: TSteps;
  startStepId?: Extract<keyof TSteps, string>;
  persist?: WizardPersistProp;
  plugins?: readonly JourneyMachinePlugin[];
  handlers?: Record<string, unknown>;
  requireExplicitCompletion?: boolean;
};

/**
 * The typed escape hatch over the zero-config `<Wizard>`: context and step-id
 * types are fully inferred from the config, so `bundle.useWizard()` needs no
 * generics at call sites.
 *
 * Crucially, `createWizard` does **not** create a machine — it returns typed
 * re-exports bound to the same internal React context; the machine is still
 * created per `<bundle.Wizard>` mount. Zero-config and bundle wizards share
 * one runtime path.
 */
export const createWizard = <
  TContext extends JourneyJsonObject,
  const TSteps extends WizardStepsProp<TContext>
>(
  config: CreateWizardConfig<TContext, TSteps>
): WizardBundle<TContext, Extract<keyof TSteps, string>> => {
  type TStepId = Extract<keyof TSteps, string>;

  const BundleWizard: React.ComponentType<WizardBundleProps<TContext>> = (overrides) =>
    React.createElement(Wizard as never, {
      steps: config.steps as WizardStepsProp<JourneyJsonObject>,
      context: overrides.context ?? config.context,
      ...(config.startStepId !== undefined ? { startStepId: config.startStepId } : {}),
      ...(config.persist !== undefined ? { persist: config.persist } : {}),
      ...(config.plugins !== undefined ? { plugins: config.plugins } : {}),
      ...(config.handlers !== undefined ? { handlers: config.handlers } : {}),
      ...(config.requireExplicitCompletion !== undefined
        ? { requireExplicitCompletion: config.requireExplicitCompletion }
        : {}),
      ...overrides
    });
  BundleWizard.displayName = "WizardBundle";

  return {
    Wizard: BundleWizard,
    useWizard: () => useWizard<TContext, TStepId>(),
    useWizardSelector: (selector, equalityFn) =>
      useWizardSelector(selector as never, equalityFn) as ReturnType<typeof selector>,
    useWizardStep: (handler) => useWizardStep<TContext>(handler),
    toGraphDefinition: () =>
      toGraphDefinition(
        buildLinearDefinition(
          deriveStepsFromObject(config.steps as WizardStepsProp<JourneyJsonObject>),
          config.context
        ) as LinearJourneyDefinition<TContext, TStepId>
      )
  };
};
