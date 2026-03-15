import { createMachineAsyncStateController } from "./machine/async-state";
import { createMachineControls } from "./machine/controls";
import { createMachineNavigationController } from "./machine/navigation";
import { createMachineRuntime } from "./machine/runtime";
import { createMachineSendController } from "./machine/send";
import {
  assertStepExists,
  buildInitialAsyncState,
  buildSendResult,
  now,
  validateJourneyTransitions
} from "./machine-helpers";
import { createPersistenceController } from "./persistence";
import { createTypedTransitionHelpers } from "./transitions";

import type {
  JourneyDefaultEventType,
  JourneyDefinition,
  JourneyEventPayloadMap,
  JourneyMachine,
  JourneyMachineOptions,
  JourneyObservationEvent,
  JourneyResolvedDefinition,
  JourneyStepDefinition
} from "./types";

const resolveJourneyTransitions = <
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>,
  TStepMeta = unknown,
  TStepExtra extends object = Record<never, never>
>(
  journey: JourneyDefinition<TContext, TStepId, TEventType, TPayloadMap, TStepMeta, TStepExtra>
): JourneyResolvedDefinition<
  TContext,
  TStepId,
  TEventType,
  TPayloadMap,
  TStepMeta,
  TStepExtra
> => ({
  ...journey,
  transitions:
    typeof journey.transitions === "function"
      ? journey.transitions(
          createTypedTransitionHelpers<TContext, TStepId, TEventType, TPayloadMap>()
        )
      : journey.transitions
});

/**
 * Creates a journey machine from a journey definition.
 * Validates steps/transitions, hydrates persisted state (if configured),
 * and returns an API for sending events and reading snapshots.
 */
export function createJourneyMachine<
  TContext,
  TStepMeta = unknown,
  TSteps extends Record<string, JourneyStepDefinition<TStepMeta>> = Record<
    string,
    JourneyStepDefinition<TStepMeta>
  >,
  TPayloadMap extends JourneyEventPayloadMap<JourneyDefaultEventType> = Record<never, never>
>(
  journey: JourneyDefinition<
    TContext,
    Extract<keyof TSteps, string>,
    JourneyDefaultEventType,
    TPayloadMap,
    TStepMeta
  > & {
    steps: TSteps;
  },
  options?: JourneyMachineOptions<TContext, Extract<keyof TSteps, string>, TStepMeta>
): JourneyMachine<
  TContext,
  Extract<keyof TSteps, string>,
  JourneyDefaultEventType,
  TPayloadMap,
  TStepMeta
>;
// eslint-disable-next-line no-redeclare
export function createJourneyMachine<
  TContext,
  TStepId extends string,
  TEventType extends string = JourneyDefaultEventType,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>,
  TStepMeta = unknown
>(
  journey: JourneyDefinition<TContext, TStepId, TEventType, TPayloadMap, TStepMeta>,
  options?: JourneyMachineOptions<TContext, TStepId, TStepMeta>
): JourneyMachine<TContext, TStepId, TEventType, TPayloadMap, TStepMeta>;
// eslint-disable-next-line no-redeclare
export function createJourneyMachine<
  TContext,
  TStepId extends string,
  TEventType extends string = JourneyDefaultEventType,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>,
  TStepMeta = unknown
