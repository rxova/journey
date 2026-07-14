import type {
  JourneyCompleteObservationEvent,
  JourneyJsonObject,
  JourneyMachine,
  JourneyMachinePlugin,
  JourneyResetObservationEvent,
  JourneyStartObservationEvent,
  JourneyTerminateObservationEvent
} from "../../types";

/** The lifecycle-filtered subscription helpers added by the subscription-enhancer plugin. */
export type JourneySubscriptionEnhancerMachineExtension<TStepId extends string> = {
  subscribeStart: (listener: (event: JourneyStartObservationEvent<TStepId>) => void) => () => void;
  subscribeReset: (listener: (event: JourneyResetObservationEvent<TStepId>) => void) => () => void;
  subscribeComplete: (
    listener: (event: JourneyCompleteObservationEvent<TStepId>) => void
  ) => () => void;
  subscribeTerminate: (
    listener: (event: JourneyTerminateObservationEvent<TStepId>) => void
  ) => () => void;
};

/**
 * Adds lifecycle-filtered subscription conveniences — `subscribeStart`,
 * `subscribeReset`, `subscribeComplete`, `subscribeTerminate` — each a
 * filtered view over the machine's observation-event stream. Sugar over
 * `subscribeEvent`, kept out of the base machine surface by design; every
 * helper returns its unsubscribe function.
 */
export const createSubscriptionEnhancerPlugin = <TStepId extends string = string>() => {
  return {
    name: "subscription-enhancer",
    __extension__: undefined as unknown as JourneySubscriptionEnhancerMachineExtension<TStepId>,
    setup: () => ({
      augmentMachine: ({ machine }) => {
        const typedMachine = machine as JourneyMachine<
          JourneyJsonObject,
          TStepId,
          never,
          unknown,
          Record<string, unknown>
        >;

        return {
          subscribeStart: (listener) =>
            typedMachine.subscribeEvent((event) => {
              if (event.type === "journey.start") {
                listener(event);
              }
            }),
          subscribeReset: (listener) =>
            typedMachine.subscribeEvent((event) => {
              if (event.type === "journey.reset") {
                listener(event);
              }
            }),
          subscribeComplete: (listener) =>
            typedMachine.subscribeEvent((event) => {
              if (event.type === "journey.completed") {
                listener(event);
              }
            }),
          subscribeTerminate: (listener) =>
            typedMachine.subscribeEvent((event) => {
              if (event.type === "journey.terminated") {
                listener(event);
              }
            })
        } satisfies JourneySubscriptionEnhancerMachineExtension<TStepId>;
      }
    })
  } satisfies JourneyMachinePlugin;
};
