import { JOURNEY_STATUS } from "./types/journey.types";
import type {
  JourneyPersistedSnapshot,
  JourneyPersistedState,
  JourneyStorage,
  ResolvedPersistence
} from "./types/persistence.types";
import type { JourneyMachineOptions, JourneySnapshot, JourneyStatus } from "./types/journey.types";
import { buildInitialAsyncState, buildSnapshot, buildVisitedFromTimeline } from "./machine-helpers";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isStatusValue = (value: unknown): value is JourneyStatus =>
  value === JOURNEY_STATUS.RUNNING ||
  value === JOURNEY_STATUS.COMPLETE ||
  value === JOURNEY_STATUS.TERMINATED;

const resolveDefaultStorage = (): JourneyStorage | null => {
  const localStorageCandidate = (globalThis as { localStorage?: Partial<JourneyStorage> })
    .localStorage;

  if (
    !localStorageCandidate ||
    typeof localStorageCandidate.getItem !== "function" ||
    typeof localStorageCandidate.setItem !== "function" ||
    typeof localStorageCandidate.removeItem !== "function"
  ) {
    return null;
  }

  return localStorageCandidate as JourneyStorage;
};

const resolvePersistence = <TContext, TStepId extends string, TStepMeta>(
  options?: JourneyMachineOptions<TContext, TStepId, TStepMeta>["persistence"]
): ResolvedPersistence<TContext, TStepId, TStepMeta> | null => {
  if (!options) {
    return null;
  }

  const storage = options.storage ?? resolveDefaultStorage();
  if (!storage) {
    return null;
  }

  return {
    key: options.key,
    storage,
    version: options.version ?? 1,
    clearOnReset: options.clearOnReset ?? true,
    serialize: options.serialize ?? JSON.stringify,
    deserialize: options.deserialize ?? JSON.parse,
    ...(options.migrate ? { migrate: options.migrate } : {}),
    ...(options.onError ? { onError: options.onError } : {})
  };
};

const coercePersistedSnapshot = <TContext, TStepId extends string, TStepMeta>(
  value: unknown,
  steps: Record<TStepId, unknown>,
  fallbackContext: TContext,
  fallbackStepMeta: Record<TStepId, TStepMeta>
): {
  snapshot: JourneyPersistedSnapshot<TContext, TStepId, TStepMeta>;
  needsRewrite: boolean;
} | null => {
  if (!isRecord(value)) {
    return null;
  }

  let needsRewrite = false;

  const rawHistory = isRecord(value.history) ? value.history : null;
  if (!rawHistory) {
    needsRewrite = true;
  }

  const rawTimeline = rawHistory?.timeline ?? value.timeline;
  const timeline = Array.isArray(rawTimeline)
    ? (rawTimeline.filter(
        (step): step is TStepId => typeof step === "string" && step in steps
      ) as TStepId[])
    : [];

  const currentStepIdValue =
    typeof value.currentStepId === "string" && value.currentStepId in steps
      ? (value.currentStepId as TStepId)
      : typeof value.current === "string" && value.current in steps
        ? (value.current as TStepId)
        : null;

  if (timeline.length === 0) {
    if (!currentStepIdValue) {
      return null;
    }
    timeline.push(currentStepIdValue);
    needsRewrite = true;
  }

  let index = timeline.length - 1;
  const rawIndex = rawHistory?.index ?? value.index;
  if (typeof rawIndex === "number" && Number.isFinite(rawIndex)) {
    index = Math.max(0, Math.min(Math.trunc(rawIndex), timeline.length - 1));
    if (index !== rawIndex) {
      needsRewrite = true;
    }
  } else if (currentStepIdValue) {
    const inferredIndex = timeline.lastIndexOf(currentStepIdValue);
    if (inferredIndex >= 0) {
      index = inferredIndex;
      needsRewrite = true;
    }
  }

  const status = isStatusValue(value.status) ? value.status : JOURNEY_STATUS.RUNNING;
  if (!isStatusValue(value.status)) {
    needsRewrite = true;
  }

  const stepIds = Object.keys(steps) as TStepId[];
  const visitedSource = value.visited;
  const visitedFromRecord = isRecord(visitedSource)
    ? (Object.fromEntries(
        stepIds.map((stepId) => [stepId, visitedSource[stepId] === true])
      ) as Record<TStepId, boolean>)
    : null;
  const visitedFromArray = Array.isArray(visitedSource)
    ? buildVisitedFromTimeline(
        visitedSource.filter(
          (step): step is TStepId => typeof step === "string" && step in steps
        ) as TStepId[],
        stepIds
      )
    : null;

  let visited = buildVisitedFromTimeline(timeline, stepIds);
  if (visitedFromRecord) {
    const visitedRecord = visitedSource as Record<string, unknown>;
    visited = visitedFromRecord;
    const hasMissingOrInvalidStep = stepIds.some(
      (stepId) => typeof visitedRecord[stepId] !== "boolean"
    );
    if (hasMissingOrInvalidStep) {
      needsRewrite = true;
    }
  } else if (visitedFromArray) {
    visited = visitedFromArray;
    needsRewrite = true;
  } else {
    needsRewrite = true;
  }

  const rawStepMeta = isRecord(value.stepMeta) ? value.stepMeta : null;
  if (!rawStepMeta) {
    needsRewrite = true;
  }

  const stepMeta = Object.fromEntries(
    Object.keys(steps).map((stepId) => {
      const typedStepId = stepId as TStepId;
      const rawValue = rawStepMeta ? rawStepMeta[stepId] : undefined;
      if (rawValue === undefined) {
        return [typedStepId, fallbackStepMeta[typedStepId]];
      }
      return [typedStepId, rawValue as TStepMeta];
    })
  ) as Record<TStepId, TStepMeta>;

  return {
    snapshot: {
      currentStepId: timeline[index] as TStepId,
      history: {
        timeline,
        index
      },
      context: ("context" in value ? value.context : fallbackContext) as TContext,
      status,
      visited,
      stepMeta
    },
    needsRewrite
  };
};