>(
  journey: JourneyDefinition<TContext, TStepId, TEventType, TPayloadMap, TStepMeta>,
  options?: JourneyMachineOptions<TContext, TStepId, TStepMeta>
): JourneyMachine<TContext, TStepId, TEventType, TPayloadMap, TStepMeta> {
  if (!journey.steps || typeof journey.steps !== "object") {
    throw new Error("Journey steps must be a record object.");
  }

  if (typeof journey.transitions !== "function" && !Array.isArray(journey.transitions)) {
    throw new Error("Journey transitions must be an array or a factory function.");
  }

  for (const stepId of Object.keys(journey.steps)) {
    if (stepId === "*") {
      throw new Error('Step id "*" is reserved as a wildcard and cannot be used as a step name.');
    }
  }

  assertStepExists(
    journey.steps,
    journey.initial,
    `Journey initial step "${journey.initial}" does not exist in steps registry.`
  );

  const resolvedJourney = resolveJourneyTransitions(journey);
  validateJourneyTransitions(resolvedJourney.transitions, resolvedJourney.steps);

  const buildStepMeta = (): Record<TStepId, TStepMeta> => {
    const stepMeta = {} as Record<TStepId, TStepMeta>;
    for (const stepId of Object.keys(resolvedJourney.steps) as TStepId[]) {
      stepMeta[stepId] = resolvedJourney.steps[stepId].meta as TStepMeta;
    }
    return stepMeta;
  };

  const { clearOnReset, hydrateSnapshot, persistSnapshot, removePersistedSnapshot } =
    createPersistenceController({
      initial: resolvedJourney.initial,
      context: resolvedJourney.context,
      stepMeta: buildStepMeta(),
      steps: resolvedJourney.steps,
      ...(options ? { options } : {})
    });

  const initialSnapshot = {
    ...hydrateSnapshot(),
    async: buildInitialAsyncState(resolvedJourney.steps)
  };
  const startupEvent: JourneyObservationEvent<TStepId, TEventType, TPayloadMap, TStepMeta> = {
    type: "journey.start",
    stepId: initialSnapshot.currentStepId,
    timestamp: now()
  };
  const completeOnNoNextStep = options?.completeOnNoNextStep ?? true;

  const runtime = createMachineRuntime<TContext, TStepId, TEventType, TPayloadMap, TStepMeta>({
    snapshot: initialSnapshot,
    startupEvent,
    persistSnapshot,
    removePersistedSnapshot
  });
  const asyncState = createMachineAsyncStateController<
    TContext,
    TStepId,
    TEventType,
    TPayloadMap,
    TStepMeta
  >({ runtime });
  const navigation = createMachineNavigationController<
    TContext,
    TStepId,
    TEventType,
    TPayloadMap,
    TStepMeta
  >({
    runtime,
    asyncState,
    steps: resolvedJourney.steps,
    transitions: resolvedJourney.transitions
  });
  const sendController = createMachineSendController<
    TContext,
    TStepId,
    TEventType,
    TPayloadMap,
    TStepMeta
  >({
    runtime,
    asyncState,
    navigation,
    steps: resolvedJourney.steps,
    transitions: resolvedJourney.transitions,
    completeOnNoNextStep
  });
  const controls = createMachineControls<TContext, TStepId, TEventType, TPayloadMap, TStepMeta>({
    runtime,
    asyncState,
    initial: resolvedJourney.initial,
    initialContext: journey.context,
    steps: resolvedJourney.steps,
    buildStepMeta,
    clearOnReset
  });

  const machine: JourneyMachine<TContext, TStepId, TEventType, TPayloadMap, TStepMeta> = {
    getSnapshot: runtime.getSnapshot,
    subscribe: runtime.subscribe,
    subscribeSelector: runtime.subscribeSelector,
    subscribeEvent: runtime.subscribeEvent,
    subscribeStart: (listener) =>
      runtime.subscribeEvent((event) => {
        if (event.type === "journey.start") {
          listener(event);
        }
      }),
    subscribeComplete: (listener) =>
      runtime.subscribeEvent((event) => {
        if (event.type === "journey.complete") {
          listener(event);
        }
      }),
    subscribeTerminate: (listener) =>
      runtime.subscribeEvent((event) => {
        if (event.type === "journey.close") {
          listener(event);
        }
      }),
    resetMachine: controls.resetMachine,
    updateContext: controls.updateContext,
    updateStepMetadata: controls.updateStepMetadata,
    clearStepError: controls.clearStepError,
    dispose: controls.dispose,
    goToPreviousStep: (steps) =>
      runtime.queue(
        async () => navigation.applyPreviousNavigation(steps, "goToPreviousStep"),
        () => buildSendResult(runtime.getSnapshot(), false)
      ),
    goToLastVisitedStep: () =>
      runtime.queue(
        async () => navigation.applyLastVisitedNavigation("goToLastVisitedStep"),
        () => buildSendResult(runtime.getSnapshot(), false)
      ),
    goToNextStep: () => machine.send({ type: "goToNextStep" }),
    terminateJourney: (payload) =>
      payload === undefined
        ? machine.send({ type: "terminateJourney" })
        : machine.send({ type: "terminateJourney", payload }),
    completeJourney: (payload) =>
      payload === undefined
        ? machine.send({ type: "completeJourney" })
        : machine.send({ type: "completeJourney", payload }),
    send: (event) =>
      runtime.queue(
        (runVersion) => sendController.executeSend(event, runVersion),
        sendController.buildCanceledSendResult
      )
  };

  return machine;
}
