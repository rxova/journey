import type React from "react";

/**
 * Make `id` a valid attribute on ANY component element — the same mechanism
 * React uses for `key` (which lives on `React.Attributes`, the base of
 * `JSX.IntrinsicAttributes`). This lets a step declare its wizard id inline
 * (`<Login id="login" />`) without the component having to add an `id` prop
 * to its own props type. `<Wizard>` reads the id off the element and strips
 * it before rendering, so it never reaches the component.
 *
 * Scope note: like Emotion's `css` prop, this augmentation is global for any
 * project that imports `@rxova/journey-react`.
 */
declare module "react" {
  interface Attributes {
    /** Step id when this element is a direct child of `<Wizard>`. */
    id?: string;
  }
}

import type {
  JourneyAfterTransition,
  JourneyEqualityFn,
  JourneyJsonObject,
  JourneyJsonValue,
  JourneyMachinePlugin,
  JourneySendResult,
  JourneyStatus,
  JourneyStepEffect,
  JourneyStepLifecycleCallback,
  LinearJourneyMachine,
  LinearJourneySnapshot
} from "@rxova/journey-core";
import type { JourneyEmpty } from "@rxova/journey-core";
import type { JourneyPersistenceOptions, JourneyStorage } from "@rxova/journey-core/persistence";

/** Full per-step configuration accepted by the steps-object form and `<Wizard.Step>`. */
export type WizardStepConfig<TContext extends JourneyJsonObject = JourneyJsonObject> = {
  component: React.ComponentType;
  meta?: JourneyJsonValue;
  onEnter?: JourneyStepLifecycleCallback<TContext, string, never, JourneyEmpty>;
  onLeave?: JourneyStepLifecycleCallback<TContext, string, never, JourneyEmpty>;
  effect?: JourneyStepEffect<TContext, string>;
  after?: Record<number, JourneyAfterTransition<TContext, string>>;
};

/**
 * The steps-object form: keys are step ids, insertion order is step order,
 * values are bare components or full config objects.
 */
export type WizardStepsProp<TContext extends JourneyJsonObject = JourneyJsonObject> = Record<
  string,
  React.ComponentType | WizardStepConfig<TContext>
>;

/** Payload passed to the Wizard-level `onStepChange` callback. */
export type WizardStepChange<TContext extends JourneyJsonObject = JourneyJsonObject> = {
  fromStepId: string | null;
  toStepId: string;
  fromIndex: number | null;
  toIndex: number;
  direction: "forward" | "backward" | "jump";
  context: TContext;
};

/** Sugar over the core persistence plugin. */
export type WizardPersistProp = {
  key: string;
  storage?: JourneyStorage;
  version?: number;
  migrate?: JourneyPersistenceOptions<JourneyJsonObject, string>["migrate"];
};

/** Handler registered by `useWizardStep`: awaited before forward navigation. */
export type WizardStepHandler<TContext extends JourneyJsonObject = JourneyJsonObject> = (args: {
  context: TContext;
  updateContext: (updater: (context: TContext) => TContext) => Promise<unknown>;
}) => void | Promise<void>;

