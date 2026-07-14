import { expectTypeOf } from "expect-type";
import type * as React from "react";

import { createLinearJourney } from "@rxova/journey-core";
import { createExecutionPathsPlugin } from "@rxova/journey-core/execution-paths";
import type {
  JourneyAsyncPhase,
  JourneyDefinition,
  JourneySendResult,
  JourneyStepAsyncState,
  LinearJourneyMachine,
  LinearJourneySnapshot
} from "@rxova/journey-core";

import { createWizard, useWizard, useWizardSelector, Wizard } from "@rxova/journey-react";
import type { JourneyApi, UseWizardResult, WizardProps } from "@rxova/journey-react";
import { createGraphJourney } from "@rxova/journey-react/graph";
import { useJourneySnapshot, useOwnedJourney } from "@rxova/journey-react/headless";

type Context = { userId: string };
type StepId = "start" | "review";
type EventMap =
  | { type: "goToNextStep"; payload?: { reason: string } }
  | { type: "approve"; payload?: { approvedBy: string } };

const Step: React.FC = () => null;
const plugins = [createExecutionPathsPlugin()] as const;

// ─── Wizard tier ─────────────────────────────────────────────────────────────

const bundle = createWizard({
  context: { userId: "42" } as Context,
  steps: { start: Step, review: Step }
});
void bundle;

type BundleWizardResult = ReturnType<typeof bundle.useWizard>;
expectTypeOf<BundleWizardResult["context"]>().toEqualTypeOf<Context>();
expectTypeOf<BundleWizardResult["activeStepId"]>().toEqualTypeOf<"start" | "review">();
expectTypeOf<BundleWizardResult["isFirstStep"]>().toEqualTypeOf<boolean>();
expectTypeOf<BundleWizardResult["isStepFirstTimeVisit"]>().toEqualTypeOf<boolean>();
expectTypeOf<BundleWizardResult["visited"]>().toEqualTypeOf<Record<"start" | "review", boolean>>();
expectTypeOf<BundleWizardResult["controls"]["pause"]>().toEqualTypeOf<() => void>();
expectTypeOf<BundleWizardResult["snapshot"]>().toEqualTypeOf<
  LinearJourneySnapshot<Context, "start" | "review">
>();
expectTypeOf<BundleWizardResult["machine"]>().toEqualTypeOf<
  LinearJourneyMachine<Context, "start" | "review">
>();
expectTypeOf<ReturnType<BundleWizardResult["goToNextStep"]>>().toEqualTypeOf<
  Promise<JourneySendResult<Context, "start" | "review">>
>();

// Zero-factory hook: generic assertion at the call site.
type LooseWizardResult = ReturnType<typeof useWizard<Context>>;
void useWizard;
expectTypeOf<LooseWizardResult["context"]>().toEqualTypeOf<Context>();
expectTypeOf<LooseWizardResult>().toMatchTypeOf<UseWizardResult<Context, string>>();

// useWizardSelector infers the selected slice.
const useSelectorProbe = () => useWizardSelector((snapshot) => snapshot.currentStepId);
void useSelectorProbe;
expectTypeOf<ReturnType<typeof useSelectorProbe>>().toEqualTypeOf<string>();

// Wizard props: react-use-wizard parity knobs.
type Props = WizardProps<Context>;
expectTypeOf<Props["startIndex"]>().toEqualTypeOf<number | undefined>();
expectTypeOf<Props["startStepId"]>().toEqualTypeOf<string | undefined>();
expectTypeOf<Props["wrapper"]>().toEqualTypeOf<
  React.ReactElement<{ children?: React.ReactNode }> | undefined
>();
void Wizard;

// ─── Graph tier ──────────────────────────────────────────────────────────────

const graphDefinition: JourneyDefinition<Context, StepId, EventMap, { title: string }> = {
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

const graph = createGraphJourney(graphDefinition, { plugins });
void graph;

type Api = JourneyApi<Context, StepId, EventMap, { title: string }>;
type SendArg = Parameters<Api["send"]>[0];

expectTypeOf<ReturnType<typeof graph.useApi>>().toMatchTypeOf<Api>();
expectTypeOf<ReturnType<typeof graph.useSnapshot>["context"]>().toEqualTypeOf<Context>();
expectTypeOf<ReturnType<typeof graph.useSnapshot>["currentStepId"]>().toEqualTypeOf<StepId>();
expectTypeOf<ReturnType<typeof graph.useSnapshot>["type"]>().toEqualTypeOf<"graph">();
expectTypeOf<Parameters<typeof graph.useStepAsyncState>>().toEqualTypeOf<[StepId]>();
expectTypeOf<ReturnType<typeof graph.useStepAsyncState>>().toEqualTypeOf<JourneyStepAsyncState>();
expectTypeOf<
  ReturnType<typeof graph.useStepAsyncState>["phase"]
>().toEqualTypeOf<JourneyAsyncPhase>();
expectTypeOf<Api["controls"]["pause"]>().toEqualTypeOf<() => void>();
expectTypeOf<Api["controls"]["isPaused"]>().toEqualTypeOf<() => boolean>();

// Provider requires a complete views record.
type GraphProviderPropsOfBundle = React.ComponentProps<typeof graph.Provider>;
expectTypeOf<GraphProviderPropsOfBundle["views"]>().toEqualTypeOf<
  Record<StepId, React.ComponentType>
>();
expectTypeOf<GraphProviderPropsOfBundle["context"]>().toEqualTypeOf<Partial<Context> | undefined>();
expectTypeOf<GraphProviderPropsOfBundle["autoStart"]>().toEqualTypeOf<boolean | undefined>();

// useStepApi narrows send() to the events the step declares.
type ReviewStepApi = ReturnType<typeof graph.useStepApi<"review">>;
type ReviewSendArg = Parameters<ReviewStepApi["send"]>[0];
expectTypeOf<ReviewSendArg["type"]>().toEqualTypeOf<"approve">();

// Negative checks.
// @ts-expect-error invalid payload for approve
const badPayload: SendArg = { type: "approve", payload: { approvedBy: 123 } };
void badPayload;

// @ts-expect-error missing required review view
const missingViews: GraphProviderPropsOfBundle["views"] = { start: Step };
void missingViews;

// ─── Headless tier ───────────────────────────────────────────────────────────

const useHeadlessProbe = () => {
  const machine = useOwnedJourney(() =>
    createLinearJourney<Context, StepId>({
      context: { userId: "42" },
      steps: ["start", "review"]
    })
  );
  return useJourneySnapshot(machine);
};
void useHeadlessProbe;

type HeadlessSnapshot = ReturnType<typeof useHeadlessProbe>;
expectTypeOf<HeadlessSnapshot["context"]>().toEqualTypeOf<Context>();
expectTypeOf<HeadlessSnapshot["currentStepId"]>().toEqualTypeOf<StepId>();
