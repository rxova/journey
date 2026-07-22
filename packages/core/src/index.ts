export { createLinearJourney } from "./linear/linear";
export type {
  JourneyTerminationPayloads,
  LinearJourneyDefinition,
  LinearJourneyMachine,
  LinearStepConfig,
  LinearStepIdOf,
  LinearStepInput
} from "./linear/linear.types";

// normalizeGraphDefinition is deliberately not exported: its return type names
// RuntimeStep/RuntimeTransition, which are internal and have no export path, so
// publishing it would freeze those shapes into the 1.0 contract.
export { createGraphJourney } from "./graph/graph";
export type {
  GraphHookArgs,
  GraphJourneyDefinition,
  GraphJourneyMachine,
  GraphJourneyOptions,
  GraphStepConfig,
  GraphTransitionCandidate,
  GraphTransitionsMap,
  TransitionGuard
} from "./graph/graph.types";

export { createGraphJourneyBuilder } from "./graph/builder";
export type {
  JourneyBuilder,
  JourneyStepBuilder,
  JourneyStepTransitions,
  JourneyToBuilder,
  JourneyTypeBag
} from "./graph/builder.types";

export { MAX_RAISED_EVENTS } from "./core/helpers";
export type {
  AnyJourneyPlugin,
  ContextUpdater,
  CurrentStepBase,
  GraphGuardState,
  GraphSnapshot,
  GraphTransitionSnapshot,
  JourneyControls,
  JourneyEventObject,
  JourneyEventPayload,
  JourneyEventPayloads,
  JourneyHistoryState,
  JourneyMachineBase,
  JourneyNavigation,
  JourneyOutcome,
  JourneyPersistOption,
  JourneyPlugin,
  JourneyRuntimeOptions,
  JourneySnapshot,
  JourneyStatus,
  JourneyStructure,
  JourneySubscriptionEvent,
  JourneySubscriptions,
  LinearSnapshot,
  MachineState,
  NavigationFailureReason,
  NavigationDirection,
  NavigationResult,
  StepEnterDirection,
  NavigationWork,
  NavigationWorkArgs,
  OnEnterHook,
  OnLeaveHook,
  PluginApis,
  PluginHost,
  StepAsyncState,
  StepHookArgs,
  TransitionState,
  Unsubscribe
} from "./core/types";
