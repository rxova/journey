import type {
  ExecutionPathsApi,
  ExecutionPathsPluginOptions,
  ExecutionPathsSnapshot
} from "./execution-paths.types";
import type { JourneyPlugin } from "../../core/types";

export type {
  ExecutionPathsApi,
  ExecutionPathsPluginOptions,
  ExecutionPathsSnapshot
} from "./execution-paths.types";

/** Retained finished runs. Diagnostic history, so a modest bound is enough. */
const DEFAULT_MAX_PATHS = 50;

/**
 * First-party plugin: tracks execution paths through the journey. Observes
 * transitions via the plugin host and contributes
 * `machine.plugins["execution-paths"]` and `snapshot.plugins["execution-paths"]`.
 */
export function createExecutionPathsPlugin(
  options: ExecutionPathsPluginOptions = {}
): JourneyPlugin<"execution-paths", ExecutionPathsApi, ExecutionPathsSnapshot> {
  const maxPaths = options.maxPaths ?? DEFAULT_MAX_PATHS;
  return {
    name: "execution-paths",
    setup(host) {
      let currentPath: string[] = [];
      let completedPaths: (readonly string[])[] = [];

      host.onTransition(({ to }) => {
        currentPath.push(to);
      });
      host.onStatusChange(({ current }) => {
        if ((current === "completed" || current === "terminated") && currentPath.length > 0) {
          completedPaths.push(Object.freeze([...currentPath]));
          // Newest kept: a machine that completes and restarts on a loop would
          // otherwise retain one frozen array per run, forever.
          if (completedPaths.length > maxPaths) {
            completedPaths = completedPaths.slice(completedPaths.length - maxPaths);
          }
          currentPath = [];
        }
      });

      return {
        api: {
          getCurrentPath: () => Object.freeze([...currentPath]),
          getCompletedPaths: () => Object.freeze([...completedPaths]),
          clearCompletedPaths: () => {
            completedPaths = [];
          }
        },
        deriveSnapshot: (_snapshot, previous) => {
          if (
            previous &&
            previous.currentPath.length === currentPath.length &&
            previous.completedPaths.length === completedPaths.length
          ) {
            return previous;
          }
          return Object.freeze({
            currentPath: Object.freeze([...currentPath]),
            completedPaths: Object.freeze([...completedPaths])
          });
        }
      };
    }
  };
}
