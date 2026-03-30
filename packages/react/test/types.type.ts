import { expectTypeOf } from "expect-type";
import type * as React from "react";

import { createExecutionPathsPlugin } from "@rxova/journey-core/execution-paths";
import type {
  JourneyCompleteObservationEvent,
  JourneyDefinition,
  JourneyObservationEvent,
  JourneyStartObservationEvent,
  JourneyTerminateObservationEvent
} from "@rxova/journey-core";
import type {
  JourneyApi,
  JourneyComputed,
  JourneyCompleteEvent,
  JourneyProviderErrorContext,
  JourneyProviderProps,
  JourneyRuntime,
  JourneyRuntimeFactory,
  JourneyStartEvent,
  JourneyTerminateEvent,
  JourneyViews
} from "@rxova/journey-react";
import { createJourney, createJourneyFactory } from "@rxova/journey-react";

type Context = { userId: string };
type StepId = "start" | "review";
type EventMap = {
  goToNextStep: { reason: string };
  approve: { approvedBy: string };
};

const Step: React.FC = () => null;
const plugins = [createExecutionPathsPlugin()] as const;

const journey: JourneyDefinition<Context, StepId, EventMap, { title: string }> = {
  initial: "start",
  context: { userId: "42" },
  steps: {
    start: { meta: { title: "Start" } },
    review: { meta: { title: "Review" } }
  },
  transitions: {
    start: { goToNextStep: [{ to: "review" }] },
    review: { approve: [{ to: "review" }] }
  }
};

const views = {
  start: Step,
  review: Step
} satisfies JourneyViews<StepId>;

const journeyRuntime = createJourney(journey, { plugins });
const journeyFactory = createJourneyFactory(journey, { plugins });
void journeyRuntime;
void journeyFactory;

type Api = JourneyApi<Context, StepId, EventMap, { title: string }>;
type SendArg = Parameters<Api["send"]>[0];
type ProviderProps = JourneyProviderProps<StepId, EventMap, { title: string }>;
type RuntimeDispose = JourneyRuntime<Context, StepId>["dispose"];
type RuntimeFactory = JourneyRuntimeFactory<
  Context,
  StepId,
  EventMap,
  { title: string },
  typeof plugins
>;
type StartEventFromProvider = Parameters<NonNullable<ProviderProps["onStart"]>>[0];
type CompleteEventFromProvider = Parameters<NonNullable<ProviderProps["onComplete"]>>[0];
type CloseEventFromProvider = Parameters<NonNullable<ProviderProps["onTerminate"]>>[0];

const providerProps: ProviderProps = {
  views,
  onStart: () => undefined,
  onComplete: () => undefined,
  onTerminate: () => undefined,
  onError: () => undefined,
  disposeOnUnmount: true,
  children: null
};
expectTypeOf(providerProps.views).toEqualTypeOf<JourneyViews<StepId>>();
expectTypeOf<ProviderProps["disposeOnUnmount"]>().toEqualTypeOf<boolean | undefined>();
expectTypeOf<ProviderProps["onError"]>().toEqualTypeOf<
  ((error: unknown, context: JourneyProviderErrorContext) => void) | undefined
>();
expectTypeOf<StartEventFromProvider>().toEqualTypeOf<
  JourneyStartEvent<StepId, EventMap, { title: string }>
>();
expectTypeOf<CompleteEventFromProvider>().toEqualTypeOf<
  JourneyCompleteEvent<StepId, EventMap, { title: string }>
>();
expectTypeOf<CloseEventFromProvider>().toEqualTypeOf<
  JourneyTerminateEvent<StepId, EventMap, { title: string }>
>();
expectTypeOf<JourneyStartEvent<StepId>>().toEqualTypeOf<JourneyStartObservationEvent<StepId>>();
expectTypeOf<JourneyCompleteEvent<StepId>>().toEqualTypeOf<
  JourneyCompleteObservationEvent<StepId>
