import type React from "react";

/**
 * Make `id` a valid attribute on ANY component element — the same mechanism
 * React uses for `key` (which lives on `React.Attributes`, the base of
 * `JSX.IntrinsicAttributes`). This lets a step declare its linear journey id inline
 * (`<Login id="login" />`) without the component having to add an `id` prop
 * to its own props type. `<LinearJourney>` reads the id off the element and strips
 * it before rendering, so it never reaches the component.
 *
 * Scope note: like Emotion's `css` prop, this augmentation is global for any
 * project that imports `@rxova/journey-react`.
 */
declare module "react" {
  interface Attributes {
    /** Step id when this element is a direct child of `<LinearJourney>`. */
    id?: string;
  }
}

import type {
  AnyJourneyPlugin,
  JourneyControls,
  JourneyStatus,
  LinearJourneyMachine as CoreLinearJourneyMachine,
  LinearSnapshot,
  NavigationResult,
  OnEnterHook,
  OnLeaveHook
} from "@rxova/journey-core";
import type { JourneyStorage } from "@rxova/journey-core/persistence";

/** A linear journey's underlying core machine (context typed, step ids widened). */
export type LinearJourneyMachine<TContext = unknown> = CoreLinearJourneyMachine<TContext, string>;

/** A linear journey's core snapshot. */
export type LinearJourneySnapshot<
  TContext = unknown,
  TStepId extends string = string
> = LinearSnapshot<TContext, TStepId, unknown>;

/** Full per-step configuration accepted by the steps-object form and `<LinearJourney.Step>`. */
export type LinearJourneyStepConfig<TContext = unknown> = {
  component: React.ComponentType;
  meta?: unknown;
  onEnter?: OnEnterHook<TContext, string, never, LinearJourneySnapshot<TContext>>;
  onLeave?: OnLeaveHook<TContext, string, never, LinearJourneySnapshot<TContext>>;
};

/**
 * The steps-object form: keys are step ids, insertion order is step order,
 * values are bare components or full config objects.
 */
export type LinearJourneyStepsProp<TContext = unknown> = Record<
  string,
  React.ComponentType | LinearJourneyStepConfig<TContext>
>;

/** Payload passed to the LinearJourney-level `onStepChange` callback. */
export type LinearJourneyStepChange<TContext = unknown> = {
  fromStepId: string | null;
  toStepId: string;
  fromIndex: number | null;
  toIndex: number;
  direction: "forward" | "backward" | "jump";
  context: TContext;
};

/** Sugar over the core persistence plugin; storage defaults to localStorage. */
export type LinearJourneyPersistProp = {
  key: string;
  storage?: JourneyStorage;
};

/** Handler registered by `useLinearJourneyStep`: awaited before forward navigation. */
export type LinearJourneyStepHandler<TContext = unknown> = (args: {
  context: TContext;
  updateContext: (updater: (context: TContext) => TContext) => void;
}) => void | Promise<void>;

export type LinearJourneyProps<TContext = unknown> = {
  /** Children form: each child element is a step. Mutually exclusive with `steps`. */
  children?: React.ReactNode;
  /** Object form: keys are step ids, insertion order is step order. */
  steps?: LinearJourneyStepsProp<TContext>;

  /** Initial shared state. Lives in the core machine, not in React. */
  context?: TContext;
  /** Zero-based index of the starting step. Default 0. */
  startIndex?: number;
  /** Starting step id; wins over `startIndex` (dev-mode error if both are set). */
  startStepId?: string;

  /** Rendered above/below the active step, INSIDE the linear journey context — both may call useLinearJourney(). */
  header?: React.ReactNode;
  footer?: React.ReactNode;
  /** The active step is cloned into this element (e.g. an animation wrapper). */
  wrapper?: React.ReactElement<{ children?: React.ReactNode }>;
  /** Shown when no step can render (before start or after terminate). */
  fallback?: React.ReactNode;

  onStepChange?: (change: LinearJourneyStepChange<TContext>) => void;
  /** Global lifecycle callbacks; fire for every step, alongside per-step onEnter/onLeave. */
  onStepEnter?: (args: { stepId: string; context: TContext }) => void;
  onStepLeave?: (args: { stepId: string; context: TContext }) => void;
  onComplete?: (args: { context: TContext; snapshot: LinearJourneySnapshot<TContext> }) => void;
  onError?: (error: unknown, info: { phase: "start" | "navigate" | "step-handler" }) => void;

  /** Sugar over the core persistence plugin. */
  persist?: LinearJourneyPersistProp;
  plugins?: readonly AnyJourneyPlugin[];
  /** Imperative escape hatch to the underlying core machine. */
  machineRef?: React.Ref<LinearJourneyMachine<TContext>>;
};

/** Props of the `<LinearJourney.Step>` config-only marker element. */
export type LinearJourneyStepProps<TContext = unknown> = {
  id: string;
  meta?: unknown;
  onEnter?: LinearJourneyStepConfig<TContext>["onEnter"];
  onLeave?: LinearJourneyStepConfig<TContext>["onLeave"];
  children: React.ReactNode;
};

/** Everything `useLinearJourney()` returns. */
export type UseLinearJourneyResult<TContext = unknown, TStepId extends string = string> = {
  // position
  activeStepId: TStepId;
  activeStepIndex: number;
  stepCount: number;
  stepIds: readonly TStepId[];
  isFirstStep: boolean;
  isLastStep: boolean;

  // visit tracking
  visited: Readonly<Record<TStepId, boolean>>;
  /** True while the active step is on its first visit. */
  isStepFirstTimeVisit: boolean;

  // status
  status: JourneyStatus;
  /** True while a `useLinearJourneyStep` handler or a navigation hook chain is pending. */
  isLoading: boolean;
  isPaused: boolean;
  /** A rejected `useLinearJourneyStep` handler or the active step's async error, else null. */
  error: unknown;
  /** Clears a rejected `useLinearJourneyStep` handler error. */
  clearError: () => void;

  // navigation — the machine's own verbs; goToNextStep awaits step handlers first
  goToNextStep: () => Promise<NavigationResult<TStepId>>;
  goToPreviousStep: (steps?: number) => Promise<NavigationResult<TStepId>>;
  goToStepById: (stepId: TStepId) => Promise<NavigationResult<TStepId>>;
  goToStepByIndex: (index: number) => Promise<NavigationResult<TStepId>>;
  goToLastVisitedStep: () => Promise<NavigationResult<TStepId>>;
  /** The machine's lifecycle command group, passed through verbatim. */
  controls: JourneyControls;

  // shared state
  context: TContext;
  updateContext: (updater: (context: TContext) => TContext) => void;

  // metadata
  activeStepMeta: unknown;
  getStepMeta: (stepId: TStepId) => unknown;

  // escape hatches
  snapshot: LinearJourneySnapshot<TContext, TStepId>;
  machine: LinearJourneyMachine<TContext>;
};
