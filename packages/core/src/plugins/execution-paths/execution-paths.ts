import type { ExecutionPathsApi, ExecutionPathsSnapshot } from "./execution-paths.types";
import type { JourneyPlugin } from "../../core/types";

export type { ExecutionPathsApi, ExecutionPathsSnapshot } from "./execution-paths.types";

/**
 * First-party plugin: tracks execution paths through the journey. Observes
 * transitions via the plugin host and contributes
 * `machine.plugins["execution-paths"]` and `snapshot.plugins["execution-paths"]`.
 */
export function createExecutionPathsPlugin(): JourneyPlugin<
  "execution-paths",
  ExecutionPathsApi,
  ExecutionPathsSnapshot
> {
  return {
    name: "execution-paths",
    setup(host) {
      let currentPath: string[] = [];
      const completedPaths: (readonly string[])[] = [];

      host.onTransition(({ to }) => {
        currentPath.push(to);
      });
      host.onStatusChange(({ current }) => {
        if ((current === "completed" || current === "terminated") && currentPath.length > 0) {
          completedPaths.push(Object.freeze([...currentPath]));
          currentPath = [];
        }
      });

      return {
        api: {
          getCurrentPath: () => Object.freeze([...currentPath]),
          getCompletedPaths: () => Object.freeze([...completedPaths])
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
