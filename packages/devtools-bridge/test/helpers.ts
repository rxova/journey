import type {
  JourneyComputed,
  JourneyExecutionPathsResult,
  JourneyMachine,
  JourneyObservationEvent,
  JourneySnapshot
} from "@rxova/journey-core";
import {
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  isJourneyDevtoolsBridgeEnvelope,
  type JourneyDevtoolsBridgeEnvelope,
  type JourneyDevtoolsExtensionEnvelope
} from "@rxova/journey-devtools-bridge";

export type TestStepId = "start" | "review" | "guard" | "handler";
export type TestEventMap = {
  custom: { amount: number };
  resolve: unknown;
  reject: unknown;
};
export type TestContext = {
  count: number;
  label?: string | null;
};
export type TestStepMeta = { title: string };
export type TestSnapshot = JourneySnapshot<TestContext, TestStepId>;

const stepMeta: Record<TestStepId, TestStepMeta> = {
  start: { title: "Start" },
  review: { title: "Review" },
  guard: { title: "Guard" },
  handler: { title: "Handler" }
};

export const createTestSnapshot = (
  currentStepId: TestStepId = "start",
  index = currentStepId === "start" ? 0 : 1,
  overrides: Partial<TestSnapshot> = {}
): TestSnapshot => ({
  currentStepId,
  history: {
    timeline: index === 0 ? ["start"] : ["start", currentStepId],
    index
  },
  context: { count: index },
  visited: {
    start: true,
    review: currentStepId === "review",
    guard: currentStepId === "guard",
    handler: currentStepId === "handler"
  },
  status: "running",
  async: {
    isLoading: false,
    byStep: {
      start: { phase: "idle", eventType: null, transitionId: null, error: null },
      review: { phase: "idle", eventType: null, transitionId: null, error: null },
      guard: { phase: "idle", eventType: null, transitionId: null, error: null },
      handler: { phase: "idle", eventType: null, transitionId: null, error: null }
    }
  },
  ...overrides
});

export const createComputed = (snapshot: TestSnapshot): JourneyComputed<TestStepId> => ({
  mode: "graph",
  activeStepId: snapshot.currentStepId,
  activeStepIndex: snapshot.history.index,
  visitedStepCount: Object.values(snapshot.visited).filter(Boolean).length,
  isLoading: snapshot.async.isLoading,
  isIdle: snapshot.status === "idled",
  isRunning: snapshot.status === "running",
  isComplete: snapshot.status === "completed",
  isTerminated: snapshot.status === "terminated",
  isInitialStep: snapshot.currentStepId === "start"
});

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

export const buildCommandEnvelope = (
  machineId: string,
  requestId: string,
  command: JourneyDevtoolsExtensionEnvelope["command"],
  origin = window.location.origin
) =>
  new MessageEvent("message", {
    source: window,
    origin,
    data: {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
      kind: "command",
      machineId,
      requestId,
      command,
      timestamp: Date.now()
    } satisfies JourneyDevtoolsExtensionEnvelope
  });

export type TestMachine = JourneyMachine<TestContext, TestStepId, TestEventMap, TestStepMeta> & {
  emitObservation: (event: JourneyObservationEvent<TestStepId, TestEventMap>) => void;
  setSnapshot: (snapshot: TestSnapshot) => void;
  notify: () => void;
  getExecutionPaths?: (options?: {
    maxDepth?: number;
    maxPaths?: number;
  }) => JourneyExecutionPathsResult<TestStepId, string>;
};

