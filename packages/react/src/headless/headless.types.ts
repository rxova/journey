import type {
  JourneyEventPayloads,
  JourneySnapshot,
  JourneySubscriptionEvent
} from "@rxova/journey-core";

/** Any subscription event payload, with the widest snapshot/step typing. */
type AnyEventPayload = JourneyEventPayloads<unknown, string>[JourneySubscriptionEvent];

/**
 * The structural machine surface the headless hooks require. Every core
 * `create*Journey` result satisfies it; the hooks infer their concrete
 * snapshot/step types from the machine you pass, so a store-held, prop-passed,
 * or `useOwnedJourney`-owned machine all type identically.
 *
 * Method syntax (not arrow-property syntax) is deliberate: method signatures
 * compare parameters bivariantly, so concretely-typed machines satisfy this
 * structural surface without variance gymnastics.
 */
export type AnyJourneyMachine = {
  getSnapshot(): JourneySnapshot;
  subscriptions: {
    subscribeSelector(
      selector: (snapshot: JourneySnapshot) => unknown,
      listener: (selected: unknown) => void,
      equals?: (a: unknown, b: unknown) => boolean
    ): () => void;
    subscribeEvent(
      event: JourneySubscriptionEvent,
      listener: (payload: AnyEventPayload) => void
    ): () => void;
  };
  dispose(): void;
};

/** The exact snapshot type a machine emits. */
export type SnapshotOf<TMachine> = TMachine extends { getSnapshot(): infer TSnapshot }
  ? TSnapshot
  : never;

/** The step-id union of a machine, inferred from its snapshot's visited map. */
export type StepIdOf<TMachine> =
  SnapshotOf<TMachine> extends { history: { visited: Readonly<Record<infer TStepId, boolean>> } }
    ? Extract<TStepId, string>
    : never;

/** The context type of a machine, inferred from its snapshot. */
export type ContextOf<TMachine> =
  SnapshotOf<TMachine> extends { context: infer TContext } ? TContext : never;

/** The payload a machine delivers for one of its subscription events. */
export type EventPayloadOf<
  TMachine,
  TEvent extends JourneySubscriptionEvent
> = JourneyEventPayloads<ContextOf<TMachine>, StepIdOf<TMachine>, SnapshotOf<TMachine>>[TEvent];
