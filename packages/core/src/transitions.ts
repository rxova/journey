import { JOURNEY_WILDCARD } from "./types/journey.types";
import type { JourneyEventPayloadMap } from "./types/journey.types";
import type {
  EventBuilder,
  JourneyEventTransition,
  JourneyTransition,
  JourneyTransitionArgs,
  JourneyTransitionTarget,
  TransitionBranch,
  TransitionConfig
} from "./types/transitions.types";

const createEventBuilder = <
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>
>(
  from: TStepId | typeof JOURNEY_WILDCARD,
  event: TEventType
): EventBuilder<TContext, TStepId, TEventType, TPayloadMap> => {
  if (event === "completeJourney") {
    return {
      complete: (
        config: TransitionConfig<TContext, TStepId, TEventType, TPayloadMap> = {}
      ): JourneyTransition<TContext, TStepId, TEventType, TPayloadMap> =>
        ({
          ...config,
          from,
          event: event as Extract<TEventType, "completeJourney">
        }) as JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>
    } as EventBuilder<TContext, TStepId, TEventType, TPayloadMap>;
  }

  if (event === "terminateJourney") {
    return {
      terminate: (
        config: TransitionConfig<TContext, TStepId, TEventType, TPayloadMap> = {}
      ): JourneyTransition<TContext, TStepId, TEventType, TPayloadMap> =>
        ({
          ...config,
          from,
          event: event as Extract<TEventType, "terminateJourney">
        }) as JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>
    } as EventBuilder<TContext, TStepId, TEventType, TPayloadMap>;
  }

  return {
    to: (
      to: JourneyTransitionTarget<TStepId>,
      config: TransitionConfig<TContext, TStepId, TEventType, TPayloadMap> = {}
    ): JourneyTransition<TContext, TStepId, TEventType, TPayloadMap> =>
      ({
        ...config,
        from,
        event: event as Exclude<TEventType, "completeJourney" | "terminateJourney">,
        to
      }) as JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>,
    choose: (
      ...branches: Array<TransitionBranch<TContext, TStepId, TEventType, TPayloadMap>>
    ): JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>[] =>
      branches.map(
        (branch) =>
          ({
            ...branch,
            from,
            event: event as Exclude<TEventType, "completeJourney" | "terminateJourney">
          }) as JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>
      )
  } as EventBuilder<TContext, TStepId, TEventType, TPayloadMap>;
};

const buildTerminalTransition = <
  TContext,
  TStepId extends string,
  TEventType extends "completeJourney" | "terminateJourney"
>(
  from: TStepId | typeof JOURNEY_WILDCARD,
  event: TEventType,
  config: TransitionConfig<TContext, TStepId, TEventType, Record<never, never>> = {}
): JourneyEventTransition<TContext, TStepId, TEventType, Record<never, never>> =>
  ({
    ...config,
    from,
    event
  }) as JourneyEventTransition<TContext, TStepId, TEventType, Record<never, never>>;

/**
 * Fluent helpers for building journey transitions with type-safe branches.
 */
export const tx = {
  from: <TStepId extends string, TContext = unknown>(from: TStepId) => ({
    on: <TEventType extends string>(event: TEventType) =>
      createEventBuilder<TContext, TStepId, TEventType, Record<never, never>>(from, event),
    toComplete: (
      config: TransitionConfig<TContext, TStepId, "completeJourney", Record<never, never>> = {}
    ) => buildTerminalTransition(from, "completeJourney", config),
    toTerminate: (
      config: TransitionConfig<TContext, TStepId, "terminateJourney", Record<never, never>> = {}
    ) => buildTerminalTransition(from, "terminateJourney", config)
  }),
  any: <TContext = unknown, TStepId extends string = string>() => ({
    on: <TEventType extends string>(event: TEventType) =>
      createEventBuilder<TContext, TStepId, TEventType, Record<never, never>>(
        JOURNEY_WILDCARD,
        event
      ),
    toComplete: (
      config: TransitionConfig<TContext, TStepId, "completeJourney", Record<never, never>> = {}
    ) => buildTerminalTransition(JOURNEY_WILDCARD, "completeJourney", config),
    toTerminate: (
      config: TransitionConfig<TContext, TStepId, "terminateJourney", Record<never, never>> = {}
    ) => buildTerminalTransition(JOURNEY_WILDCARD, "terminateJourney", config)
  }),
  when: <
    TContext,
    TStepId extends string,
    TEventType extends string,
    TPayloadMap extends JourneyEventPayloadMap<TEventType>
  >(
    predicate: (
      args: JourneyTransitionArgs<TContext, TStepId, TEventType, TPayloadMap>
    ) => boolean | Promise<boolean>
  ) => ({
    to: (
      to: JourneyTransitionTarget<TStepId>,
      config: TransitionConfig<TContext, TStepId, TEventType, TPayloadMap> = {}
    ): TransitionBranch<TContext, TStepId, TEventType, TPayloadMap> => ({
      ...config,
      to,
      when: predicate
    })
  }),
  otherwise: <
    TContext,
    TStepId extends string,
    TEventType extends string,
    TPayloadMap extends JourneyEventPayloadMap<TEventType>
  >() => ({
    to: (
      to: JourneyTransitionTarget<TStepId>,
      config: TransitionConfig<TContext, TStepId, TEventType, TPayloadMap> = {}
    ): TransitionBranch<TContext, TStepId, TEventType, TPayloadMap> => ({
      ...config,
      to
    })
  })
};

/**
 * Flattens transition items and transition arrays into a single transition list.
 */
export const createTransitions = <
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>
>(
  ...items: Array<
    | JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>
    | readonly JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>[]
  >
): JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>[] =>
  items.flatMap((item) => (Array.isArray(item) ? [...item] : [item]));
