import { expectTypeOf } from "expect-type";
import type * as React from "react";

import { createJourneyBindings } from "@rxova/journey-react";
import type {
  JourneyApi,
  JourneyBindingsProviderProps,
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

const providerProps: JourneyBindingsProviderProps<Context, StepId, CustomEvent, PayloadMap> = {
  journey,
  children: null
};
expectTypeOf(providerProps.journey).toEqualTypeOf<
  JourneyReactDefinition<Context, StepId, CustomEvent, PayloadMap> | undefined
>();

expectTypeOf<Api["goToNextStep"]>().parameters.toEqualTypeOf<[]>();
expectTypeOf<ReturnType<typeof bindings.useJourneySnapshot>["context"]>().toEqualTypeOf<Context>();
expectTypeOf<
  ReturnType<typeof bindings.useJourneySnapshot>["currentStepId"]
>().toEqualTypeOf<StepId>();
expectTypeOf<ReturnType<typeof bindings.useJourneyApi>>().toMatchTypeOf<Api>();

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
