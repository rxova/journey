import { expectTypeOf } from "expect-type";
import type * as React from "react";

import { createGraphJourneyBuilder } from "@rxova/journey-core";
import { createExecutionPathsPlugin } from "@rxova/journey-core/execution-paths";
import type {
  JourneyAsyncPhase,
  JourneyDefinition,
  JourneyObservationEvent,
  JourneyStepAsyncState
} from "@rxova/journey-core";
import type {
  JourneyApi,
  JourneyComputed,
  JourneyBuilderRuntime,
  JourneyBuilderRuntimeFromDefinition,
  JourneyProviderErrorContext,
  JourneyProviderProps,
  JourneyRuntime,
  JourneyRuntimeFromDefinition,
  JourneyRuntimeFactoryFromDefinition,
  JourneyViews,
  StepScopedJourneyApi
} from "@rxova/journey-react";
import { createGraphJourney, createJourney, createJourneyFactory } from "@rxova/journey-react";

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
type ProviderProps = JourneyProviderProps<StepId>;
type RuntimeDispose = JourneyRuntime<Context, StepId>["dispose"];
type RuntimeFactoryFromDefinition = JourneyRuntimeFactoryFromDefinition<
  typeof journey,
  typeof plugins
>;

const providerProps: ProviderProps = {
  views,
  onError: () => undefined,
  disposeOnUnmount: true,
  children: null
};
expectTypeOf(providerProps.views).toEqualTypeOf<JourneyViews<StepId>>();
expectTypeOf<ProviderProps["disposeOnUnmount"]>().toEqualTypeOf<boolean | undefined>();
expectTypeOf<ProviderProps["onError"]>().toEqualTypeOf<
  ((error: unknown, context: JourneyProviderErrorContext) => void) | undefined
>();
expectTypeOf<RuntimeDispose>().toEqualTypeOf<() => void>();
expectTypeOf(journeyFactory).toEqualTypeOf<RuntimeFactoryFromDefinition>();
expectTypeOf<ReturnType<typeof journeyFactory>>().toEqualTypeOf<
  JourneyRuntimeFromDefinition<typeof journey, typeof plugins>
>();

expectTypeOf<Api["startJourney"]>().returns.toEqualTypeOf<
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
expectTypeOf<Parameters<typeof journeyRuntime.useStepAsyncState>>().toEqualTypeOf<[StepId]>();
expectTypeOf<
  ReturnType<typeof journeyRuntime.useStepAsyncState>
>().toEqualTypeOf<JourneyStepAsyncState>();
expectTypeOf<
  ReturnType<typeof journeyRuntime.useStepAsyncState>["phase"]
>().toEqualTypeOf<JourneyAsyncPhase>();
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

const badProviderProps: ProviderProps = {
  views,
  // @ts-expect-error JourneyProvider no longer accepts lifecycle callback props
  onStart: () => undefined,
  children: null
};

void badPayload;
void missingView;
void extraView;
void badProviderProps;

type BuilderStepId = "emailCode" | "authenticatorCode" | "loggedIn";
type BuilderEventMap = {
  verifyCodeSuccess: { code: string };
  verifyCodeFailure: { code: string };
  switchAuthMethod: unknown;
  resendCode: { channel: "email" };
  submitLogin: { username: string; password: string };
};
type BuilderContext = { attempts: number };

const { createStep, to, build } = createGraphJourneyBuilder<{
  context: BuilderContext;
  stepId: BuilderStepId;
  events: BuilderEventMap;
  meta: { label: string };
}>();

const emailCodeStep = createStep("emailCode", {
  meta: { label: "Email Code" },
  on: {
    verifyCodeSuccess: [to("loggedIn")],
    verifyCodeFailure: [to("emailCode")],
    switchAuthMethod: [to("authenticatorCode")]
  }
});
expectTypeOf(emailCodeStep.id).toEqualTypeOf<"emailCode">();

const authenticatorCodeStep = createStep("authenticatorCode", {
  meta: { label: "Authenticator Code" },
  on: {
    verifyCodeSuccess: [to("loggedIn")]
  }
});

const loggedInStep = createStep("loggedIn", {
  meta: { label: "Logged In" }
});

const builderDefinition = build({
  initial: "emailCode",
  context: { attempts: 0 },
  steps: [emailCodeStep, authenticatorCodeStep, loggedInStep],
  global: {
    resendCode: [to("emailCode")]
  }
});

const builderJourney = createJourney(builderDefinition);
type BuilderRuntime = JourneyBuilderRuntimeFromDefinition<typeof builderDefinition>;
const builderApi = builderJourney.useStepApi(emailCodeStep.id);
type BuilderApi = typeof builderApi;
type BuilderSendArg = Parameters<typeof builderApi.send>[0];
void builderApi;

expectTypeOf(builderJourney).toMatchTypeOf<
  JourneyBuilderRuntime<BuilderContext, BuilderStepId, BuilderEventMap, { label: string }>
>();
expectTypeOf(builderJourney).toEqualTypeOf<BuilderRuntime>();

// The named graph factory accepts builder output and infers the same builder
// runtime (including `useStepApi`) as the generic createJourney.
const graphBuilderJourney = createGraphJourney(builderDefinition, { plugins });
expectTypeOf(graphBuilderJourney).toEqualTypeOf<
  JourneyBuilderRuntimeFromDefinition<typeof builderDefinition, typeof plugins>
>();
expectTypeOf(graphBuilderJourney.useStepApi).toBeFunction();

expectTypeOf<BuilderApi>().toMatchTypeOf<
  StepScopedJourneyApi<
    BuilderContext,
    BuilderStepId,
    BuilderEventMap,
    "verifyCodeSuccess" | "verifyCodeFailure" | "switchAuthMethod" | "resendCode",
    { label: string }
  >
>();
expectTypeOf({} as BuilderSendArg).toExtend<
  | { type: "verifyCodeSuccess"; payload?: { code: string } | undefined }
  | { type: "verifyCodeFailure"; payload?: { code: string } | undefined }
  | { type: "switchAuthMethod"; payload?: unknown }
  | { type: "resendCode"; payload?: { channel: "email" } | undefined }
>();

const invalidBuilderSendArg: BuilderSendArg = {
  // @ts-expect-error step-scoped send rejects unrelated custom events
  type: "submitLogin",
  payload: { username: "demo", password: "secret" }
};

// @ts-expect-error step-scoped send rejects built-in machine events
const invalidBuiltInBuilderSendArg: BuilderSendArg = { type: "goToStepById", stepId: "loggedIn" };

void invalidBuilderSendArg;
void invalidBuiltInBuilderSendArg;
