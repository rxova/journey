import type {
  JourneyJsonObject,
  JourneySnapshotState,
  JourneySnapshotStateBase
} from "./journey.types";

export type JourneyPersistedState<TContext extends JourneyJsonObject, TStepId extends string> = {
  version: number;
  /** Persisted snapshot state, carrying the `type` discriminator (async is dropped). */
  snapshot: JourneySnapshotState<TContext, TStepId>;
};

export type JourneyStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export type JourneyPersistenceOptions<
  TContext extends JourneyJsonObject,
  TStepId extends string
> = {
  key: string;
  storage?: JourneyStorage;
  version?: number;
  clearOnReset?: boolean;
  allowList?: readonly string[];
  blockList?: readonly string[];
  serialize?: (value: JourneyPersistedState<TContext, TStepId>) => string;
  deserialize?: (value: string) => unknown;
  migrate?: (
    value: unknown,
    persistedVersion: number
  ) => JourneySnapshotStateBase<TContext, TStepId>;
  onError?: (error: unknown) => void;
};

export type ResolvedPersistence<TContext extends JourneyJsonObject, TStepId extends string> = {
  key: string;
  storage: JourneyStorage;
  version: number;
  clearOnReset: boolean;
  allowList?: readonly string[];
  blockList: readonly string[];
  serialize: (value: JourneyPersistedState<TContext, TStepId>) => string;
  deserialize: (value: string) => unknown;
  migrate?: (
    value: unknown,
    persistedVersion: number
  ) => JourneySnapshotStateBase<TContext, TStepId>;
  onError?: (error: unknown) => void;
};
