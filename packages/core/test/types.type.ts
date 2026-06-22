import { expectTypeOf } from "expect-type";

import {
  createGraphJourney,
  createGraphJourneyBuilder,
  createJourneyMachine,
  type JourneyAsyncPhase,
  type JourneyAsyncState,
  type JourneyAutosaveState,
  type JourneyBuilder,
  type JourneyBuilderOnEntry,
  type JourneyBuilderTerminalEntry,
  type JourneyComputed,
  type JourneyCompleteObservationEvent,
  type JourneyDefaultEventType,
  type JourneyDefinition,
  type JourneyEvent,
  type JourneyFullEventType,
  type JourneyHistory,
  type JourneyLinearStep,
  type JourneyLifecycleErrorContext,
  type JourneyLifecycleErrorObservationEvent,
  type JourneyMachine,
  type JourneyMachineOptions,
  type JourneyMachinePluginHooks,
  type JourneyMachinePluginSetupContext,
  type JourneyMode,
  type JourneyObservationEvent,
  type JourneyPayloadFor,
  type JourneyResolvedDefinition,
  type JourneyResetObservationEvent,
  type JourneySendEvent,
  type JourneySendResult,
  type JourneySnapshot,
  type JourneyStartObservationEvent,
  type JourneyStatus,
  type JourneyTerminateObservationEvent
} from "@rxova/journey-core";
import { createAnalyticsPlugin } from "@rxova/journey-core/analytics";
import { createAutosavePlugin } from "@rxova/journey-core/autosave";
import { createDiagnosticsPlugin } from "@rxova/journey-core/diagnostics";
import { createExecutionPathsPlugin } from "@rxova/journey-core/execution-paths";
import { createPersistencePlugin } from "@rxova/journey-core/persistence";
import { createReplayPlugin } from "@rxova/journey-core/replay";
import type {
  JourneyBuiltInSendEvent,
  JourneyCustomSendEvent,
  JourneyExecutionPathEventType,
  JourneyGoToStepGraphEdge,
  JourneyGoToStepTransition,
  JourneyLinearTransitions,
  JourneyPersistenceOptions,
  JourneyStepEventGraphEdge,
  JourneyStepEventTransition,
  JourneyStepTransitions,
  JourneyTerminalGraphEdge,
  JourneyTerminalTransition,
  JourneyTransition,
  JourneyTransitionArgs,
  JourneyTransitionGraph,
  JourneyTransitionTarget
} from "../src/types";

type Context = { count: number };
type StepId = "start" | "review" | "done";

type EventMap = {
  goToNextStep: { origin: "ui" };
  custom: { amount: number };
  requestClose: { source: "browser" };
  goToStepById: { reason: string };
};

const stepTransitions = {
  goToNextStep: [{ to: "review" }],
  custom: [
    {
      to: "done",
      updateContext: ({ event, context }) => {
        expectTypeOf(event.type).toEqualTypeOf<"custom">();
        expectTypeOf(event.payload).toEqualTypeOf<{ amount: number } | undefined>();
        expectTypeOf(context).toEqualTypeOf<Readonly<Context>>();
        return { count: event.payload?.amount ?? 0 };
      }
    }
  ]
} satisfies JourneyStepTransitions<Context, StepId, EventMap>;
void stepTransitions;

const linearStep = {
  step: "review",
  label: "start-next",
  timeoutMs: 250,
  updateContext: ({ event, context }) => {
    expectTypeOf(event.type).toEqualTypeOf<"goToNextStep">();
    expectTypeOf(event.payload).toEqualTypeOf<{ origin: "ui" } | undefined>();
    expectTypeOf(context).toEqualTypeOf<Readonly<Context>>();
    return { count: context.count + 1 };
  }
} satisfies JourneyLinearStep<Context, StepId, EventMap>;
void linearStep;

const linearTransitions = ["start", linearStep, "done"] satisfies JourneyLinearTransitions<
  Context,
  StepId,
  EventMap
>;
void linearTransitions;

const journey: JourneyDefinition<Context, StepId, EventMap> = {
  initial: "start",
  context: { count: 0 },
  steps: {
    start: {},
    review: {},
    done: {}
  },
  transitions: {
    start: {
      goToNextStep: [{ to: "review" }]
    },
    review: {
      custom: [{ to: "done" }]
    }
  }
};

