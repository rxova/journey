/**
 * Every bundled plugin, behind one subpath.
 *
 * Each plugin is its own module internally and every factory is a named
 * export, so tree-shaking is unaffected: importing a factory from here pulls
 * in that plugin and nothing else.
 */
// Re-exported here, not only from the root entry: every factory below returns a
// `JourneyPlugin`, and a consumer whose own inferred type mentions one needs to
// be able to name it from the same module it imported the factory from.
export type { AnyJourneyPlugin, JourneyPlugin, PluginApis, PluginHost } from "../core/types";

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
