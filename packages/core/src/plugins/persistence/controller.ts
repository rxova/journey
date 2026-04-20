import type {
  JourneyPersistedState,
  JourneyPersistenceOptions,
  JourneyStorage,
  ResolvedPersistence
} from "../../types/persistence.types";
import type {
  JourneyJsonValue,
  JourneyJsonObject,
  JourneySnapshot,
  JourneySnapshotStateBase,
  JourneyStatus
} from "../../types/journey.types";
import {
  assertSerializableContext,
  buildInitialAsyncState,
  buildSnapshot,
  buildVisitedFromTimeline,
  isPlainObject,
  warnInDevelopment
} from "../../journey-machine/helpers";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const cloneForTransport = (value: unknown): unknown => {
  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return String(value);
  }
};

const isStatusValue = (value: unknown): value is JourneyStatus =>
  value === "idled" || value === "running" || value === "completed" || value === "terminated";

type PersistencePath = readonly string[];

const normalizePersistencePath = (
  path: unknown,
  optionName: "allowList" | "blockList"
): PersistencePath => {
  if (typeof path !== "string") {
    throw new Error(`Persistence ${optionName} entries must be strings.`);
  }

  const trimmedPath = path.trim();
  if (!trimmedPath) {
    throw new Error(`Persistence ${optionName} entries must not be empty.`);
  }

  if (
    trimmedPath.includes("[") ||
    trimmedPath.includes("]") ||
    trimmedPath.includes("*") ||
    trimmedPath.startsWith(".") ||
    trimmedPath.endsWith(".") ||
    trimmedPath.includes("..")
  ) {
    throw new Error(
      `Persistence ${optionName} entry "${trimmedPath}" must use exact dot-separated object keys.`
    );
  }

  const segments = trimmedPath.split(".");
  if (
    segments.some((segment) => !segment || segment.trim() !== segment || /^[0-9]+$/.test(segment))
  ) {
    throw new Error(
      `Persistence ${optionName} entry "${trimmedPath}" must use exact dot-separated object keys.`
    );
  }

  return segments;
};

const normalizePersistencePaths = (
  paths: unknown,
  optionName: "allowList" | "blockList"
): readonly PersistencePath[] | null => {
  if (paths === undefined) {
    return null;
  }

  if (!Array.isArray(paths)) {
    throw new Error(`Persistence ${optionName} must be an array of dot-separated strings.`);
  }

  const normalized = new Map<string, PersistencePath>();
  for (const path of paths) {
    const resolvedPath = normalizePersistencePath(path, optionName);
    normalized.set(resolvedPath.join("."), resolvedPath);
  }

  return [...normalized.values()];
};

const pathStartsWith = (path: readonly string[], prefix: readonly string[]): boolean =>
  prefix.length <= path.length && prefix.every((segment, index) => path[index] === segment);

const pathHasAncestorMatch = (
  candidates: readonly PersistencePath[],
  path: readonly string[]
): boolean => candidates.some((candidate) => pathStartsWith(path, candidate));

const pathHasDescendantMatch = (
  candidates: readonly PersistencePath[],
  path: readonly string[]
): boolean => candidates.some((candidate) => pathStartsWith(candidate, path));

const filterContextValue = (
  value: unknown,
  allowList: readonly PersistencePath[] | null,
  blockList: readonly PersistencePath[],
  path: readonly string[] = []
): { value: unknown; changed: boolean; included: boolean } => {
  if (pathHasAncestorMatch(blockList, path)) {
    return { value: undefined, changed: true, included: false };
  }

  const allowAll = allowList === null;
  const pathIsAllowed = allowAll || pathHasAncestorMatch(allowList, path);
  const pathHasAllowedDescendants = allowAll || pathHasDescendantMatch(allowList, path);

  if (!pathIsAllowed && !pathHasAllowedDescendants) {
    return { value: undefined, changed: true, included: false };
  }

  if (!isPlainObject(value)) {
    return {
      value,
      changed: !pathIsAllowed,
      included: pathIsAllowed
    };
  }

  let changed = false;
  const nextValue: Record<string, unknown> = {};

  for (const [key, childValue] of Object.entries(value)) {
    const result = filterContextValue(childValue, allowList, blockList, [...path, key]);
    if (!result.included) {
      changed = true;
      continue;
    }

    nextValue[key] = result.value;
    if (result.changed) {
      changed = true;
    }
  }

  return {
    value: nextValue,
    changed: changed || Object.keys(nextValue).length !== Object.keys(value).length,
    included: true
  };
};