const confirmExitJourney = {
  initial: "start" as const,
  context: { count: 0 },
  steps: {
    start: {},
    review: {},
    done: {}
  },
  transitions: {
    global: {
      requestClose: [
        {
          to: "review",
          when: ({ event }) => {
            expectTypeOf(event.type).toEqualTypeOf<"requestClose">();
            expectTypeOf(event.payload).toEqualTypeOf<{ source: "browser" } | undefined>();
            return true;
          }
        }
      ],
      terminateJourney: [{}]
    }
  }
} satisfies JourneyDefinition<Context, StepId, EventMap>;

const defaultedJourney: JourneyDefinition<Context, StepId> = {
  initial: "start",
  context: { count: 0 },
  steps: {
    start: {},
    review: {},
    done: {}
  },
  transitions: {
    start: {
      goToNextStep: [{ to: "review" }]
    }
  }
};

const machine = createJourneyMachine<Context, StepId, EventMap>(journey);
const executionPathsMachine = createJourneyMachine(journey, {
  plugins: [createExecutionPathsPlugin()] as const
});
const analyticsMachine = createJourneyMachine(journey, {
  plugins: [
    createAnalyticsPlugin({
      track: () => undefined
    })
  ] as const
});
const autosaveMachine = createJourneyMachine(journey, {
  plugins: [
    createAutosavePlugin({
      key: "journey:autosave"
    })
  ] as const
});
const diagnosticsMachine = createJourneyMachine(journey, {
  plugins: [createDiagnosticsPlugin()] as const
});
const replayMachine = createJourneyMachine(journey, {
  plugins: [createReplayPlugin()] as const
});
const persistenceMachine = createJourneyMachine(journey, {
  plugins: [createPersistencePlugin({ key: "journey:persistence" })] as const
});
const defaultedMachine = createJourneyMachine(defaultedJourney);
const configuredMachine = createJourneyMachine<Context, StepId, EventMap>(journey, {
  requireExplicitCompletion: false,
  defaultTimeoutMs: 500
});
const persistenceOptions = {
  key: "journey:persistence",
  allowList: ["profile", "preferences.theme"],
  blockList: ["auth.password"]
} satisfies JourneyPersistenceOptions<Context, StepId>;
const persistenceAllowList: readonly string[] | undefined = persistenceOptions.allowList;
const persistenceBlockList: readonly string[] | undefined = persistenceOptions.blockList;
const diagnosticsResult = diagnosticsMachine.getDiagnostics();
const replaySession = replayMachine.getReplaySession();
void persistenceMachine;

type SendArg = Parameters<typeof machine.send>[0];
type ObsEvent = JourneyObservationEvent<StepId, EventMap>;
type DefaultedSendArg = Parameters<typeof defaultedMachine.send>[0];
type StartObservationFromMachine = Parameters<Parameters<typeof machine.subscribeStart>[0]>[0];
type ResetObservationFromMachine = Parameters<Parameters<typeof machine.subscribeReset>[0]>[0];
type CompleteObservationFromMachine = Parameters<
  Parameters<typeof machine.subscribeComplete>[0]
>[0];
type CloseObservationFromMachine = Parameters<Parameters<typeof machine.subscribeTerminate>[0]>[0];

expectTypeOf(confirmExitJourney).toMatchTypeOf<JourneyDefinition<Context, StepId, EventMap>>();
expectTypeOf(machine).toMatchTypeOf<JourneyMachine<Context, StepId, EventMap>>();
expectTypeOf<JourneyEvent<StepId, EventMap>>().toMatchTypeOf<JourneySendEvent<StepId, EventMap>>();
expectTypeOf<JourneyAsyncPhase>().toEqualTypeOf<
  "idle" | "evaluating-when" | "invoking" | "error"
