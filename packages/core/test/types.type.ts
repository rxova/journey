import { expectTypeOf } from "expect-type";

import { createJourneyMachine, type JourneySnapshot } from "@rxova/journey-core";
import type {
  JourneyCreateTransitions,
  JourneyDefinition,
  JourneyEvent,
  JourneyMachine,
  JourneyMachineOptions,
  JourneyObservationEvent,
  JourneyPayloadFor,
  JourneySendResult,
  JourneySendEvent,
  JourneyTypedTx,
  JourneyTransition,
  JourneyTransitionArgs,
  JourneyTransitionTarget
} from "@rxova/journey-core";

type Context = { count: number };
type StepId = "start" | "review" | "done";
type CustomEvent = "custom";
type EventType = "goToNextStep" | CustomEvent;

type PayloadMap = {
  goToNextStep: { origin: "ui" };
  custom: { amount: number };
  goToStepById: { reason: string };
};

const journey = {
  initial: "start" as const,
  context: { count: 0 },
  steps: {
    start: {},
    review: {},
    done: {}
  },
  transitions: [
    { from: "start", event: "goToNextStep", to: "review" },
    { from: "review", event: "custom", to: "done" }
  ]
} satisfies JourneyDefinition<Context, StepId, EventType, PayloadMap>;

const machine = createJourneyMachine<Context, StepId, EventType, PayloadMap>(journey);

const defaultedJourney = {
  initial: "start" as const,
  context: { count: 0 },
  steps: {
    start: {},
    review: {},
    done: {}
  },
  transitions: [{ from: "start", event: "goToNextStep", to: "review" }]
} as const satisfies JourneyDefinition<Context>;

const defaultedMachine = createJourneyMachine(defaultedJourney);
const configuredMachine = createJourneyMachine(journey, { completeOnNoNextStep: true });

type SendArg = Parameters<typeof machine.send>[0];
type ObsEvent = JourneyObservationEvent<StepId, EventType, PayloadMap>;
type DefaultedSendArg = Parameters<typeof defaultedMachine.send>[0];
type StartObservationFromMachine = Parameters<Parameters<typeof machine.subscribeStart>[0]>[0];
type CompleteObservationFromMachine = Parameters<
  Parameters<typeof machine.subscribeComplete>[0]
>[0];
type CloseObservationFromMachine = Parameters<Parameters<typeof machine.subscribeTerminate>[0]>[0];

expectTypeOf(machine).toEqualTypeOf<JourneyMachine<Context, StepId, EventType, PayloadMap>>();
expectTypeOf(machine.getSnapshot()).toEqualTypeOf<JourneySnapshot<Context, StepId>>();
expectTypeOf(configuredMachine.getSnapshot()).toEqualTypeOf<JourneySnapshot<Context, StepId>>();
expectTypeOf<SendArg>().toEqualTypeOf<JourneySendEvent<StepId, EventType, PayloadMap>>();
expectTypeOf<Awaited<ReturnType<typeof machine.goToNextStep>>>().toEqualTypeOf<
  Awaited<ReturnType<typeof machine.send>>
>();
expectTypeOf<Awaited<ReturnType<typeof machine.terminateJourney>>>().toEqualTypeOf<
  Awaited<ReturnType<typeof machine.send>>
>();
expectTypeOf<Awaited<ReturnType<typeof machine.completeJourney>>>().toEqualTypeOf<
  Awaited<ReturnType<typeof machine.send>>
>();
expectTypeOf<Awaited<ReturnType<typeof machine.send>>>().toEqualTypeOf<
  JourneySendResult<Context, StepId>
>();
expectTypeOf<Awaited<ReturnType<typeof machine.send>>["error"]>().toEqualTypeOf<
  unknown | undefined
>();
expectTypeOf<ObsEvent>().toMatchTypeOf<{ type: string }>();
expectTypeOf(defaultedMachine.getSnapshot().currentStepId).toEqualTypeOf<
  "start" | "review" | "done"
>();
expectTypeOf<Extract<DefaultedSendArg, { type: "goToNextStep" }>>().toEqualTypeOf<{
  type: "goToNextStep";
  payload?: unknown;
}>();
expectTypeOf<Extract<DefaultedSendArg, { type: "goToPreviousStep" }>>().toEqualTypeOf<{
  type: "goToPreviousStep";
  payload?: unknown;
}>();
expectTypeOf<Extract<SendArg, { type: "terminateJourney" }>>().toEqualTypeOf<{
  type: "terminateJourney";
  payload?: unknown;
}>();
expectTypeOf<Extract<SendArg, { type: "completeJourney" }>>().toEqualTypeOf<{
  type: "completeJourney";
  payload?: unknown;
}>();
expectTypeOf<Extract<ObsEvent, { type: "journey.start" }>["stepId"]>().toEqualTypeOf<StepId>();
expectTypeOf<StartObservationFromMachine["type"]>().toEqualTypeOf<"journey.start">();
expectTypeOf<StartObservationFromMachine["stepId"]>().toEqualTypeOf<StepId>();
expectTypeOf<CompleteObservationFromMachine["type"]>().toEqualTypeOf<"journey.complete">();
expectTypeOf<CompleteObservationFromMachine["stepId"]>().toEqualTypeOf<StepId>();
expectTypeOf<CloseObservationFromMachine["type"]>().toEqualTypeOf<"journey.close">();
expectTypeOf<CloseObservationFromMachine["stepId"]>().toEqualTypeOf<StepId>();

