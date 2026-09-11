/**
 * Every bundled plugin, behind one subpath.
 *
 * They used to have a subpath each, which made the import path a decision:
 * one path for analytics, another for replay, another for persistence, another
 * for execution paths — four ways to spell adding a plugin. Each
 * is still its own module internally and every factory is a named export, so
 * tree-shaking is unchanged: importing `createReplayPlugin` from here pulls in
 * replay and nothing else.
 */
// Re-exported here, not only from the root entry: every factory below returns a
// `JourneyPlugin`, and a consumer whose own inferred type mentions one needs to
// be able to name it from the same module it imported the factory from.
export type { AnyJourneyPlugin, JourneyPlugin, PluginApis, PluginHost } from "../core/types";

export { createAnalyticsPlugin, RECENT_EVENT_CAPACITY } from "./analytics/analytics";
export type {
  AnalyticsApi,
  AnalyticsPluginOptions,
  AnalyticsRecentEvent,
  AnalyticsTrackedEvent
} from "./analytics/analytics.types";

export { createExecutionPathsPlugin } from "./execution-paths/execution-paths";
export type {
  ExecutionPathsApi,
  ExecutionPathsPluginOptions,
  ExecutionPathsSnapshot
} from "./execution-paths/execution-paths.types";

export {
  buildPersistedState,
  createPersistencePlugin,
  DEFAULT_SAVE_REASONS,
  normalizeDebounceMs,
  parsePersistedState,
  persistOptionToPlugin
} from "./persistence/persistence";
export type {
  JourneyPersistedState,
  JourneyStorage,
  PersistenceApi,
  PersistencePluginOptions,
  PersistenceReason,
  PersistenceState
} from "./persistence/persistence.types";

export {
  createReplayPlugin,
  normalizeMaxEntries,
  serializeReplaySession,
  toSerializable
} from "./replay/replay";
export type {
  ReplayApi,
  ReplayEntry,
  ReplayEntryKind,
  ReplayExportOptions,
  ReplayPluginOptions,
  ReplaySession
} from "./replay/replay.types";