>();
expectTypeOf<JourneyMode>().toEqualTypeOf<"linear" | "graph" | "headless">();
expectTypeOf<JourneyStatus>().toEqualTypeOf<"idled" | "running" | "completed" | "terminated">();
expectTypeOf<JourneyHistory<StepId>>().toEqualTypeOf<{
  timeline: readonly StepId[];
  index: number;
}>();
expectTypeOf<JourneyAsyncState<StepId>>().toEqualTypeOf<{
  isLoading: boolean;
  byStep: Record<
    StepId,
    {
      phase: JourneyAsyncPhase;
      eventType: string | null;
      transitionId: string | null;
      error: unknown;
    }
  >;
}>();
expectTypeOf(executionPathsMachine.getExecutionPaths).toBeFunction();
expectTypeOf(analyticsMachine.trackAnalyticsEvent).toBeFunction();
expectTypeOf(autosaveMachine.getAutosaveState()).toEqualTypeOf<JourneyAutosaveState>();
expectTypeOf(autosaveMachine.flushAutosave()).toEqualTypeOf<Promise<void>>();
expectTypeOf(diagnosticsResult.summary.mode).toEqualTypeOf<"linear" | "graph" | "headless">();
expectTypeOf(diagnosticsResult.summary.stepCount).toEqualTypeOf<number>();
expectTypeOf(replaySession.version).toEqualTypeOf<1>();
expectTypeOf(replaySession.truncated).toEqualTypeOf<boolean>();
expectTypeOf(replaySession.entries[0]?.kind).toEqualTypeOf<"snapshot" | "event" | undefined>();
expectTypeOf(replayMachine.exportReplaySession()).toEqualTypeOf<string>();
expectTypeOf(machine.getSnapshot()).toEqualTypeOf<JourneySnapshot<Context, StepId>>();
expectTypeOf(persistenceAllowList).toMatchTypeOf<readonly string[] | undefined>();
expectTypeOf(persistenceBlockList).toMatchTypeOf<readonly string[] | undefined>();
expectTypeOf(machine.getComputed()).toEqualTypeOf<JourneyComputed<StepId>>();
expectTypeOf(configuredMachine.getSnapshot()).toEqualTypeOf<JourneySnapshot<Context, StepId>>();
expectTypeOf<SendArg>().toEqualTypeOf<JourneySendEvent<StepId, EventMap>>();
expectTypeOf<JourneyBuiltInSendEvent<StepId, EventMap>>().toMatchTypeOf<SendArg>();
expectTypeOf<JourneyCustomSendEvent<EventMap>>().toMatchTypeOf<SendArg>();
expectTypeOf<Awaited<ReturnType<typeof machine.send>>>().toEqualTypeOf<
  JourneySendResult<Context, StepId>
>();
expectTypeOf<Awaited<ReturnType<typeof machine.send>>["error"]>().toEqualTypeOf<
  unknown | undefined
>();
expectTypeOf<ReturnType<typeof machine.updateContext>>().toEqualTypeOf<
  Promise<JourneySnapshot<Context, StepId>>
>();
expectTypeOf<ObsEvent>().toMatchTypeOf<{ type: string }>();
expectTypeOf(defaultedMachine.getSnapshot().currentStepId).toMatchTypeOf<
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
expectTypeOf<Extract<DefaultedSendArg, { type: "goToStepById" }>>().toEqualTypeOf<{
  type: "goToStepById";
  stepId: StepId;
  payload?: unknown;
}>();
expectTypeOf<Extract<SendArg, { type: "terminateJourney" }>>().toEqualTypeOf<{
  type: "terminateJourney";
  payload?: unknown;
}>();
expectTypeOf<Extract<SendArg, { type: "requestClose" }>>().toEqualTypeOf<{
  type: "requestClose";
  payload?: { source: "browser" };
}>();
expectTypeOf<Extract<SendArg, { type: "completeJourney" }>>().toEqualTypeOf<{
  type: "completeJourney";
  payload?: unknown;
}>();
expectTypeOf<JourneyStartObservationEvent<StepId>>().toMatchTypeOf<ObsEvent>();
expectTypeOf<JourneyResetObservationEvent<StepId>>().toMatchTypeOf<ObsEvent>();
expectTypeOf<JourneyCompleteObservationEvent<StepId>>().toMatchTypeOf<ObsEvent>();
expectTypeOf<JourneyTerminateObservationEvent<StepId>>().toMatchTypeOf<ObsEvent>();
expectTypeOf<JourneyLifecycleErrorObservationEvent<StepId>>().toMatchTypeOf<ObsEvent>();
expectTypeOf<StartObservationFromMachine["type"]>().toEqualTypeOf<"journey.start">();
expectTypeOf<StartObservationFromMachine["stepId"]>().toEqualTypeOf<StepId>();
expectTypeOf<ResetObservationFromMachine["type"]>().toEqualTypeOf<"journey.reset">();
expectTypeOf<ResetObservationFromMachine["stepId"]>().toEqualTypeOf<StepId>();
expectTypeOf<CompleteObservationFromMachine["type"]>().toEqualTypeOf<"journey.completed">();
expectTypeOf<CompleteObservationFromMachine["stepId"]>().toEqualTypeOf<StepId>();
expectTypeOf<CloseObservationFromMachine["type"]>().toEqualTypeOf<"journey.terminated">();
expectTypeOf<CloseObservationFromMachine["stepId"]>().toEqualTypeOf<StepId>();
expectTypeOf<JourneyMachineOptions["onLifecycleError"]>().toEqualTypeOf<
  ((error: unknown, context: JourneyLifecycleErrorContext<string>) => void) | undefined
