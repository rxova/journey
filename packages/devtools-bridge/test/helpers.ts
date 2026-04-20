import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";
import { createExecutionPathsPlugin } from "@rxova/journey-core/execution-paths";
import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  isJourneyDevtoolsBridgeEnvelope,
  type JourneyDevtoolsBridgeEnvelope,
  type JourneyDevtoolsExtensionEnvelope
} from "@rxova/journey-devtools-bridge";

type StepId = "start" | "review";
type Context = { count: number };

const createJourney = (): JourneyDefinition<Context, StepId> => ({
  initial: "start",
  context: { count: 0 },
  steps: {
    start: {},
    review: {}
  },
  transitions: {
    start: {
      goToNextStep: [{ to: "review" }]
    }
  }
});

export const createTestMachine = async (
  options: {
    withExecutionPaths?: boolean;
    journey?: JourneyDefinition<Context, StepId>;
  } = {}
) => {
  const machine = createJourneyMachine(options.journey ?? createJourney(), {
    plugins:
      options.withExecutionPaths === false
        ? ([] as const)
        : ([createExecutionPathsPlugin()] as const)
  });

  await machine.startJourney();
  return machine;
};

export const waitForMessages = async () => {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
};

export const waitForCollector = async (
  predicate: () => boolean,
  timeoutMs = 250
): Promise<void> => {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out waiting for devtools bridge message.");
    }
    await waitForMessages();
  }
};

export const collectBridgeMessages = () => {
  const messages: JourneyDevtoolsBridgeEnvelope[] = [];
  const listener = (event: MessageEvent<unknown>) => {
    if (isJourneyDevtoolsBridgeEnvelope(event.data)) {
      messages.push(event.data);
    }
  };

  window.addEventListener("message", listener);
  return {
    messages,
    stop: () => {
      window.removeEventListener("message", listener);
    }
  };
};

export const buildInvokeEnvelope = (
  machineId: string,
  requestId: string,
  invocation: JourneyDevtoolsExtensionEnvelope["invocation"],
  origin = window.location.origin
) =>
  new MessageEvent("message", {
    source: window,
    origin,
    data: {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
      kind: "invoke",
      machineId,
      requestId,
      invocation,
      timestamp: Date.now()
    } satisfies JourneyDevtoolsExtensionEnvelope
  });

export const createRegisterEnvelope = (): Extract<
  JourneyDevtoolsBridgeEnvelope,
  { kind: "register" }
> => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "register",
  machineId: "machine-1",
  timestamp: Date.now(),
  meta: {
    machineId: "machine-1",
    label: "Checkout",
    appName: "Store",
    mutationsEnabled: true,
    features: [
      {
        id: "core",
        label: "Core",
        description: null,
        operations: [
          {
            id: "core.goToNextStep",
            label: "goToNextStep",
            description: null,
            mutates: true,
            output: "snapshot",
            fields: []
          }
        ]
      }
    ]
  },
  snapshot: {
    currentStepId: "start",
    history: { timeline: ["start"], index: 0 },
    context: { count: 0 },
    visited: { start: true },
    status: "running",
    async: { isLoading: false, byStep: {} }
  }
});
