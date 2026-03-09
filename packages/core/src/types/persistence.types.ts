import type { JourneyStatus } from "./journey.types";
import type { JourneyMachineOptions } from "./journey.types";

export type JourneyPersistedSnapshot<TContext, TStepId extends string, TStepMeta = unknown> = {
  currentStepId: TStepId;
  history: {
    timeline: readonly TStepId[];
    index: number;
  };
  context: TContext;
  status: JourneyStatus;
  visited: Record<TStepId, boolean>;
  stepMeta: Record<TStepId, TStepMeta>;
};

export type JourneyPersistedState<TContext, TStepId extends string, TStepMeta = unknown> = {
  version: number;
  snapshot: JourneyPersistedSnapshot<TContext, TStepId, TStepMeta>;
};

export type JourneyStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export type JourneyPersistenceOptions<TContext, TStepId extends string, TStepMeta = unknown> = {
  key: string;
  storage?: JourneyStorage;
  version?: number;
  clearOnReset?: boolean;
  serialize?: (value: JourneyPersistedState<TContext, TStepId, TStepMeta>) => string;
  deserialize?: (value: string) => unknown;
  migrate?: (
    value: unknown,
    persistedVersion: number
  ) => JourneyPersistedSnapshot<TContext, TStepId, TStepMeta>;
  onError?: (error: unknown) => void;
};

export type JourneyMachinePersistenceOptions<
  TContext,
  TStepId extends string,
  TStepMeta = unknown
> = JourneyMachineOptions & {
  persistence?: JourneyPersistenceOptions<TContext, TStepId, TStepMeta>;
};

type RequiredPersistenceFields<TContext, TStepId extends string, TStepMeta> = Required<
  Pick<
    JourneyPersistenceOptions<TContext, TStepId, TStepMeta>,
    "storage" | "version" | "clearOnReset" | "serialize" | "deserialize"
  >
>;

export type ResolvedPersistence<
  TContext,
  TStepId extends string,
  TStepMeta
> = JourneyPersistenceOptions<TContext, TStepId, TStepMeta> &
  RequiredPersistenceFields<TContext, TStepId, TStepMeta>;
