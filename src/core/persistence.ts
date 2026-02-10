import { JOURNEY_STATUS } from "./types";
import type {
  JourneyMachineOptions,
  JourneyPersistedSnapshot,
  JourneyPersistedState,
  JourneyStatus,
  JourneySnapshot,
  JourneyStorage
} from "./types";
import { buildInitialAsyncState, buildSnapshot } from "./machine-helpers";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isStatusValue = (value: unknown): value is JourneyStatus =>
  value === JOURNEY_STATUS.RUNNING ||
  value === JOURNEY_STATUS.COMPLETE ||
  value === JOURNEY_STATUS.CLOSED;

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

type ResolvedPersistence<TContext, TStepId extends string> = {
  key: string;
  storage: JourneyStorage;
  version: number;
  clearOnReset: boolean;
  serialize: (value: JourneyPersistedState<TContext, TStepId>) => string;
  deserialize: (value: string) => unknown;
  migrate?: (
    value: unknown,
    persistedVersion: number
  ) => JourneyPersistedSnapshot<TContext, TStepId>;
  onError?: (error: unknown) => void;
};

const resolvePersistence = <TContext, TStepId extends string>(
  options?: JourneyMachineOptions<TContext, TStepId>["persistence"]
): ResolvedPersistence<TContext, TStepId> | null => {
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

const coercePersistedSnapshot = <TContext, TStepId extends string>(
  value: unknown,
  steps: Record<TStepId, unknown>,
  fallbackContext: TContext
): JourneyPersistedSnapshot<TContext, TStepId> | null => {
  if (!isRecord(value)) {
    return null;
  }

  const currentValue = value.current;
  if (typeof currentValue !== "string" || !(currentValue in steps)) {
    return null;
  }
  const current = currentValue as TStepId;

  const history = Array.isArray(value.history)
    ? (value.history.filter(
        (step): step is TStepId => typeof step === "string" && step in steps
      ) as TStepId[])
    : [];

  const status = isStatusValue(value.status) ? value.status : JOURNEY_STATUS.RUNNING;

  return {
    current,
    context: ("context" in value ? value.context : fallbackContext) as TContext,
    history,
    status
  };
};

export const createPersistenceController = <TContext, TStepId extends string>(args: {
  initial: TStepId;
  context: TContext;
  steps: Record<TStepId, unknown>;
  options?: JourneyMachineOptions<TContext, TStepId>;
}) => {
  const { initial, context, steps, options } = args;
  const persistence = resolvePersistence(options?.persistence);

  const reportPersistenceError = (error: unknown) => {
    persistence?.onError?.(error);
  };

  const persistSnapshot = (snapshot: JourneySnapshot<TContext, TStepId>) => {
    if (!persistence) {
      return;
    }

    try {
      const persistedState: JourneyPersistedState<TContext, TStepId> = {
        version: persistence.version,
        snapshot: {
          current: snapshot.current,
          context: snapshot.context,
          history: [...snapshot.history],
          status: snapshot.status
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

  const hydrateSnapshot = (): JourneySnapshot<TContext, TStepId> => {
    const initialSnapshot = buildSnapshot(
      initial,
      context,
      [],
      JOURNEY_STATUS.RUNNING,
      buildInitialAsyncState(steps)
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

      let persistedSnapshot: JourneyPersistedSnapshot<TContext, TStepId> | null = null;
      let shouldRewritePersisted = false;

      if (persistedVersion === persistence.version) {
        persistedSnapshot = coercePersistedSnapshot(parsed.snapshot, steps, context);
      } else if (persistence.migrate) {
        const migrated = persistence.migrate(parsed.snapshot, persistedVersion);
        persistedSnapshot = coercePersistedSnapshot(migrated, steps, context);
        shouldRewritePersisted = persistedSnapshot !== null;
      }

      if (!persistedSnapshot) {
        return initialSnapshot;
      }

      const hydratedSnapshot = buildSnapshot(
        persistedSnapshot.current,
        persistedSnapshot.context,
        persistedSnapshot.history,
        persistedSnapshot.status,
        buildInitialAsyncState(steps)
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