>();
expectTypeOf<JourneyMachinePluginSetupContext<Context, StepId, EventMap>>().toMatchTypeOf<{
  journey: JourneyDefinition<Context, StepId, EventMap>;
  resolvedJourney: JourneyResolvedDefinition<Context, StepId, EventMap>;
  buildInitialSnapshot: () => JourneySnapshot<Context, StepId>;
}>();
expectTypeOf<
  JourneyMachinePluginHooks<Context, StepId, EventMap, unknown, Record<never, never>>
>().toMatchTypeOf<{
  hydrateSnapshot?: (
    snapshot: JourneySnapshot<Context, StepId>
  ) => JourneySnapshot<Context, StepId>;
}>();

expectTypeOf<JourneyPayloadFor<EventMap, "goToNextStep">>().toEqualTypeOf<{
  origin: "ui";
}>();
expectTypeOf<JourneyPayloadFor<EventMap, "custom">>().toEqualTypeOf<{
  amount: number;
}>();
expectTypeOf<JourneyPayloadFor<EventMap, "goToStepById">>().toEqualTypeOf<{
  reason: string;
}>();
expectTypeOf<JourneyExecutionPathEventType<JourneyFullEventType<EventMap>>>().toEqualTypeOf<
  JourneyFullEventType<EventMap>
>();
expectTypeOf<JourneyExecutionPathEventType<"custom">>().toEqualTypeOf<
  "custom" | JourneyDefaultEventType
>();

const transitionArgs: JourneyTransitionArgs<Context, StepId, EventMap> = {
  snapshot: machine.getSnapshot(),
  context: { count: 1 },
  from: "start",
  timeline: ["start", "review"],
  index: 1,
  signal: new AbortController().signal,
  handlers: {},
  event: { type: "custom", payload: { amount: 2 } }
};
expectTypeOf(transitionArgs.event).toEqualTypeOf<JourneyEvent<StepId, EventMap>>();

const transitionTargetStep: JourneyTransitionTarget<StepId> = "review";
const transitionTargetTerminal: JourneyTransitionTarget<StepId> = "COMPLETE";
void transitionTargetStep;
void transitionTargetTerminal;

const transition: JourneyTransition<Context, StepId, EventMap> = {
  from: "start",
  event: "goToNextStep",
  to: "review"
};
void transition;

const stepEventTransition: JourneyStepEventTransition<
  Context,
  StepId,
  EventMap,
  Record<never, never>,
  "custom"
> = {
  from: "review",
  event: "custom",
  to: "done"
};
const terminalTransition: JourneyTerminalTransition<Context, StepId, EventMap> = {
  from: "done",
  event: "terminateJourney"
};
const goToStepTransition: JourneyGoToStepTransition<Context, StepId, EventMap> = {
  from: "review",
  event: "goToStepById",
  to: "done"
};
void stepEventTransition;
void terminalTransition;
void goToStepTransition;

const stepEventGraphEdge: JourneyStepEventGraphEdge<
  Context,
  StepId,
  EventMap,
  Record<never, never>,
  "custom"
