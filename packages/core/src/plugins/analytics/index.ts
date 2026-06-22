import { warnInDevelopment } from "../../journey-machine/helpers";

import type {
  JourneyBaseEvent,
  JourneyAnalyticsPluginOptions,
  JourneyAnalyticsTrackedEvent,
  JourneyJsonObject,
  JourneyMachine,
  JourneyMachinePlugin,
  JourneyObservationEvent,
  JourneyTerminal
} from "../../types";
import type { JourneyEmpty } from "../../types";

const buildBasePayload = <TContext extends JourneyJsonObject>({
  context
}: {
  context: TContext;
}) => ({ context });

export type JourneyAnalyticsMachineExtension<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TStepMeta
> = {
  trackAnalyticsEvent: (
    name: string,
    payload?: Record<string, unknown>
  ) => JourneyAnalyticsTrackedEvent<TContext, TStepId, TStepMeta>;
};

export type JourneyAnalyticsMachine<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = JourneyMachine<TContext, TStepId, TEvents, TStepMeta, THandlers> &
  JourneyAnalyticsMachineExtension<TContext, TStepId, TStepMeta>;

/** Creates a plugin that converts journey observation events into analytics envelopes. */
export const createAnalyticsPlugin = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown
>(
  options: JourneyAnalyticsPluginOptions<TContext, TStepId, TEvents, TStepMeta>
) => {
  type RecentEvent = {
    source: "lifecycle" | "custom";
    timestamp: number;
    tracked: JourneyAnalyticsTrackedEvent<TContext, TStepId, TStepMeta>;
    success: boolean;
    error?: unknown;
  };
  const RECENT_EVENT_CAPACITY = 100;
  const recentEventsBuffer: (RecentEvent | undefined)[] = new Array(RECENT_EVENT_CAPACITY);
  let recentEventsWriteIndex = 0;
  let recentEventsCount = 0;
  const pushRecentEvent = (entry: RecentEvent) => {
    recentEventsBuffer[recentEventsWriteIndex] = entry;
    recentEventsWriteIndex = (recentEventsWriteIndex + 1) % RECENT_EVENT_CAPACITY;
    if (recentEventsCount < RECENT_EVENT_CAPACITY) recentEventsCount++;
  };
  const snapshotRecentEvents = (): RecentEvent[] => {
    if (recentEventsCount < RECENT_EVENT_CAPACITY) {
      return recentEventsBuffer.slice(0, recentEventsCount) as RecentEvent[];
    }
    return [
      ...recentEventsBuffer.slice(recentEventsWriteIndex),
      ...recentEventsBuffer.slice(0, recentEventsWriteIndex)
    ] as RecentEvent[];
  };
  const clearRecentEvents = () => {
    for (let index = 0; index < RECENT_EVENT_CAPACITY; index++) {
      recentEventsBuffer[index] = undefined;
    }
    recentEventsWriteIndex = 0;
    recentEventsCount = 0;
  };
  let unsubscribe: (() => void) | undefined;
  let startedAt: number | null = null;
  let activeStepEnteredAt: number | null = null;
  let trackCustomEvent = (name: string, payload: Record<string, unknown> = {}) => {
    const tracked = {
      name,
      timestamp: Date.now(),
      ...(options.machineId ? { machineId: options.machineId } : {}),
      payload
    } satisfies JourneyAnalyticsTrackedEvent<TContext, TStepId, TStepMeta>;
    trackSafely(tracked, tracked);
    return tracked;
  };

  const trackSafely = (
    event:
      | JourneyObservationEvent<TStepId, TEvents>
      | JourneyAnalyticsTrackedEvent<TContext, TStepId, TStepMeta>,
    tracked: JourneyAnalyticsTrackedEvent<TContext, TStepId, TStepMeta>
  ) => {
    try {
      options.track(tracked);
      pushRecentEvent({
        source: "name" in event ? "custom" : "lifecycle",
        timestamp: tracked.timestamp,
        tracked,
        success: true
      });
    } catch (error) {
      pushRecentEvent({
        source: "name" in event ? "custom" : "lifecycle",
        timestamp: tracked.timestamp,
        tracked,
        success: false,
        error
      });
      if (options.onError) {
        options.onError(error, event);
        return;
      }

      warnInDevelopment("Journey analytics track() threw without an onError handler.", error);
    }
  };

  return {
    name: "analytics",
    __extension__: undefined as unknown as JourneyAnalyticsMachineExtension<
      TContext,
      TStepId,
      TStepMeta
    >,
    setup: () => ({
      augmentMachine: ({ machine }) => {
        const typedMachine = machine as JourneyMachine<
          TContext,
          TStepId,
          TEvents,
          TStepMeta,
          Record<string, unknown>
        >;

        const emitTracked = (
          sourceEvent: JourneyObservationEvent<TStepId, TEvents>,
          tracked: JourneyAnalyticsTrackedEvent<TContext, TStepId, TStepMeta>
        ) => {
          trackSafely(sourceEvent, tracked);
        };

        const buildStepMetaPayload = (stepId: TStepId) => {
          if (!options.includeStepMeta) {
            return {};
          }

          const stepMeta = typedMachine.getStepMeta(stepId) as TStepMeta | undefined;
          return stepMeta === undefined ? {} : { stepMeta };
        };

        const buildTransitionMetaPayload = ({
          from,
          to
        }: {
          from: TStepId;
          to: TStepId | JourneyTerminal;
        }) => {
          if (!options.includeStepMeta) {
            return {};
          }

          const fromStepMeta = typedMachine.getStepMeta(from) as TStepMeta | undefined;
          const toStepMeta =
            to === "COMPLETE" || to === "TERMINATED"
              ? undefined
              : (typedMachine.getStepMeta(to) as TStepMeta | undefined);

          return {
            ...(fromStepMeta === undefined ? {} : { fromStepMeta }),
            ...(toStepMeta === undefined ? {} : { toStepMeta })
          };
        };

        unsubscribe = typedMachine.subscribeEvent((event) => {
          const typedEvent = event as JourneyObservationEvent<TStepId, TEvents>;
          const snapshot = typedMachine.getSnapshot();
          const basePayload = buildBasePayload({
            context: snapshot.context as TContext
          });

          switch (typedEvent.type) {
            case "journey.start":
              startedAt = typedEvent.timestamp;
              activeStepEnteredAt = typedEvent.timestamp;
              emitTracked(typedEvent, {
                name: "journey_started",
                timestamp: typedEvent.timestamp,
                ...(options.machineId ? { machineId: options.machineId } : {}),
                payload: {
                  stepId: typedEvent.stepId,
                  ...buildStepMetaPayload(typedEvent.stepId),
                  ...basePayload
                }
              });
              return;
            case "step.enter":
              activeStepEnteredAt = typedEvent.timestamp;
              emitTracked(typedEvent, {
                name: "step_viewed",
                timestamp: typedEvent.timestamp,
                ...(options.machineId ? { machineId: options.machineId } : {}),
                payload: {
                  stepId: typedEvent.stepId,
                  ...buildStepMetaPayload(typedEvent.stepId),
                  ...basePayload
                }
              });
              return;
            case "step.exit":
              emitTracked(typedEvent, {
                name: "step_exited",
                timestamp: typedEvent.timestamp,
                ...(options.machineId ? { machineId: options.machineId } : {}),
                payload: {
                  stepId: typedEvent.stepId,
                  ...(activeStepEnteredAt === null
                    ? {}
                    : { dwellMs: Math.max(0, typedEvent.timestamp - activeStepEnteredAt) }),
                  ...buildStepMetaPayload(typedEvent.stepId),
                  ...basePayload
                }
              });
              return;
            case "transition.start":
              emitTracked(typedEvent, {
                name: "transition_started",
                timestamp: typedEvent.timestamp,
                ...(options.machineId ? { machineId: options.machineId } : {}),
                payload: {
                  from: typedEvent.from,
                  eventType: typedEvent.event.type,
                  ...basePayload
                }
              });
              return;
            case "transition.success":
              emitTracked(typedEvent, {
                name: "transition_succeeded",
                timestamp: typedEvent.timestamp,
                ...(options.machineId ? { machineId: options.machineId } : {}),
                payload: {
                  from: typedEvent.from,
                  to: typedEvent.to,
                  eventType: typedEvent.eventType,
                  transitionId: typedEvent.transitionId,
                  ...(typedEvent.label !== undefined ? { label: typedEvent.label } : {}),
                  ...buildTransitionMetaPayload({
                    from: typedEvent.from,
                    to: typedEvent.to as TStepId | JourneyTerminal
                  }),
                  ...basePayload
                }
              });
              return;
            case "transition.error":
              emitTracked(typedEvent, {
                name: "transition_failed",
                timestamp: typedEvent.timestamp,
                ...(options.machineId ? { machineId: options.machineId } : {}),
                payload: {
                  from: typedEvent.from,
                  eventType: typedEvent.eventType,
                  transitionId: typedEvent.transitionId,
                  ...(typedEvent.label !== undefined ? { label: typedEvent.label } : {}),
                  error: typedEvent.error,
                  ...basePayload
                }
              });
              return;
            case "journey.completed":
              emitTracked(typedEvent, {
                name: "journey_completed",
                timestamp: typedEvent.timestamp,
                ...(options.machineId ? { machineId: options.machineId } : {}),
                payload: {
                  stepId: typedEvent.stepId,
                  ...(startedAt === null
                    ? {}
                    : { durationMs: Math.max(0, typedEvent.timestamp - startedAt) }),
                  ...buildStepMetaPayload(typedEvent.stepId),
                  ...basePayload
                }
              });
              return;
            case "journey.terminated":
              emitTracked(typedEvent, {
                name: "journey_terminated",
                timestamp: typedEvent.timestamp,
                ...(options.machineId ? { machineId: options.machineId } : {}),
                payload: {
                  stepId: typedEvent.stepId,
                  ...(startedAt === null
                    ? {}
                    : { durationMs: Math.max(0, typedEvent.timestamp - startedAt) }),
                  ...buildStepMetaPayload(typedEvent.stepId),
                  ...basePayload
                }
              });
              return;
            case "navigation.previous":
              emitTracked(typedEvent, {
                name: "navigation_previous",
                timestamp: typedEvent.timestamp,
                ...(options.machineId ? { machineId: options.machineId } : {}),
                payload: {
                  from: typedEvent.from,
                  to: typedEvent.to,
                  requestedSteps: typedEvent.requestedSteps,
                  appliedSteps: typedEvent.appliedSteps,
                  ...buildTransitionMetaPayload({
                    from: typedEvent.from,
                    to: typedEvent.to
                  }),
                  ...basePayload
                }
              });
              return;
            case "navigation.lastVisited":
              emitTracked(typedEvent, {
                name: "navigation_last_visited",
                timestamp: typedEvent.timestamp,
                ...(options.machineId ? { machineId: options.machineId } : {}),
                payload: {
                  from: typedEvent.from,
                  to: typedEvent.to,
                  ...buildTransitionMetaPayload({
                    from: typedEvent.from,
                    to: typedEvent.to
                  }),
                  ...basePayload
                }
              });
              return;
          }
        });

        trackCustomEvent = (name: string, payload: Record<string, unknown> = {}) => {
          const tracked = {
            name,
            timestamp: Date.now(),
            ...(options.machineId ? { machineId: options.machineId } : {}),
            payload
          } satisfies JourneyAnalyticsTrackedEvent<TContext, TStepId, TStepMeta>;
          trackSafely(tracked, tracked);
          return tracked;
        };

        return {
          trackAnalyticsEvent: trackCustomEvent
        };
      },
      getDevtoolsFeatures: () => [
        {
          id: "analytics",
          label: "Analytics",
          operations: [
            {
              id: "analytics.inspectRecentEvents",
              label: "inspectRecentEvents",
              mutates: false,
              output: "data",
              run: () => ({
                kind: "data",
                data: {
                  machineId: options.machineId ?? null,
                  includeStepMeta: options.includeStepMeta ?? false,
                  bufferSize: RECENT_EVENT_CAPACITY,
                  entries: snapshotRecentEvents()
                }
              })
            },
            {
              id: "analytics.trackCustomEvent",
              label: "trackCustomEvent",
              mutates: true,
              output: "data",
              fields: [
                { key: "name", label: "name", type: "text", required: true },
                { key: "payload", label: "payload", type: "json" }
              ],
              run: ({ input }) => ({
                kind: "data",
                data: trackCustomEvent(
                  String(input?.name ?? ""),
                  (input?.payload as Record<string, unknown> | undefined) ?? {}
                )
              })
            },
            {
              id: "analytics.clearRecentEvents",
              label: "clearRecentEvents",
              mutates: true,
              output: "void",
              run: () => {
                clearRecentEvents();
                return { kind: "void" };
              }
            }
          ]
        }
      ],
      dispose: () => {
        unsubscribe?.();
      }
    })
  } satisfies JourneyMachinePlugin;
};

export type { JourneyAnalyticsPluginOptions, JourneyAnalyticsTrackedEvent } from "../../types";