/**
 * Creates a persistence controller for snapshots, including hydration,
 * serialization, and storage error handling.
 */
export const createPersistenceController = <TContext, TStepId extends string, TStepMeta>(args: {
  initial: TStepId;
  context: TContext;
  stepMeta: Record<TStepId, TStepMeta>;
  steps: Record<TStepId, unknown>;
  options?: JourneyMachineOptions<TContext, TStepId, TStepMeta>;
}) => {
  const { initial, context, stepMeta, steps, options } = args;
  const persistence = resolvePersistence(options?.persistence);

  const reportPersistenceError = (error: unknown) => {
    persistence?.onError?.(error);
  };

  const persistSnapshot = (snapshot: JourneySnapshot<TContext, TStepId, TStepMeta>) => {
    if (!persistence) {
      return;
    }

    try {
      const persistedState: JourneyPersistedState<TContext, TStepId, TStepMeta> = {
        version: persistence.version,
        snapshot: {
          currentStepId: snapshot.currentStepId,
          history: {
            timeline: [...snapshot.history.timeline],
            index: snapshot.history.index
          },
          context: snapshot.context,
          status: snapshot.status,
          visited: { ...snapshot.visited },
          stepMeta: { ...snapshot.stepMeta }
        }
      };
      persistence.storage.setItem(persistence.key, persistence.serialize(persistedState));
    } catch (error) {
      reportPersistenceError(error);
    }
  };

  const removePersistedSnapshot = () => {
    if (!persistence) {
      return;
    }

    try {
      persistence.storage.removeItem(persistence.key);
    } catch (error) {
      reportPersistenceError(error);
    }
  };

  const hydrateSnapshot = (): JourneySnapshot<TContext, TStepId, TStepMeta> => {
    const initialSnapshot = buildSnapshot(
      [initial],
      0,
      context,
      JOURNEY_STATUS.RUNNING,
      buildInitialAsyncState(steps),
      stepMeta
    );
    if (!persistence) {
      return initialSnapshot;
    }

    try {
      const rawPersisted = persistence.storage.getItem(persistence.key);
      if (!rawPersisted) {
        return initialSnapshot;
      }

      const parsed = persistence.deserialize(rawPersisted);
      if (!isRecord(parsed)) {
        return initialSnapshot;
      }

      const persistedVersion = parsed.version;
      if (typeof persistedVersion !== "number") {
        return initialSnapshot;
      }

      let persistedSnapshot: JourneyPersistedSnapshot<TContext, TStepId, TStepMeta> | null = null;
      let shouldRewritePersisted = false;

      if (persistedVersion === persistence.version) {
        const coerced = coercePersistedSnapshot(parsed.snapshot, steps, context, stepMeta);
        persistedSnapshot = coerced?.snapshot ?? null;
        shouldRewritePersisted = Boolean(coerced?.needsRewrite);
      } else if (persistence.migrate) {
        const migrated = persistence.migrate(parsed.snapshot, persistedVersion);
        const coerced = coercePersistedSnapshot(migrated, steps, context, stepMeta);
        persistedSnapshot = coerced?.snapshot ?? null;
        shouldRewritePersisted = persistedSnapshot !== null;
      }

      if (!persistedSnapshot) {
        return initialSnapshot;
      }

      const hydratedSnapshot = buildSnapshot(
        persistedSnapshot.history.timeline,
        persistedSnapshot.history.index,
        persistedSnapshot.context,
        persistedSnapshot.status,
        buildInitialAsyncState(steps),
        persistedSnapshot.stepMeta,
        persistedSnapshot.visited
      );

      if (shouldRewritePersisted) {
        persistSnapshot(hydratedSnapshot);
      }

      return hydratedSnapshot;
    } catch (error) {
      reportPersistenceError(error);
      return initialSnapshot;
    }
  };

  return {
    clearOnReset: persistence?.clearOnReset ?? true,
    hydrateSnapshot,
    persistSnapshot,
    removePersistedSnapshot
  };
};