> = {
  to: "done"
};
const terminalGraphEdge: JourneyTerminalGraphEdge<Context, StepId, EventMap> = {};
const goToStepGraphEdge: JourneyGoToStepGraphEdge<Context, StepId, EventMap> = {
  to: "done"
};
void stepEventGraphEdge;
void terminalGraphEdge;
void goToStepGraphEdge;

const machineOptions = {
  requireExplicitCompletion: false,
  defaultTimeoutMs: 500,
  plugins: [createExecutionPathsPlugin()] as const
} satisfies JourneyMachineOptions;
void machineOptions;

// @ts-expect-error payload must match mapped type
const badPayloadEvent: JourneyEvent<StepId, EventMap> = {
  type: "custom",
  payload: { amount: "nope" }
};
void badPayloadEvent;

// @ts-expect-error goToStepById send events require a stepId
const badGoToStepSendEvent: JourneySendEvent<StepId, EventMap> = {
  type: "goToStepById"
};
void badGoToStepSendEvent;

const badTerminalStep: JourneyDefinition<Context, StepId, { completeJourney: unknown }> = {
  initial: "start",
  context: { count: 0 },
  steps: {
    start: {},
    review: {},
    done: {}
  },
  // @ts-expect-error completeJourney transitions do not accept "to"
  transitions: {
    start: {
      completeJourney: [
        {
          to: "done"
        }
      ]
    }
  }
};
void badTerminalStep;

const transitionGraph = {
  start: {
    goToNextStep: [{ to: "review" }]
  },
  review: {
    custom: [{ to: "done" }]
  },
  global: {
    completeJourney: [{}]
  }
} satisfies JourneyTransitionGraph<Context, StepId, EventMap>;
void transitionGraph;

// createGraphJourney rejects a transition whose `to` is its own step.
// @ts-expect-error a transition cannot target its own step "start"
const selfTransitionJourney = createGraphJourney({
  initial: "start",
  context: { count: 0 },
  steps: { start: {}, review: {}, done: {} },
  transitions: {
    start: {
      goToNextStep: [{ to: "start" }]
    }
  }
});
void selfTransitionJourney;

// A valid graph definition (no self-transition) is accepted.
const crossStepJourney = createGraphJourney({
  initial: "start",
  context: { count: 0 },
  steps: { start: {}, review: {}, done: {} },
  transitions: {
    start: { goToNextStep: [{ to: "review" }] },
    review: { goToNextStep: [{ to: "done" }] }
  }
});
void crossStepJourney;

const terminalShorthandTrue = {
  start: { goToNextStep: [{ to: "review" }] },
  review: { completeJourney: true }
} satisfies JourneyTransitionGraph<Context, StepId, EventMap>;
void terminalShorthandTrue;

const terminalShorthandEmpty = {
  global: { terminateJourney: [] }
} satisfies JourneyTransitionGraph<Context, StepId, EventMap>;
void terminalShorthandEmpty;

const invalidGoToStepTransitions = {
  // @ts-expect-error goToStepById transitions cannot target terminal states
  goToStepById: [{ to: "COMPLETE" }]
} satisfies JourneyStepTransitions<Context, StepId, EventMap>;
void invalidGoToStepTransitions;

// ─── createGraphJourneyBuilder type tests ────────────────────────────────────────

const builder = createGraphJourneyBuilder<{ context: Context; stepId: StepId; events: EventMap }>();

// createGraphJourneyBuilder returns the expected JourneyBuilder shape
expectTypeOf(builder).toMatchTypeOf<
  JourneyBuilder<{
    context: Context;
    stepId: StepId;
    events: EventMap;
    meta: unknown;
    handlers: Record<never, never>;
  }>
>();

// to() only accepts valid StepId values
// @ts-expect-error "nonexistent" is not a valid StepId
builder.to("nonexistent");

// createStep only accepts valid StepId values
// @ts-expect-error "nonexistent" is not a valid StepId
builder.createStep("nonexistent");

// on{} only accepts valid event keys
builder.createStep("start", {
  // @ts-expect-error unknownEvent is not in EventMap or default events
  on: { unknownEvent: [builder.to("review")] }
});