const mergePersistedValue = (
  initialValue: JourneyJsonValue | undefined,
  persistedValue: unknown
): JourneyJsonValue => {
  if (isPlainObject(initialValue) && isPlainObject(persistedValue)) {
    const mergedEntries = new Map<string, JourneyJsonValue>();

    for (const [key, value] of Object.entries(initialValue)) {
      mergedEntries.set(key, value as JourneyJsonValue);
    }

    for (const [key, value] of Object.entries(persistedValue)) {
      mergedEntries.set(
        key,
        mergePersistedValue(initialValue[key] as JourneyJsonValue | undefined, value)
      );
    }

    return Object.fromEntries(mergedEntries) as JourneyJsonValue;
  }

  return persistedValue === undefined
    ? (initialValue ?? null)
    : (persistedValue as JourneyJsonValue);
};

const mergePersistedContext = <TContext extends JourneyJsonObject>(
  initialContext: TContext,
  persistedContext: unknown
): TContext => mergePersistedValue(initialContext, persistedContext) as TContext;

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

const reportPersistenceError = (error: unknown, onError?: (error: unknown) => void) => {
  if (onError) {
    onError(error);
    return;
  }

  warnInDevelopment("Journey persistence encountered an error without an onError handler.", error);
};

const resolvePersistence = <TContext extends JourneyJsonObject, TStepId extends string>(
  options?: JourneyPersistenceOptions<TContext, TStepId>
): ResolvedPersistence<TContext, TStepId> | null => {
  if (!options) {
    return null;
  }

  let storage: JourneyStorage | null | undefined = options.storage;
  if (storage == null) {
    try {
      storage = resolveDefaultStorage();
    } catch (error) {
      reportPersistenceError(error, options.onError);
      return null;
    }
  }

  if (!storage) {
    return null;
  }

  let allowList: readonly string[] | undefined;
  let blockList: readonly string[];

  try {
    const normalizedAllowList = normalizePersistencePaths(options.allowList, "allowList");
    const normalizedBlockList = normalizePersistencePaths(options.blockList, "blockList");

    allowList = normalizedAllowList ? normalizedAllowList.map((path) => path.join(".")) : undefined;
    blockList = normalizedBlockList ? normalizedBlockList.map((path) => path.join(".")) : [];
  } catch (error) {
    reportPersistenceError(error, options.onError);
    return null;
  }

  return {
    key: options.key,
    storage,
    version: options.version ?? 1,
    clearOnReset: options.clearOnReset ?? true,
    ...(allowList ? { allowList } : {}),
    blockList,
    serialize: options.serialize ?? JSON.stringify,
    deserialize: options.deserialize ?? JSON.parse,
    ...(options.migrate ? { migrate: options.migrate } : {}),
    ...(options.onError ? { onError: options.onError } : {})
  };
};

const resolveVisitedFromPersistence = <TStepId extends string>(
  visitedSource: unknown,
  timeline: readonly TStepId[],
  stepIds: readonly TStepId[]
): {
  visited: Record<TStepId, boolean>;
  needsRewrite: boolean;
} => {
  const visitedFromTimeline = buildVisitedFromTimeline(timeline, stepIds);

  if (isRecord(visitedSource)) {
    let needsRewrite = false;
    const visited = { ...visitedFromTimeline };

    for (const stepId of stepIds) {
      const persistedValue = visitedSource[stepId];

      if (persistedValue === true) {
        visited[stepId] = true;
        continue;
      }

      if (persistedValue === false) {
        if (visitedFromTimeline[stepId]) {
          needsRewrite = true;
        }
        continue;
      }

      needsRewrite = true;
    }

    return { visited, needsRewrite };
  }

  if (Array.isArray(visitedSource)) {
    const visitedFromArray = buildVisitedFromTimeline(
      visitedSource.filter(
        (step): step is TStepId => typeof step === "string" && stepIds.includes(step as TStepId)
      ) as TStepId[],
      stepIds
    );
    const visited = Object.fromEntries(
      stepIds.map((stepId) => [stepId, visitedFromTimeline[stepId] || visitedFromArray[stepId]])
    ) as Record<TStepId, boolean>;

    return { visited, needsRewrite: true };
  }

  return { visited: visitedFromTimeline, needsRewrite: true };
};

