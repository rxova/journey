import type {
  JourneyBaseEvent,
  JourneyJsonObject,
  JourneyMachine,
  JourneyMachinePlugin,
  JourneyObservationEvent,
  JourneyReplayEntry,
  JourneyReplayExportOptions,
  JourneyReplayPluginOptions,
  JourneyReplaySession,
  JourneySnapshot
} from "../../types";
import type { JourneyEmpty } from "../../types";

const normalizeMaxEntries = (value: number | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 500;
  }

  return Math.max(1, Math.trunc(value));
};

const toSerializable = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "undefined") {
    return null;
  }

  if (typeof value === "function" || typeof value === "symbol") {
    return `[unsupported:${typeof value}]`;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(value.stack ? { stack: value.stack } : {})
    };
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toSerializable(item, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[circular]";
    }

    seen.add(value);
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = toSerializable(item, seen);
    }
    seen.delete(value);
    return output;
  }

  return String(value);
};

/** Serializes a replay session into a JSON string safe for logging or export. */
export const serializeReplaySession = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never
>(
  session: JourneyReplaySession<TContext, TStepId, TEvents>,
  options?: JourneyReplayExportOptions
) => JSON.stringify(toSerializable(session), null, options?.pretty ? 2 : undefined);

export type JourneyReplayMachineExtension<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never
> = {
  getReplaySession: () => JourneyReplaySession<TContext, TStepId, TEvents>;
  clearReplaySession: () => void;
  exportReplaySession: (options?: JourneyReplayExportOptions) => string;
};

export type JourneyReplayMachine<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = JourneyMachine<TContext, TStepId, TEvents, TStepMeta, THandlers> &
  JourneyReplayMachineExtension<TContext, TStepId, TEvents>;

/** Creates a plugin that records snapshot and lifecycle activity into a replay session. */
export const createReplayPlugin = (options: JourneyReplayPluginOptions = {}) => {
  const captureEvents = options.captureEvents ?? true;
  const captureSnapshots = options.captureSnapshots ?? true;
  const maxEntries = normalizeMaxEntries(options.maxEntries);

  return {
    name: "replay",
    __extension__: undefined as unknown as JourneyReplayMachineExtension<
      JourneyJsonObject,
      string,
      JourneyBaseEvent
    >,
    // Per-instance state lives inside `setup()` (called once per machine) so a
    // single plugin instance reused across machines never shares its buffer.
    setup: () => {
      let initialSnapshot: JourneySnapshot<JourneyJsonObject, string> | null = null;
      const entries: JourneyReplayEntry<JourneyJsonObject, string, JourneyBaseEvent>[] = [];
      let truncated = false;
      let unsubscribeEvents: (() => void) | undefined;

      const pushEntry = (
        entry: JourneyReplayEntry<JourneyJsonObject, string, JourneyBaseEvent>
      ) => {
        if (entries.length >= maxEntries) {
          entries.shift();
          truncated = true;
        }

        entries.push(entry);
      };

      const buildSession = () =>
        ({
          version: 1 as const,
          initialSnapshot,
          entries: [...entries],
          truncated
        }) satisfies JourneyReplaySession<JourneyJsonObject, string, JourneyBaseEvent>;

      return {
        hydrateSnapshot: (snapshot) => {
          initialSnapshot = snapshot as JourneySnapshot<JourneyJsonObject, string>;
          return snapshot;
        },
        onSnapshotChange: ({ snapshot, reason }) => {
          if (!captureSnapshots) {
            return;
          }

          pushEntry({
            kind: "snapshot",
            timestamp: Date.now(),
            reason,
            snapshot: snapshot as JourneySnapshot<JourneyJsonObject, string>
          });
        },
        augmentMachine: ({ machine }) => {
          if (captureEvents) {
            unsubscribeEvents = machine.subscribeEvent((event) => {
              pushEntry({
                kind: "event",
                timestamp: event.timestamp,
                event: event as JourneyObservationEvent<string, JourneyBaseEvent>
              });
            });
          }

          return {
            getReplaySession: () =>
              buildSession() as JourneyReplaySession<JourneyJsonObject, string, JourneyBaseEvent>,
            clearReplaySession: () => {
              initialSnapshot = machine.getSnapshot() as JourneySnapshot<JourneyJsonObject, string>;
              entries.length = 0;
              truncated = false;
            },
            exportReplaySession: (exportOptions?: JourneyReplayExportOptions) =>
              serializeReplaySession(buildSession(), exportOptions)
          };
        },
        getDevtoolsFeatures: () => [
          {
            id: "replay",
            label: "Replay",
            operations: [
              {
                id: "replay.inspectSession",
                label: "inspectSession",
                mutates: false,
                output: "data",
                run: () => ({
                  kind: "data",
                  data: buildSession()
                })
              },
              {
                id: "replay.exportSession",
                label: "exportSession",
                mutates: false,
                output: "text",
                fields: [{ key: "pretty", label: "pretty", type: "boolean" }],
                run: ({ input }) => ({
                  kind: "text",
                  text: serializeReplaySession(buildSession(), {
                    pretty: input?.pretty === true
                  })
                })
              },
              {
                id: "replay.clearSession",
                label: "clearSession",
                mutates: true,
                output: "void",
                run: ({ machine }) => {
                  initialSnapshot = machine.getSnapshot() as JourneySnapshot<
                    JourneyJsonObject,
                    string
                  >;
                  entries.length = 0;
                  truncated = false;
                  return { kind: "void" };
                }
              }
            ]
          }
        ],
        dispose: () => {
          unsubscribeEvents?.();
        }
      };
    }
  } satisfies JourneyMachinePlugin;
};
