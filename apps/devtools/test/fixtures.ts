import type { JourneyDevtoolsSerializableSnapshot } from "@rxova/journey-devtools-bridge";

type GraphSnapshotOptions = {
  context?: unknown;
  status?: JourneyDevtoolsSerializableSnapshot["status"];
  timeline?: readonly string[];
  availableEvents?: readonly string[];
  availableSteps?: readonly string[];
};

export const createGraphSnapshot = (
  currentStepId: string | null,
  options: GraphSnapshotOptions = {}
): JourneyDevtoolsSerializableSnapshot => {
  const status = options.status ?? "running";
  const timeline = options.timeline ?? (currentStepId === null ? [] : [currentStepId]);
  const visited = Object.fromEntries(timeline.map((stepId) => [stepId, true]));

  return {
    type: "graph",
    status,
    context: options.context ?? {},
    transition: { pending: false, phase: null, from: null, to: null },
    history: {
      timeline,
      currentIndex: timeline.length - 1,
      visited,
      canGoBack: timeline.length > 1,
      canGoForward: false
    },
    outcome: null,
    machine: {
      isLoading: false,
      isIdle: status === "idle",
      isRunning: status === "running",
      isPaused: status === "paused",
      isCompleted: status === "completed",
      isTerminated: status === "terminated"
    },
    plugins: {},
    currentStep:
      currentStepId === null
        ? null
        : {
            id: currentStepId,
            metadata: null,
            isFirstTimeVisit: true,
            async: { isLoading: false, isSuccess: true, isError: false, error: null },
            isTerminal: false
          },
    steps: { totalSteps: new Set(timeline).size, visitedStepCount: new Set(timeline).size },
    availableEvents: options.availableEvents ?? [],
    availableSteps: options.availableSteps ?? []
  };
};
