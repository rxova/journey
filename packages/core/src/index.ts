export { createLinearJourney } from "./linear/linear";
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
export { createGraphJourney } from "./graph/graph";
export type {
  GraphHookArgs,
  GraphJourneyDefinition,
  GraphJourneyMachine,
  GraphJourneyOptions,
  GraphStepConfig,
  GraphTransitionCandidate,
  GraphTransitionsMap,
  SendArgs,
  SendVerb,
  SendWork,
  SendWorkArgs,
  TransitionGuard
} from "./graph/graph.types";

export { createGraphJourneyBuilder } from "./graph/builder";
// The type bag exists so steps and hooks can live in separate files; that only
// works if the types those signatures mention are nameable from outside.
export type {
  BagSendWorkArgs,
  BagSnapshot,
  GuardArgsOf,
  HandlersOf,
  JourneyBuilder,
  JourneyEventWork,
  JourneyStepBuilder,
  JourneyStepConfig,
  JourneyStepTransitions,
  JourneyToBuilder,
  JourneyTypeBag,
  MetaOf,
  StayFactory,
  ToFactory,
  WorkFactory,
  WorkGuardArgs
} from "./graph/builder.types";

export { JourneyError, isJourneyError } from "./core/errors";
export type { JourneyErrorCode, JourneyErrorDetails } from "./core/errors";

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