// build() returns a JourneyDefinition
const builtDef = builder.build({
  initial: "start",
  context: { count: 0 },
  steps: [builder.createStep("start"), builder.createStep("review"), builder.createStep("done")]
});
expectTypeOf(builtDef).toMatchTypeOf<JourneyDefinition<Context, StepId, EventMap>>();

// guard args: context is TContext (simple/wide form)
builder.to("review").when(({ context }) => {
  expectTypeOf(context).toEqualTypeOf<Readonly<Context>>();
  return context.count > 0;
});

// effect args: context is TContext, return is TContext | void (simple/wide form)
builder.to("review").updateContext(({ context }) => {
  expectTypeOf(context).toEqualTypeOf<Readonly<Context>>();
  return { ...context, count: context.count + 1 };
});

builder.to("review").when(({ context }) => {
  // @ts-expect-error transition callback context is readonly
  context.count = 1;
  return true;
});

builder.to("review").updateContext(({ context }) => {
  // @ts-expect-error updateContext callback context is readonly
  context.count = 1;
  return { ...context, count: context.count + 1 };
});

// duplicate transition modifiers are rejected at the type level
builder
  .to("review")
  .when(() => true)
  // @ts-expect-error duplicate .when() calls are not allowed
  .when(() => false);
builder
  .to("review")
  .updateContext(({ context }) => context)
  // @ts-expect-error duplicate .updateContext() calls are not allowed
  .updateContext(({ context }) => context);
builder
  .to("review")
  .onEnter(() => undefined)
  // @ts-expect-error duplicate .onEnter() calls are not allowed
  .onEnter(() => undefined);
builder
  .to("review")
  .onLeave(() => undefined)
  // @ts-expect-error duplicate .onLeave() calls are not allowed
  .onLeave(() => undefined);
// @ts-expect-error duplicate .label() calls are not allowed
builder.to("review").label("first").label("second");
// @ts-expect-error duplicate .timeoutMs() calls are not allowed
builder.to("review").timeoutMs(100).timeoutMs(200);

// ─── Factory form: event.payload is narrowed per event type ─────────────────

builder.createStep("start", {
  on: {
    // Factory form: `to` is typed for "custom" — event.payload narrows to { amount: number }
    custom: ({ to }) => [
      to("review").when(({ event }) => {
        // event.payload is typed as { amount: number } | undefined (from EventMap.custom)
        expectTypeOf(event.payload).toEqualTypeOf<{ amount: number } | undefined>();
        return (event.payload?.amount ?? 0) > 0;
      }),
      to("done").updateContext(({ event, context }) => {
        expectTypeOf(event.payload).toEqualTypeOf<{ amount: number } | undefined>();
        return { ...context, count: context.count + (event.payload?.amount ?? 0) };
      })
    ],
    // Simple form still works: event is the broad union
    goToNextStep: [builder.to("review").when(({ context }) => context.count > 0)]
  }
});

// JourneyBuilderOnEntry is exported and usable as an explicit type annotation
const _typedEntry: JourneyBuilderOnEntry<
  {
    context: Context;
    stepId: StepId;
    events: EventMap;
    meta: unknown;
    handlers: Record<never, never>;
  },
  "custom"
> = ({ to }) => [
  to("review").when(({ event }) => {
    expectTypeOf(event.payload).toEqualTypeOf<{ amount: number } | undefined>();
    return true;
  })
];
void _typedEntry;

const _typedTerminalEntry: JourneyBuilderTerminalEntry<
  {
    context: Context;
    stepId: StepId;
    events: EventMap;
    meta: unknown;
    handlers: Record<never, never>;
  },
  "completeJourney"
> = [
  {
    when: ({ event }) => {
      expectTypeOf(event.type).toEqualTypeOf<"completeJourney">();
      expectTypeOf(event.payload).toEqualTypeOf<unknown | undefined>();
      return true;
    },
    updateContext: ({ context }) => context,
    label: "complete-review",
    timeoutMs: 250
  }
];

builder.createStep("review", {
  on: {
    completeJourney: _typedTerminalEntry,
    terminateJourney: true
  }
});
void _typedTerminalEntry;

// Factory `to` only accepts valid StepId
builder.createStep("start", {
  on: {
    // @ts-expect-error "nonexistent" is not a valid StepId inside factory
    custom: ({ to }) => [to("nonexistent")]
  }
});