>();
expectTypeOf<JourneyTerminateEvent<StepId>>().toEqualTypeOf<
  JourneyTerminateObservationEvent<StepId>
>();
expectTypeOf<StartEventFromProvider["type"]>().toEqualTypeOf<"journey.start">();
expectTypeOf<StartEventFromProvider["stepId"]>().toEqualTypeOf<StepId>();
expectTypeOf<CompleteEventFromProvider["type"]>().toEqualTypeOf<"journey.completed">();
expectTypeOf<CompleteEventFromProvider["stepId"]>().toEqualTypeOf<StepId>();
expectTypeOf<CloseEventFromProvider["type"]>().toEqualTypeOf<"journey.terminated">();
expectTypeOf<CloseEventFromProvider["stepId"]>().toEqualTypeOf<StepId>();
expectTypeOf<RuntimeDispose>().toEqualTypeOf<() => void>();
expectTypeOf(journeyFactory).toEqualTypeOf<RuntimeFactory>();
expectTypeOf<ReturnType<typeof journeyFactory>>().toEqualTypeOf<
  JourneyRuntime<Context, StepId, EventMap, { title: string }, typeof plugins>
>();

expectTypeOf<Api["start"]>().returns.toEqualTypeOf<
  Promise<ReturnType<typeof journeyRuntime.useJourneySnapshot>>
>();
expectTypeOf<Api["goToNextStep"]>().parameters.toEqualTypeOf<[]>();
expectTypeOf<Awaited<ReturnType<Api["send"]>>["error"]>().toEqualTypeOf<unknown | undefined>();
expectTypeOf<ReturnType<Api["updateContext"]>>().toEqualTypeOf<
  Promise<ReturnType<typeof journeyRuntime.useJourneySnapshot>>
>();
expectTypeOf<
  ReturnType<typeof journeyRuntime.useJourneySnapshot>["context"]
>().toEqualTypeOf<Context>();
expectTypeOf<
  ReturnType<typeof journeyRuntime.useJourneySnapshot>["currentStepId"]
>().toEqualTypeOf<StepId>();
expectTypeOf<ReturnType<typeof journeyRuntime.useJourneyComputed>>().toEqualTypeOf<
  JourneyComputed<StepId>
>();
expectTypeOf<ReturnType<typeof journeyRuntime.useJourneyApi>>().toMatchTypeOf<Api>();
expectTypeOf<ReturnType<typeof journeyRuntime.dispose>>().toEqualTypeOf<void>();
expectTypeOf(journeyRuntime.machine.getExecutionPaths).toBeFunction();
expectTypeOf<
  React.ComponentProps<typeof journeyRuntime.JourneyProvider>
>().toEqualTypeOf<ProviderProps>();
type ObservationFromHook = Parameters<Parameters<typeof journeyRuntime.useJourneyEvent>[0]>[0];
expectTypeOf<ObservationFromHook["type"]>().toEqualTypeOf<
  JourneyObservationEvent<StepId, EventMap>["type"]
>();
type TransitionStartFromHook = Extract<ObservationFromHook, { type: "transition.start" }>;
type StartEventTypeFromHook = TransitionStartFromHook["event"]["type"];
const includesCustomApproveEventType: Extract<StartEventTypeFromHook, "approve"> = "approve";
expectTypeOf<
  Extract<ObservationFromHook, { type: "step.enter" }>["stepId"]
>().toEqualTypeOf<StepId>();
void includesCustomApproveEventType;

// Negative checks.
// @ts-expect-error invalid payload for approve
const badPayload: SendArg = { type: "approve", payload: { approvedBy: 123 } };

// @ts-expect-error missing required review view
const missingView: JourneyViews<StepId> = {
  start: Step
};

const extraView: JourneyViews<StepId> = {
  start: Step,
  review: Step,
  // @ts-expect-error extra view keys are not allowed
  extra: Step
};

void badPayload;
void missingView;
void extraView;
