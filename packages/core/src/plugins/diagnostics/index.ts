import { getJourneyDiagnostics } from "./diagnostics";

import type {
  JourneyDiagnosticsOptions,
  JourneyDiagnosticsResult,
  JourneyFullEventType,
  JourneyJsonObject,
  JourneyMachine,
  JourneyMachinePlugin
} from "../../types";

export type JourneyDiagnosticsMachineExtension<
  TStepId extends string,
  TEventType extends string
> = {
  getDiagnostics: (
    options?: JourneyDiagnosticsOptions
  ) => JourneyDiagnosticsResult<TStepId, TEventType>;
};

export type JourneyDiagnosticsMachine<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>
> = JourneyMachine<TContext, TStepId, TEventMap, TStepMeta, THandlers> &
  JourneyDiagnosticsMachineExtension<TStepId, JourneyFullEventType<TEventMap>>;

/** Creates a plugin that augments a machine with structural diagnostics helpers. */
export const createDiagnosticsPlugin = () =>
  ({
    name: "diagnostics",
    setup: ({ journey, options }) => ({
      augmentMachine: () => ({
        getDiagnostics: (diagnosticsOptions?: JourneyDiagnosticsOptions) =>
          getJourneyDiagnostics(journey, {
            requireExplicitCompletion:
              diagnosticsOptions?.requireExplicitCompletion ?? options.requireExplicitCompletion
          })
      })
    })
  }) satisfies JourneyMachinePlugin;

export { getJourneyDiagnostics } from "./diagnostics";