expectTypeOf<JourneyPayloadFor<EventType, PayloadMap, "goToNextStep">>().toEqualTypeOf<{
  origin: "ui";
}>();
expectTypeOf<JourneyPayloadFor<EventType, PayloadMap, "custom">>().toEqualTypeOf<{
  amount: number;
}>();
expectTypeOf<JourneyPayloadFor<EventType, PayloadMap, "goToStepById">>().toEqualTypeOf<{
  reason: string;
}>();

const transitionArgs: JourneyTransitionArgs<Context, StepId, EventType, PayloadMap> = {
  context: { count: 1 },
  from: "start",
  timeline: ["start", "review"],
  index: 1,
  event: { type: "custom", payload: { amount: 2 } }
};
expectTypeOf(transitionArgs.event).toEqualTypeOf<JourneyEvent<StepId, EventType, PayloadMap>>();

const transitionTargetStep: JourneyTransitionTarget<StepId> = "review";
const transitionTargetTerminal: JourneyTransitionTarget<StepId> = "COMPLETE";
void transitionTargetStep;
void transitionTargetTerminal;

const machineOptions = {
  persistence: {
    key: "journey",
    version: 2,
    migrate: (_value, persistedVersion) => ({
      currentStepId: "start",
      history: {
        timeline: ["start", "review"],
        index: Math.max(0, Number(persistedVersion) - 1)
      },
      context: { count: Number(persistedVersion) },
      status: "running",
      visited: {
        start: true,
        review: true,
        done: false
      },
      stepMeta: {
        start: undefined,
        review: undefined,
        done: undefined
      }
    })
  }
} satisfies JourneyMachineOptions<Context, StepId>;
void machineOptions;

declare const helperTx: JourneyTypedTx<Context, StepId, EventType, PayloadMap>;
declare const helperCreateTransitions: JourneyCreateTransitions<
  Context,
  StepId,
  EventType,
  PayloadMap
>;

const builtTransition = helperTx.from("start").on("goToNextStep").to("review");
expectTypeOf(builtTransition.from).toEqualTypeOf<StepId | "*">();

const customBuilder = helperTx.from("review").on("custom");
customBuilder.to("done", {
  effect: ({ event }) => {
    expectTypeOf(event.type).toEqualTypeOf<"custom">();
    expectTypeOf(event.payload).toEqualTypeOf<{ amount: number } | undefined>();
    // @ts-expect-error custom payload does not expose goToNextStep fields
    void event.payload?.origin;
    return { count: event.payload?.amount ?? 0 };
  }
});
customBuilder.choose(({ when, otherwise }) => [
  when(({ event }) => {
    expectTypeOf(event.type).toEqualTypeOf<"custom">();
    expectTypeOf(event.payload).toEqualTypeOf<{ amount: number } | undefined>();
    return (event.payload?.amount ?? 0) > 0;
  }).to("done"),
  otherwise().to("review")
]);
helperTx
  .from("start")
  .on("goToNextStep")
  .choose(({ when, otherwise }) => [
    when(({ context }) => {
      expectTypeOf(context).toEqualTypeOf<Context>();
      return context.count > 0;
    }).to("review"),
    otherwise().to("done")
  ]);

const builtTransitions = helperCreateTransitions(
  builtTransition,
  customBuilder.to("done"),
  customBuilder.choose(customBuilder.otherwise().to("review"))
);
expectTypeOf(builtTransitions).toEqualTypeOf<
  Array<JourneyTransition<Context, StepId, EventType, PayloadMap>>
>();

const builtComplete = helperTx.from("review").toComplete();
expectTypeOf(builtComplete.event).toEqualTypeOf<"completeJourney">();
expectTypeOf(builtComplete.from).toEqualTypeOf<StepId | "*">();

declare const terminalHelperTx: JourneyTypedTx<
  Context,
  StepId,
  EventType,
  PayloadMap & { completeJourney: { reason: "user" } }
>;
const terminalPayloadTransition = terminalHelperTx.from("review").toComplete({
  effect: ({ event }) => {
    expectTypeOf(event.type).toEqualTypeOf<"completeJourney">();
    expectTypeOf(event.payload).toEqualTypeOf<{ reason: "user" } | undefined>();
  }
});
expectTypeOf(terminalPayloadTransition.event).toEqualTypeOf<"completeJourney">();

const builtTerminate = helperTx.any().toTerminate();
expectTypeOf(builtTerminate.event).toEqualTypeOf<"terminateJourney">();
expectTypeOf(builtTerminate.from).toEqualTypeOf<StepId | "*">();

// @ts-expect-error terminal builders do not accept "to"
helperTx.from("start").toComplete({ to: "done" });
// @ts-expect-error terminal builders do not accept "to"
helperTx.any().toTerminate({ to: "done" });

const badPayloadEvent: JourneyEvent<StepId, EventType, PayloadMap> = {
  type: "custom",
  // @ts-expect-error payload must match mapped type
  payload: { amount: "nope" }
};
void badPayloadEvent;

// @ts-expect-error goTo requires valid step id
const badStep: StepId = "missing";
void badStep;