export type WizardProps<TContext extends JourneyJsonObject = JourneyEmpty> = {
  /** Children form: each child element is a step. Mutually exclusive with `steps`. */
  children?: React.ReactNode;
  /** Object form: keys are step ids, insertion order is step order. */
  steps?: WizardStepsProp<TContext>;

  /** Initial shared state. Lives in the core machine, not in React. */
  context?: TContext;
  /** Zero-based index of the starting step. Default 0. */
  startIndex?: number;
  /** Starting step id; wins over `startIndex` (dev-mode error if both are set). */
  startStepId?: string;

  /** Rendered above/below the active step, INSIDE the wizard context — both may call useWizard(). */
  header?: React.ReactNode;
  footer?: React.ReactNode;
  /** The active step is cloned into this element (e.g. an animation wrapper). */
  wrapper?: React.ReactElement<{ children?: React.ReactNode }>;
  /** Shown when no step can render yet (e.g. awaiting persisted rehydration). */
  fallback?: React.ReactNode;

  onStepChange?: (change: WizardStepChange<TContext>) => void;
  /** Global lifecycle callbacks; fire for every step, alongside per-step onEnter/onLeave. */
  onStepEnter?: (args: { stepId: string; context: TContext }) => void;
  onStepLeave?: (args: { stepId: string; context: TContext }) => void;
  onComplete?: (args: {
    context: TContext;
    snapshot: LinearJourneySnapshot<TContext, string>;
  }) => void;
  onError?: (error: unknown, info: { phase: "start" | "navigate" | "step-handler" }) => void;

  /** Sugar over the core persistence plugin. */
  persist?: WizardPersistProp;
  plugins?: readonly JourneyMachinePlugin[];
  handlers?: Record<string, unknown>;
  requireExplicitCompletion?: boolean;
  /** Imperative escape hatch to the underlying core machine. */
  machineRef?: React.Ref<LinearJourneyMachine<TContext, string>>;
};

/** Props of the `<Wizard.Step>` config-only marker element. */
export type WizardStepProps<TContext extends JourneyJsonObject = JourneyJsonObject> = {
  id: string;
  meta?: JourneyJsonValue;
  onEnter?: WizardStepConfig<TContext>["onEnter"];
  onLeave?: WizardStepConfig<TContext>["onLeave"];
  effect?: WizardStepConfig<TContext>["effect"];
  after?: WizardStepConfig<TContext>["after"];
  children: React.ReactNode;
};

/** Everything `useWizard()` returns. */
export type UseWizardResult<
  TContext extends JourneyJsonObject = JourneyJsonObject,
  TStepId extends string = string
> = {
  // position
  activeStepId: TStepId;
  activeStepIndex: number;
  stepCount: number;
  stepIds: readonly TStepId[];
  isFirstStep: boolean;
  isLastStep: boolean;

  // visit tracking
  visited: Record<TStepId, boolean>;
  /** True while the active step is on its first visit. */
  isFirstTimeVisit: boolean;

  // status
  status: JourneyStatus;
  /** True while a `useWizardStep` handler or the active step's async work is pending. */
  isLoading: boolean;
  isPaused: boolean;
  /** A rejected `useWizardStep` handler or the active step's async error, else null. */
  error: unknown;

  // navigation — existing machine names, verbatim
  goToNextStep: () => Promise<JourneySendResult<TContext, TStepId>>;
  goToPreviousStep: (steps?: number) => Promise<JourneySendResult<TContext, TStepId>>;
  goToStepById: (stepId: TStepId) => Promise<JourneySendResult<TContext, TStepId>>;
  goToStepByIndex: (index: number) => Promise<JourneySendResult<TContext, TStepId>>;
  goToLastVisitedStep: () => Promise<JourneySendResult<TContext, TStepId>>;
  completeJourney: () => Promise<JourneySendResult<TContext, TStepId>>;
  resetJourney: () => Promise<unknown>;
  pauseJourney: () => void;
  resumeJourney: () => void;
  clearStepError: (stepId?: TStepId) => Promise<unknown>;

  // shared state
  context: TContext;
  updateContext: (updater: (context: TContext) => TContext) => Promise<unknown>;

  // metadata
  activeStepMeta: JourneyJsonValue | undefined;
  getStepMeta: (stepId: TStepId) => JourneyJsonValue | undefined;

  // escape hatches
  snapshot: LinearJourneySnapshot<TContext, TStepId>;
  machine: LinearJourneyMachine<TContext, TStepId>;
};

/** Selector hook bound to the enclosing `<Wizard>`. */
export type UseWizardSelector<
  TContext extends JourneyJsonObject = JourneyJsonObject,
  TStepId extends string = string
> = <TSelected>(
  selector: (snapshot: LinearJourneySnapshot<TContext, TStepId>) => TSelected,
  equalityFn?: JourneyEqualityFn<TSelected>
) => TSelected;
