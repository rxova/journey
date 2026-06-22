import {
  createGraphJourney,
  createHeadlessJourney,
  createLinearJourney
} from "@rxova/journey-core";
import type {
  JourneyBaseEvent,
  JourneyDefinition,
  JourneyJsonObject,
  JourneyMachineOptions,
  JourneyMachinePlugin,
  JourneyMachineWithPlugins
} from "@rxova/journey-core";
import { createJourneyProviderArtifacts } from "./Provider";
import { createJourneyHooks } from "./Hooks";
import type { JourneyRuntime } from "./types";
import type { JourneyOptionsInput } from "./type-helpers";
import type { JourneyEmpty } from "@rxova/journey-core";

export const buildJourneyRuntime = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  machine: JourneyMachineWithPlugins<TContext, TStepId, TEvents, TStepMeta, THandlers, TPlugins>
): JourneyRuntime<TContext, TStepId, TEvents, TStepMeta, TPlugins, THandlers> => {
  const hooks = createJourneyHooks<TContext, TStepId, TEvents, TStepMeta, THandlers, TPlugins>(
    machine
  );
  const providerArtifacts = createJourneyProviderArtifacts<
    TContext,
    TStepId,
    TEvents,
    TStepMeta,
    THandlers,
    TPlugins
  >(machine, hooks.useJourneySelector);

  return {
    machine,
    dispose: () => machine.dispose(),
    ...hooks,
    ...providerArtifacts
  };
};

export const createJourneyMachineRuntime = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  definition: JourneyDefinition<TContext, TStepId, TEvents, TStepMeta, THandlers>,
  options?: JourneyOptionsInput<TPlugins, THandlers>
): JourneyRuntime<TContext, TStepId, TEvents, TStepMeta, TPlugins, THandlers> => {
  const machineOptions = options as JourneyMachineOptions<TPlugins, THandlers> | undefined;
  const machine = createMachineForDefinition<
    TContext,
    TStepId,
    TEvents,
    TStepMeta,
    THandlers,
    TPlugins
  >(definition, machineOptions);
  return buildJourneyRuntime(machine);
};

/**
 * Routes a definition to the matching named core factory by its `transitions`
 * shape — headless (none), linear (ordered array), or graph (event-keyed map) —
 * so React never depends on the deprecated `createJourneyMachine`.
 */
const createMachineForDefinition = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  definition: JourneyDefinition<TContext, TStepId, TEvents, TStepMeta, THandlers>,
  options: JourneyMachineOptions<TPlugins, THandlers> | undefined
): JourneyMachineWithPlugins<TContext, TStepId, TEvents, TStepMeta, THandlers, TPlugins> => {
  type Machine = JourneyMachineWithPlugins<
    TContext,
    TStepId,
    TEvents,
    TStepMeta,
    THandlers,
    TPlugins
  >;
  const { transitions } = definition;

  if (transitions === undefined) {
    // No transition graph — caller-driven navigation.
    return createHeadlessJourney(definition as never, options) as Machine;
  }

  if (Array.isArray(transitions)) {
    // Ordered array of step ids — rebuild the linear factory's steps array from
    // the transition order, pulling each step's config from the steps record.
    const steps = transitions.map((stepId) => ({
      id: stepId as TStepId,
      ...definition.steps[stepId as TStepId]
    }));
    return createLinearJourney(
      {
        context: definition.context,
        ...(definition.handlers !== undefined ? { handlers: definition.handlers } : {}),
        steps
      } as never,
      options
    ) as Machine;
  }

  // Event-keyed transition map — graph mode.
  return createGraphJourney(definition, options) as Machine;
};
