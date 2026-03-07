import { expectTypeOf } from "expect-type";
import type * as React from "react";

import { createJourneyBindings } from "@rxova/journey-react";
import type { JourneyObservationEvent } from "@rxova/journey-core";
import type {
  JourneyApi,
  JourneyBindingsProviderProps,
  JourneyEventType,
  JourneyReactDefinition
} from "@rxova/journey-react";

type Context = { userId: string };
type StepId = "start" | "review";
type CustomEvent = "approve";
type PayloadMap = {
  goToNextStep: { reason: string };
  approve: { approvedBy: string };
};

const Step: React.FC = () => null;

const journey = {
  initial: "start",
  context: { userId: "42" },
  steps: {
    start: { component: Step },
    review: { component: Step }
  },
  transitions: [
    { from: "start", event: "goToNextStep", to: "review" },
    { from: "review", event: "approve", to: "review" }
  ]
} satisfies JourneyReactDefinition<Context, StepId, CustomEvent, PayloadMap>;

const bindings = createJourneyBindings(journey);
void bindings;

type Api = JourneyApi<Context, StepId, CustomEvent, PayloadMap>;
type SendArg = Parameters<Api["send"]>[0];
type ProviderProps = JourneyBindingsProviderProps<Context, StepId, CustomEvent, PayloadMap>;
type StartEventFromProvider = Parameters<NonNullable<ProviderProps["onStart"]>>[0];
type CompleteEventFromProvider = Parameters<NonNullable<ProviderProps["onComplete"]>>[0];
type CloseEventFromProvider = Parameters<NonNullable<ProviderProps["onTerminate"]>>[0];

const providerProps: ProviderProps = {
  journey,
  completeOnNoNextStep: true,
  resetOnPersistenceChange: true,
  onStart: () => undefined,
  onComplete: () => undefined,
  onTerminate: () => undefined,
  children: null
};
expectTypeOf(providerProps.journey).toEqualTypeOf<
  JourneyReactDefinition<Context, StepId, CustomEvent, PayloadMap> | undefined
>();
expectTypeOf<StartEventFromProvider["type"]>().toEqualTypeOf<"journey.start">();
expectTypeOf<StartEventFromProvider["stepId"]>().toEqualTypeOf<StepId>();
expectTypeOf<CompleteEventFromProvider["type"]>().toEqualTypeOf<"journey.complete">();
expectTypeOf<CompleteEventFromProvider["stepId"]>().toEqualTypeOf<StepId>();
expectTypeOf<CloseEventFromProvider["type"]>().toEqualTypeOf<"journey.close">();
expectTypeOf<CloseEventFromProvider["stepId"]>().toEqualTypeOf<StepId>();

expectTypeOf<Api["goToNextStep"]>().parameters.toEqualTypeOf<[]>();
expectTypeOf<Awaited<ReturnType<Api["send"]>>["error"]>().toEqualTypeOf<unknown | undefined>();
expectTypeOf<ReturnType<typeof bindings.useJourneySnapshot>["context"]>().toEqualTypeOf<Context>();
expectTypeOf<
  ReturnType<typeof bindings.useJourneySnapshot>["currentStepId"]
>().toEqualTypeOf<StepId>();
expectTypeOf<ReturnType<typeof bindings.useJourneyApi>>().toMatchTypeOf<Api>();
type ObservationFromHook = Parameters<Parameters<typeof bindings.useJourneyEvent>[0]>[0];
expectTypeOf<ObservationFromHook["type"]>().toEqualTypeOf<
  JourneyObservationEvent<StepId, JourneyEventType<CustomEvent>, PayloadMap, unknown>["type"]
>();
expectTypeOf<
  Extract<ObservationFromHook, { type: "journey.start" }>["stepId"]
>().toEqualTypeOf<StepId>();
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

const invalidJourney: JourneyReactDefinition<Context, StepId> = {
  initial: "start",
  context: { userId: "42" },
  // @ts-expect-error missing required step id
  steps: {
    start: { component: Step }
  },
  transitions: [{ from: "start", event: "goToNextStep", to: "review" }]
};

void badPayload;
void invalidJourney;
