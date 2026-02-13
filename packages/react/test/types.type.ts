import { expectTypeOf } from "expect-type";
import type * as React from "react";

import type {
  JourneyApi,
  JourneyHookResult,
  JourneyProviderProps,
  JourneyReactDefinition
} from "@rxova/journey-react";

type Context = { userId: string };
type StepId = "start" | "review";
type CustomEvent = "approve";
type PayloadMap = {
  next: { reason: string };
  approve: { approvedBy: string };
  goTo: { source: "link" };
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
    { from: "start", event: "next", to: "review" },
    { from: "review", event: "approve", to: "review" }
  ]
} satisfies JourneyReactDefinition<Context, StepId, CustomEvent, PayloadMap>;

type Api = JourneyApi<Context, StepId, CustomEvent, PayloadMap>;
type Hook = JourneyHookResult<Context, StepId, CustomEvent, PayloadMap>;
type SendArg = Parameters<Api["send"]>[0];
type GoToPayload = Parameters<Api["goTo"]>[1];

const providerProps: JourneyProviderProps<Context, StepId, CustomEvent, PayloadMap> = {
  journey,
  children: null
};

expectTypeOf(providerProps.journey).toEqualTypeOf<
  JourneyReactDefinition<Context, StepId, CustomEvent, PayloadMap>
>();
expectTypeOf<Api["next"]>().parameters.toEqualTypeOf<[payload?: PayloadMap["next"]]>();
expectTypeOf<SendArg>().toEqualTypeOf<Parameters<Hook["api"]["send"]>[0]>();
expectTypeOf<GoToPayload>().toEqualTypeOf<PayloadMap["goTo"] | undefined>();
expectTypeOf<Hook["snapshot"]["context"]>().toEqualTypeOf<Context>();
expectTypeOf<Hook["snapshot"]["current"]>().toEqualTypeOf<StepId>();

type DefaultProviderProps = JourneyProviderProps<Context, StepId>;

const defaultJourney = {
  initial: "start",
  context: { userId: "42" },
  steps: {
    start: { component: Step },
    review: { component: Step }
  },
  transitions: [{ from: "start", event: "next", to: "review" }]
} satisfies JourneyReactDefinition<Context, StepId>;

const defaultProviderProps: DefaultProviderProps = {
  journey: defaultJourney,
  children: null
};

expectTypeOf(defaultProviderProps.journey).toEqualTypeOf<JourneyReactDefinition<Context, StepId>>();
expectTypeOf<Api["clearStepError"]>().parameters.toEqualTypeOf<[stepId?: StepId]>();
expectTypeOf<Api["updateContext"]>().parameters.toEqualTypeOf<[(context: Context) => Context]>();

// Negative checks (public API should reject these).
// @ts-expect-error invalid payload for approve
const badPayload: SendArg = { type: "approve", payload: { approvedBy: 123 } };
// @ts-expect-error invalid step id for goTo
const badGoTo: Parameters<Api["goTo"]>[0] = "missing";
// @ts-expect-error invalid payload for goTo
const badGoToPayload: Parameters<Api["goTo"]>[1] = { source: "other" };
const invalidJourney: JourneyReactDefinition<Context, StepId> = {
  initial: "start",
  context: { userId: "42" },
  // @ts-expect-error missing required step id
  steps: {
    start: { component: Step }
  },
  transitions: [{ from: "start", event: "next", to: "review" }]
};
void badPayload;
void badGoTo;
void badGoToPayload;
void invalidJourney;
