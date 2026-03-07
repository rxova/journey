import { JOURNEY_WILDCARD } from "./types/journey.types";
import type { JourneyEventPayloadMap } from "./types/journey.types";
import type {
  EventBuilder,
  JourneyEventTransition,
  JourneyTransition,
  JourneySelectedTransitionArgs,
  JourneyTransitionTarget,
  TransitionBranch,
  TransitionBranchBuilder,
  TransitionConfig
} from "./types/transitions.types";

type TransitionPayloadMap = Partial<Record<string, unknown>>;
type SelectedPayloadMap<
  TEventType extends string,
  TPayloadMap extends TransitionPayloadMap
> = TPayloadMap & JourneyEventPayloadMap<TEventType>;

const createBranchBuilder = <
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>
>(
  predicate?: (
    args: JourneySelectedTransitionArgs<TContext, TStepId, TEventType, TPayloadMap>
  ) => boolean | Promise<boolean>
): TransitionBranchBuilder<TContext, TStepId, TEventType, TPayloadMap> => ({
  to: (
    to: JourneyTransitionTarget<TStepId>,
    config: TransitionConfig<TContext, TStepId, TEventType, TPayloadMap> = {}
  ): TransitionBranch<TContext, TStepId, TEventType, TPayloadMap> => ({
    ...config,
    to,
    ...(predicate ? { when: predicate } : {})
  })
});

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
      ),
    when: (
      predicate: (
        args: JourneySelectedTransitionArgs<TContext, TStepId, TEventType, TPayloadMap>
      ) => boolean | Promise<boolean>
    ) => createBranchBuilder(predicate),
    otherwise: () => createBranchBuilder()
  } as unknown as EventBuilder<TContext, TStepId, TEventType, TPayloadMap>;
};

const buildTerminalTransition = <
  TContext,
  TStepId extends string,
  TEventType extends "completeJourney" | "terminateJourney",
  TPayloadMap extends TransitionPayloadMap = Record<never, never>
>(
  from: TStepId | typeof JOURNEY_WILDCARD,
  event: TEventType,
  config: TransitionConfig<
    TContext,
    TStepId,
    TEventType,
    SelectedPayloadMap<TEventType, TPayloadMap>
  > = {}
): JourneyEventTransition<
  TContext,
  TStepId,
  TEventType,
  SelectedPayloadMap<TEventType, TPayloadMap>
> =>
  ({
    ...config,
    from,
    event
  }) as JourneyEventTransition<
    TContext,
    TStepId,
    TEventType,
    SelectedPayloadMap<TEventType, TPayloadMap>
  >;

/**
 * Fluent helpers for building journey transitions with type-safe branches.
 */
export const tx = {
  from: <
    TStepId extends string,
    TContext = unknown,
    TPayloadMap extends TransitionPayloadMap = Record<never, never>
  >(
    from: TStepId
  ) => ({
    on: <TEventType extends string>(event: TEventType) =>
      createEventBuilder<
        TContext,
        TStepId,
        TEventType,
        SelectedPayloadMap<TEventType, TPayloadMap>
      >(from, event),
    toComplete: (
      config: TransitionConfig<
        TContext,
        TStepId,
        "completeJourney",
        SelectedPayloadMap<"completeJourney", TPayloadMap>
      > = {}
    ) =>
      buildTerminalTransition<TContext, TStepId, "completeJourney", TPayloadMap>(
        from,
        "completeJourney",
        config
      ),
    toTerminate: (
      config: TransitionConfig<
        TContext,
        TStepId,
        "terminateJourney",
        SelectedPayloadMap<"terminateJourney", TPayloadMap>
      > = {}
    ) =>
      buildTerminalTransition<TContext, TStepId, "terminateJourney", TPayloadMap>(
        from,
        "terminateJourney",
        config
      )
  }),
  any: <
    TContext = unknown,
    TStepId extends string = string,
    TPayloadMap extends TransitionPayloadMap = Record<never, never>
  >() => ({
    on: <TEventType extends string>(event: TEventType) =>
      createEventBuilder<
        TContext,
        TStepId,
        TEventType,
        SelectedPayloadMap<TEventType, TPayloadMap>
      >(JOURNEY_WILDCARD, event),
    toComplete: (
      config: TransitionConfig<
        TContext,
        TStepId,
        "completeJourney",
        SelectedPayloadMap<"completeJourney", TPayloadMap>
      > = {}
    ) =>
      buildTerminalTransition<TContext, TStepId, "completeJourney", TPayloadMap>(
        JOURNEY_WILDCARD,
        "completeJourney",
        config
      ),
    toTerminate: (
      config: TransitionConfig<
        TContext,
        TStepId,
        "terminateJourney",
        SelectedPayloadMap<"terminateJourney", TPayloadMap>
      > = {}
    ) =>
      buildTerminalTransition<TContext, TStepId, "terminateJourney", TPayloadMap>(
        JOURNEY_WILDCARD,
        "terminateJourney",
        config
      )
  }),
  when: <
    TContext,
    TStepId extends string,
    TEventType extends string,
    TPayloadMap extends JourneyEventPayloadMap<TEventType>
  >(
    predicate: (
      args: JourneySelectedTransitionArgs<TContext, TStepId, TEventType, TPayloadMap>
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
