import { expectTypeOf } from "expect-type";

import { createJourneyMachine } from "@rxova/journey-core";
import type {
  JourneyEvent,
  JourneyMachine,
  JourneyMachineOptions,
  JourneyPayloadFor,
  JourneySnapshot,
  JourneyTransitionArgs,
  JourneyTransitionTarget
} from "@rxova/journey-core";

type Context = { count: number };
type StepId = "start" | "review" | "done";
type CustomEvent = "custom";
type EventType = "next" | CustomEvent;

const steps = {
  start: {},
  review: {},
  done: {}
} satisfies Record<string, unknown>;

const inferredJourney = {
  initial: "start" as const,
  context: { count: 0 },
  steps,
  transitions: [
    { from: "start", event: "next", to: "review" },
    { from: "review", event: "custom", to: "done" }
  ] as const
};

const inferredMachine = createJourneyMachine(inferredJourney);

type InferredSendArg = Parameters<typeof inferredMachine.send>[0];

expectTypeOf(inferredMachine).toEqualTypeOf<
  JourneyMachine<Context, StepId, EventType, Record<never, never>>
>();
expectTypeOf<InferredSendArg>().toEqualTypeOf<
  JourneyEvent<StepId, EventType, Record<never, never>>
>();
expectTypeOf(inferredMachine.getSnapshot()).toEqualTypeOf<JourneySnapshot<Context, StepId>>();

type PayloadMap = {
  next: { origin: "ui" };
  custom: { amount: number };
  goTo: { reason: string };
};

const typedJourney = {
  initial: "start",
  context: { count: 0 } satisfies Context,
  steps: {
    start: {},
    review: {},
    done: {}
  },
  transitions: [
    { from: "start", event: "next", to: "review" },
    { from: "review", event: "custom", to: "done" }
  ]
} satisfies {
  initial: StepId;
  context: Context;
  steps: Record<StepId, unknown>;
  transitions: readonly { from: StepId; event: EventType; to: StepId }[];
};

const typedMachine = createJourneyMachine<Context, StepId, EventType, PayloadMap>(typedJourney);

expectTypeOf(typedMachine.getSnapshot()).toEqualTypeOf<JourneySnapshot<Context, StepId>>();
expectTypeOf<JourneyPayloadFor<EventType, PayloadMap, "next">>().toEqualTypeOf<{
  origin: "ui";
}>();
expectTypeOf<JourneyPayloadFor<EventType, PayloadMap, "custom">>().toEqualTypeOf<{
  amount: number;
}>();
expectTypeOf<JourneyPayloadFor<EventType, PayloadMap, "goTo">>().toEqualTypeOf<{
  reason: string;
}>();

// Negative checks (public API should reject these).
const badPayloadEvent: JourneyEvent<StepId, EventType, PayloadMap> = {
  type: "custom",
  // @ts-expect-error payload must match mapped type
  payload: { amount: "nope" }
};
// @ts-expect-error goTo requires valid step id
const badStep: StepId = "missing";
// @ts-expect-error payload must match mapped type
const badPayload: JourneyPayloadFor<EventType, PayloadMap, "custom"> = { amount: "nope" };
const badTransitionArgs: JourneyTransitionArgs<Context, StepId, EventType, PayloadMap> = {
  context: { count: 1 },
  from: "start",
  history: ["start"],
  // @ts-expect-error when handler args must match journey types
  event: { type: "custom", payload: { amount: "nope" } }
};
void badPayloadEvent;
void badStep;
void badPayload;
void badTransitionArgs;

type TypedEvent = JourneyEvent<StepId, EventType, PayloadMap>;
type GoToEvent = Extract<TypedEvent, { type: "goTo" }>;
type CustomEventPayload = Extract<TypedEvent, { type: "custom" }>["payload"];

expectTypeOf<GoToEvent["payload"]>().toEqualTypeOf<PayloadMap["goTo"] | undefined>();
expectTypeOf<CustomEventPayload>().toEqualTypeOf<PayloadMap["custom"] | undefined>();
expectTypeOf<JourneyPayloadFor<EventType, Record<never, never>, "next">>().toEqualTypeOf<unknown>();

const transitionArgs: JourneyTransitionArgs<Context, StepId, EventType, PayloadMap> = {
  context: { count: 1 },
  from: "start",
  history: ["start"],
  event: { type: "custom", payload: { amount: 2 } }
};

expectTypeOf(transitionArgs.event).toEqualTypeOf<TypedEvent>();

const transitionTargetStep: JourneyTransitionTarget<StepId> = "review";
const transitionTargetTerminal: JourneyTransitionTarget<StepId> = "COMPLETE";
const transitionTargetHistory: JourneyTransitionTarget<StepId> = "__HISTORY__";
void transitionTargetStep;
void transitionTargetTerminal;
void transitionTargetHistory;

const machineOptions = {
  persistence: {
    key: "journey",
    version: 2,
    migrate: (value, persistedVersion) => ({
      current: "start",
      context: { count: Number(persistedVersion) },
      history: ["start"] as StepId[],
      status: "running",
      visited: ["start"] as StepId[]
    })
  }
} satisfies JourneyMachineOptions<Context, StepId>;
void machineOptions;
