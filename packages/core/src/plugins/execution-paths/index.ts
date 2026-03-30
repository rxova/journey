import { getExecutionPaths } from "./execution-paths";

import type {
  JourneyExecutionPathOptions,
  JourneyExecutionPathsResult,
  JourneyFullEventType,
  JourneyJsonObject,
  JourneyMachine,
  JourneyMachinePlugin
} from "../../types";

export type JourneyExecutionPathsMachineExtension<
  TStepId extends string,
  TEventType extends string
> = {
  getExecutionPaths: (
    options?: JourneyExecutionPathOptions
  ) => JourneyExecutionPathsResult<TStepId, TEventType>;
};

export type JourneyExecutionPathsMachine<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>
> = JourneyMachine<TContext, TStepId, TEventMap, TStepMeta, THandlers> &
  JourneyExecutionPathsMachineExtension<TStepId, JourneyFullEventType<TEventMap>>;

/**
 * Creates a plugin that augments a machine with structural execution-path
 * enumeration without pulling graph code into the base entrypoint.
 */
export const createExecutionPathsPlugin = () =>
  ({
    name: "execution-paths",
    setup: ({ resolvedJourney }) => ({
      augmentMachine: () => ({
        getExecutionPaths: (options?: JourneyExecutionPathOptions) =>
          getExecutionPaths(resolvedJourney, options)
      })
    })
  }) satisfies JourneyMachinePlugin;

export { getExecutionPaths } from "./execution-paths";
