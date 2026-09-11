export { createLinearJourney, withLinearTypes } from "./linear/linear";
export type {
  CompletePayloadOf,
  JourneyTerminationPayloads,
  LinearJourneyDefinition,
  LinearJourneyMachine,
  LinearStepConfig,
  LinearStepIdOf,
  LinearStepInput,
  TerminatePayloadOf
} from "./linear/linear.types";

// normalizeGraphDefinition is deliberately not exported: its return type names
// RuntimeStep/RuntimeTransition, which are internal and have no export path, so
// publishing it would freeze those shapes into the 1.0 contract.
export { createGraphJourney, withGraphTypes } from "./graph/graph";
export type {
  GraphHookArgs,
  GraphJourneyDefinition,
  GraphJourneyMachine,
  GraphJourneyOptions,
  GraphOnEntry,
  GraphStepConfig,
  GraphTransition,
  SendArgs,
  SendVerb,
  SendWork,
  SendWorkArgs,
  TransitionGuard
} from "./graph/graph.types";

// The bag exists so steps can live in separate files, and so `withTypes` has
// somewhere to pin what a definition cannot infer on its own.
export type {
  Bag,
  GraphDefinition,
  GraphStep,
  HandlersOf,
  MetaOf,
  ResultOf,
  ResultsOf
} from "./graph/bag.types";

export { JourneyError, isJourneyError } from "./core/errors";
export type { JourneyErrorCode, JourneyErrorDetails } from "./core/errors";

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
  JourneySnapshotBase,
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

// Named by the exported JourneyPersistOption, so it has to be reachable here too.
export type { JourneyStorage } from "./plugins/persistence/persistence.types";
