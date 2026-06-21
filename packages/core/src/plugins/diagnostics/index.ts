import { getJourneyDiagnostics } from "./diagnostics";

import type {
  JourneyDiagnosticsOptions,
  JourneyDiagnosticsResult,
  JourneyFullEventType,
  JourneyJsonObject,
  JourneyMachine,
  JourneyMachinePlugin
} from "../../types";
import type { JourneyEmpty } from "../../types";

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
  TEventMap extends Record<string, unknown> = JourneyEmpty,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = JourneyMachine<TContext, TStepId, TEventMap, TStepMeta, THandlers> &
  JourneyDiagnosticsMachineExtension<TStepId, JourneyFullEventType<TEventMap>>;

/** Creates a plugin that augments a machine with structural diagnostics helpers. */
export const createDiagnosticsPlugin = () =>
  ({
    name: "diagnostics",
    __extension__: undefined as unknown as JourneyDiagnosticsMachineExtension<string, string>,
    setup: ({ journey, options }) => ({
      augmentMachine: () => ({
        getDiagnostics: (diagnosticsOptions?: JourneyDiagnosticsOptions) =>
          getJourneyDiagnostics(journey, {
            requireExplicitCompletion:
              diagnosticsOptions?.requireExplicitCompletion ?? options.requireExplicitCompletion
          })
      }),
      getDevtoolsFeatures: () => [
        {
          id: "diagnostics",
          label: "Diagnostics",
          operations: [
            {
              id: "diagnostics.inspect",
              label: "inspect",
              mutates: false,
              output: "data",
              fields: [
                {
                  key: "requireExplicitCompletion",
                  label: "requireExplicitCompletion",
                  type: "boolean"
                }
              ],
              run: ({ input }) => ({
                kind: "data",
                data: getJourneyDiagnostics(journey, {
                  requireExplicitCompletion:
                    typeof input?.requireExplicitCompletion === "boolean"
                      ? input.requireExplicitCompletion
                      : options.requireExplicitCompletion
                })
              })
            }
          ]
        }
      ]
    })
  }) satisfies JourneyMachinePlugin;

export { getJourneyDiagnostics } from "./diagnostics";
