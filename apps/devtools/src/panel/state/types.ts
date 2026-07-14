import type {
  JourneyDevtoolsBridgeEnvelope,
  JourneyDevtoolsMachineFeatureDescriptor,
  JourneyDevtoolsMachineMeta,
  JourneyDevtoolsOperationInvoke,
  JourneyDevtoolsProtocolVersion,
  JourneyDevtoolsSerializableSnapshot
} from "@rxova/journey-devtools-bridge";

export type TimelineEnvelopeKind =
  | Exclude<JourneyDevtoolsBridgeEnvelope["kind"], "unregister">
  | "queuedOperation";
export type NonUnregisterBridgeEnvelope = Exclude<
  JourneyDevtoolsBridgeEnvelope,
  { kind: "unregister" }
>;

export type JourneyPanelTimelineKind = "init" | "snapshot" | "operation" | "event" | "error";

export type JourneyPanelPendingCommand = {
  requestId: string;
  invocation: JourneyDevtoolsOperationInvoke;
  timestamp: number;
  timelineEntryId: string;
};

export type JourneyPanelTimelineEntry = {
  id: string;
  timestamp: number;
  kind: JourneyPanelTimelineKind;
  label: string;
  requestId: string | null;
  invocation: JourneyDevtoolsOperationInvoke | null;
  envelopeKind: TimelineEnvelopeKind;
  snapshot: JourneyDevtoolsSerializableSnapshot | null;
  actionPayload: unknown;
  meta: {
    machineId: string;
    operationId?: string;
    transitioned?: boolean;
    transitionId?: string;
    errorMessage?: string;
  };
};

export type JourneyPanelMachineMeta = JourneyDevtoolsMachineMeta & {
  mutationsEnabled: boolean;
  features: readonly JourneyDevtoolsMachineFeatureDescriptor[];
};

export type JourneyPanelMachineState = {
  meta: JourneyPanelMachineMeta;
  protocolVersion?: JourneyDevtoolsProtocolVersion;
  snapshot: JourneyDevtoolsSerializableSnapshot;
  timelineEntries: JourneyPanelTimelineEntry[];
  selectedTimelineIndex: number;
  followLatest: boolean;
  timelineSequence?: number;
  pendingCommandsByRequestId: Record<string, JourneyPanelPendingCommand>;
};

export type JourneyPanelState = {
  connected: boolean;
  machines: Record<string, JourneyPanelMachineState>;
  machineOrder: string[];
  selectedMachineId: string | null;
  displayLimit: number | null;
};

export type JourneyPanelAction =
  | { type: "set-connected"; connected: boolean }
  | { type: "clear-machines" }
  | { type: "bridge-envelope"; envelope: JourneyDevtoolsBridgeEnvelope }
  | { type: "select-machine"; machineId: string }
  | { type: "set-display-limit"; limit: number | null }
  | { type: "set-follow-latest"; machineId: string; followLatest: boolean }
  | { type: "select-timeline-entry"; machineId: string; index: number }
  | { type: "prune-timeline"; machineId: string; keep: number | null }
  | {
      type: "queue-command";
      machineId: string;
      requestId: string;
      invocation: JourneyDevtoolsOperationInvoke;
      timestamp: number;
    };

export const MAX_MACHINE_TIMELINE_ENTRIES = 2000;

export const INITIAL_SNAPSHOT: JourneyDevtoolsSerializableSnapshot = {
  type: "graph",
  currentStepId: "unknown",
  history: { timeline: ["unknown"], index: 0 },
  context: {},
  visited: {},
  status: "idled",
  async: { isLoading: false, byStep: {} }
};
