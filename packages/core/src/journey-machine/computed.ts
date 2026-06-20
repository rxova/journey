import { memoizeByIdentity } from "@rxova/journey-common/memoize";

import type {
  JourneyComputed,
  JourneyDefinition,
  JourneyJsonObject,
  JourneyLinearTransitions,
  JourneyMode,
  JourneyResolvedDefinition,
  JourneySnapshot
} from "../types";

const resolveLinearStepOrder = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>
>(
  transitions: JourneyLinearTransitions<TContext, TStepId, TEventMap, THandlers>
): readonly TStepId[] =>
  transitions.map((entry) =>
    typeof entry === "string" ? entry : entry.step
  ) as readonly TStepId[];

const countVisitedSteps = <TStepId extends string>(visited: Record<TStepId, boolean>): number => {
  let count = 0;
  for (const stepId in visited) {
    if (visited[stepId]) {
      count += 1;
    }
  }
  return count;
};

export const createJourneyMachineComputedGetter = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TStepMeta,
  THandlers extends Record<string, unknown>
>(
  journey: JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>,
  resolvedJourney: JourneyResolvedDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>,
  getSnapshot: () => JourneySnapshot<TContext, TStepId>
): (() => JourneyComputed<TStepId>) => {
  const mode: JourneyMode =
    journey.transitions === undefined
      ? "headless"
      : Array.isArray(journey.transitions)
        ? "linear"
        : "graph";
  const linearStepOrder =
    mode === "linear"
      ? resolveLinearStepOrder(
          journey.transitions as JourneyLinearTransitions<
            TContext,
            TStepId,
            Record<never, never>,
            THandlers
          >
        )
      : null;

  const compute = (snapshot: JourneySnapshot<TContext, TStepId>): JourneyComputed<TStepId> => {
    const activeStepIndex = snapshot.history.index;
    const base = {
      activeStepId: snapshot.currentStepId,
      activeStepIndex,
      visitedStepCount: countVisitedSteps(snapshot.visited),
      isLoading: snapshot.async.isLoading,
      isIdle: snapshot.status === "idled",
      isRunning: snapshot.status === "running",
      isComplete: snapshot.status === "completed",
      isTerminated: snapshot.status === "terminated",
      isInitialStep: snapshot.currentStepId === resolvedJourney.initial
    } as const;

    if (mode === "linear" && linearStepOrder !== null) {
      const stepCount = linearStepOrder.length;
      const linearIndex = linearStepOrder.indexOf(snapshot.currentStepId);

      return {
        ...base,
        activeStepIndex: linearIndex === -1 ? activeStepIndex : linearIndex,
        mode: "linear",
        stepCount,
        journeyLength: stepCount,
        isFirstStep: linearIndex === 0,
        isLastStep: linearIndex === stepCount - 1,
        stepOrder: linearStepOrder
      };
    }

    if (mode === "graph") {
      return {
        ...base,
        mode: "graph"
      };
    }

    return {
      ...base,
      mode: "headless"
    };
  };

  const getComputedForSnapshot = memoizeByIdentity((snapshot: JourneySnapshot<TContext, TStepId>) =>
    Object.freeze(compute(snapshot))
  );

  return () => getComputedForSnapshot(getSnapshot());
};