const coercePersistedSnapshot = <TContext extends JourneyJsonObject, TStepId extends string>(
  value: unknown,
  steps: Record<TStepId, unknown>,
  fallbackContext: TContext
): {
  snapshot: JourneySnapshotStateBase<TContext, TStepId>;
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

  const status = isStatusValue(value.status) ? value.status : "idled";
  if (!isStatusValue(value.status)) {
    needsRewrite = true;
  }

  const stepIds = Object.keys(steps) as TStepId[];
  const { visited, needsRewrite: visitedNeedsRewrite } = resolveVisitedFromPersistence(
    value.visited,
    timeline,
    stepIds
  );
  if (visitedNeedsRewrite) {
    needsRewrite = true;
  }

  return {
    snapshot: {
      currentStepId: timeline[index] as TStepId,
      history: {
        timeline,
        index
      },
      context: assertSerializableContext(
        ("context" in value ? value.context : fallbackContext) as TContext,
        "Persisted journey context"
      ),
      status,
      visited
    },
    needsRewrite
  };
};

/**
 * Creates a persistence controller for snapshots, including hydration,
 * serialization, and storage error handling.
 */
export const createPersistenceController = <
  TContext extends JourneyJsonObject,
  TStepId extends string
>(args: {
  initial: TStepId;
  context: TContext;
  steps: Record<TStepId, unknown>;
  options?: JourneyPersistenceOptions<TContext, TStepId>;
}) => {
  const { initial, context, steps, options } = args;
  const persistence = resolvePersistence(options);
  const allowList = persistence?.allowList
    ? persistence.allowList.map((path) => path.split("."))
    : null;
  const blockList = persistence ? persistence.blockList.map((path) => path.split(".")) : [];

  let lastError: unknown;

  const reportResolvedPersistenceError = (error: unknown) => {
    lastError = error;
    reportPersistenceError(error, persistence?.onError);
  };

  const filterPersistedContext = (value: TContext): { context: TContext; changed: boolean } => {
    if (!persistence || (allowList === null && blockList.length === 0)) {
      return { context: value, changed: false };
    }

    if (!isPlainObject(value)) {
      return { context: value, changed: false };
    }

    const filtered = filterContextValue(value, allowList, blockList);
    const filteredContext =
      filtered.included && isPlainObject(filtered.value) ? filtered.value : {};

    return {
      context: filteredContext as TContext,
      changed: filtered.changed
    };
  };

  const persistSnapshot = (snapshot: JourneySnapshot<TContext, TStepId>) => {
    if (!persistence) {
      return;
    }

    try {
      const { context: persistedContext } = filterPersistedContext(snapshot.context);
      const persistedState: JourneyPersistedState<TContext, TStepId> = {
        version: persistence.version,
        snapshot: {
          currentStepId: snapshot.currentStepId,
          history: {
            timeline: [...snapshot.history.timeline],
            index: snapshot.history.index
          },
          context: persistedContext,
          status: snapshot.status,
          visited: { ...snapshot.visited }
        }
      };
      persistence.storage.setItem(persistence.key, persistence.serialize(persistedState));
    } catch (error) {
      reportResolvedPersistenceError(error);
    }
  };

  const removePersistedSnapshot = () => {
    if (!persistence) {
      return;
    }

    try {
      persistence.storage.removeItem(persistence.key);
    } catch (error) {
      reportResolvedPersistenceError(error);
    }
  };

  const inspectPersistedState = () => {
    if (!persistence) {
      return {
        enabled: false as const,
        key: null,
        version: null,
        clearOnReset: null,
        allowList: [],
        blockList: [],
        hasStoredValue: false,
        storedValue: null,
        lastError
      };
    }

    try {
      const rawPersisted = persistence.storage.getItem(persistence.key);
      return {
        enabled: true as const,
        key: persistence.key,
        version: persistence.version,
        clearOnReset: persistence.clearOnReset,
        allowList: persistence.allowList ?? [],
        blockList: persistence.blockList,
        hasStoredValue: rawPersisted !== null,
        storedValue:
          rawPersisted === null ? null : cloneForTransport(persistence.deserialize(rawPersisted)),
        lastError
      };
    } catch (error) {
      reportResolvedPersistenceError(error);
      return {
        enabled: true as const,
        key: persistence.key,
        version: persistence.version,
        clearOnReset: persistence.clearOnReset,
        allowList: persistence.allowList ?? [],
        blockList: persistence.blockList,
        hasStoredValue: false,
        storedValue: null,
        lastError
      };
    }
  };

  const buildBaseSnapshot = () =>
    buildSnapshot([initial], 0, context, "idled", buildInitialAsyncState(steps));
  const hydrateSnapshot = (
    baseSnapshot: JourneySnapshot<TContext, TStepId> = buildBaseSnapshot()
  ): JourneySnapshot<TContext, TStepId> => {
    const resolvedBaseSnapshot = buildSnapshot(
      baseSnapshot.history.timeline,
      baseSnapshot.history.index,
      baseSnapshot.context,
      baseSnapshot.status,
      baseSnapshot.async,
      baseSnapshot.visited
    );
    if (!persistence) {
      return resolvedBaseSnapshot;
    }

    try {
      const rawPersisted = persistence.storage.getItem(persistence.key);
      if (!rawPersisted) {
        return resolvedBaseSnapshot;
      }

      const parsed = persistence.deserialize(rawPersisted);
      if (!isRecord(parsed)) {
        return resolvedBaseSnapshot;
      }

      const persistedVersion = parsed.version;
      if (typeof persistedVersion !== "number") {
        return resolvedBaseSnapshot;
      }

      let persistedSnapshot: JourneySnapshotStateBase<TContext, TStepId> | null = null;
      let shouldRewritePersisted = false;

      if (persistedVersion === persistence.version) {
        const coerced = coercePersistedSnapshot(parsed.snapshot, steps, context);
        persistedSnapshot = coerced?.snapshot ?? null;
        shouldRewritePersisted = Boolean(coerced?.needsRewrite);
      } else if (persistence.migrate) {
        const migrated = persistence.migrate(parsed.snapshot, persistedVersion);
        const coerced = coercePersistedSnapshot(migrated, steps, context);
        persistedSnapshot = coerced?.snapshot ?? null;
        shouldRewritePersisted = persistedSnapshot !== null;

        if (!persistedSnapshot) {
          reportResolvedPersistenceError(
            new Error(
              "Journey persistence migrate() returned data that could not be coerced into a valid snapshot. " +
                `Falling back to the initial snapshot (persisted version: ${persistedVersion}, current version: ${persistence.version}).`
            )
          );
        }
      }

      if (!persistedSnapshot) {
        return resolvedBaseSnapshot;
      }

      const { context: filteredContext, changed: contextWasFiltered } = filterPersistedContext(
        persistedSnapshot.context
      );
      const hydratedContext = mergePersistedContext(resolvedBaseSnapshot.context, filteredContext);

      const hydratedSnapshot = buildSnapshot(
        persistedSnapshot.history.timeline,
        persistedSnapshot.history.index,
        assertSerializableContext(hydratedContext, "Hydrated journey context"),
        persistedSnapshot.status === "running" ? "idled" : persistedSnapshot.status,
        resolvedBaseSnapshot.async,
        persistedSnapshot.visited
      );

      if (shouldRewritePersisted || contextWasFiltered) {
        persistSnapshot(hydratedSnapshot);
      }

      return hydratedSnapshot;
    } catch (error) {
      reportResolvedPersistenceError(error);
      return resolvedBaseSnapshot;
    }
  };

  return {
    clearOnReset: persistence?.clearOnReset ?? true,
    hydrateSnapshot,
    persistSnapshot,
    removePersistedSnapshot,
    inspectPersistedState
  };
};