export const createTestMachine = ({
  initialSnapshot = createTestSnapshot(),
  sendImpl,
  executionPaths
}: {
  initialSnapshot?: TestSnapshot;
  sendImpl?: JourneyMachine<TestContext, TestStepId, TestEventMap, TestStepMeta>["send"];
  executionPaths?: JourneyExecutionPathsResult<TestStepId, string>;
} = {}): TestMachine => {
  let snapshot = initialSnapshot;
  const snapshotListeners = new Set<() => void>();
  const observationListeners = new Set<
    (event: JourneyObservationEvent<TestStepId, TestEventMap>) => void
  >();

  const notify = () => {
    snapshotListeners.forEach((listener) => listener());
  };

  const emitObservation = (event: JourneyObservationEvent<TestStepId, TestEventMap>) => {
    observationListeners.forEach((listener) => listener(event));
  };

  const transitionTo = (
    nextStepId: TestStepId,
    transitionId: string
  ): { transitioned: true; snapshot: TestSnapshot; transitionId: string } => {
    snapshot = createTestSnapshot(nextStepId, nextStepId === "start" ? 0 : 1, {
      context: { ...snapshot.context, count: nextStepId === "start" ? 0 : 1 }
    });
    notify();
    return { transitioned: true, snapshot, transitionId };
  };

  const machine: TestMachine = {
    getSnapshot: () => snapshot,
    getStepMeta: (stepId) => stepMeta[stepId],
    getComputed: () => createComputed(snapshot),
    start: async () => snapshot,
    send:
      sendImpl ??
      (async (event) => {
        switch (event.type) {
          case "goToNextStep":
            return transitionTo("review", "goToNextStep");
          case "goToStepById":
            return transitionTo(event.stepId, "goToStepById");
          case "completeJourney":
            snapshot = { ...snapshot, status: "completed" };
            notify();
            return { transitioned: true, snapshot, transitionId: "completeJourney" };
          case "terminateJourney":
            snapshot = { ...snapshot, status: "terminated" };
            notify();
            return { transitioned: true, snapshot, transitionId: "terminateJourney" };
          case "custom":
            snapshot = {
              ...snapshot,
              context: {
                ...snapshot.context,
                count: snapshot.context.count + (event.payload?.amount ?? 0)
              }
            };
            notify();
            return { transitioned: true, snapshot, transitionId: "custom" };
          default:
            return { transitioned: false, snapshot };
        }
      }),
    goToNextStep: async () => transitionTo("review", "goToNextStep"),
    goToStepById: async (stepId) => transitionTo(stepId, "goToStepById"),
    terminateJourney: async () => {
      snapshot = { ...snapshot, status: "terminated" };
      notify();
      return { transitioned: true, snapshot, transitionId: "terminateJourney" };
    },
    completeJourney: async () => {
      snapshot = { ...snapshot, status: "completed" };
      notify();
      return { transitioned: true, snapshot, transitionId: "completeJourney" };
    },
    goToPreviousStep: async () => transitionTo("start", "goToPreviousStep"),
    goToLastVisitedStep: async () => transitionTo("review", "goToLastVisitedStep"),
    updateContext: async (updater) => {
      snapshot = { ...snapshot, context: updater(snapshot.context) };
      notify();
      return snapshot;
    },
    clearStepError: async () => snapshot,
    resetJourney: async () => {
      snapshot = createTestSnapshot("start", 0);
      notify();
      return snapshot;
    },
    dispose: () => undefined,
    subscribe: (listener) => {
      snapshotListeners.add(listener);
      return () => {
        snapshotListeners.delete(listener);
      };
    },
    subscribeSelector: () => () => undefined,
    subscribeEvent: (listener) => {
      observationListeners.add(listener);
      return () => {
        observationListeners.delete(listener);
      };
    },
    subscribeStart: (listener) =>
      machine.subscribeEvent((event) => {
        if (event.type === "journey.start") {
          listener(event);
        }
      }),
    subscribeComplete: (listener) =>
      machine.subscribeEvent((event) => {
        if (event.type === "journey.completed") {
          listener(event);
        }
      }),
    subscribeTerminate: (listener) =>
      machine.subscribeEvent((event) => {
        if (event.type === "journey.terminated") {
          listener(event);
        }
      }),
    emitObservation,
    setSnapshot: (nextSnapshot) => {
      snapshot = nextSnapshot;
    },
    notify
  };

  if (executionPaths) {
    machine.getExecutionPaths = () => executionPaths;
  }

  return machine;
};
