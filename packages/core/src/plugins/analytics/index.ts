import type { JourneyPlugin } from "../../core/types";

export type AnalyticsTrackedEvent = {
  readonly name: string;
  readonly timestamp: number;
  readonly stepId: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
};

export type AnalyticsRecentEvent = {
  readonly source: "lifecycle" | "custom";
  readonly tracked: AnalyticsTrackedEvent;
  readonly success: boolean;
  readonly error?: unknown;
};

export type AnalyticsPluginOptions = {
  /** The analytics sink. Exceptions are captured, never rethrown. */
  track(event: AnalyticsTrackedEvent): void;
  /** Called when `track` throws; without it failures only land in the buffer. */
  onError?(error: unknown, event: AnalyticsTrackedEvent): void;
  /** Injectable clock, mainly for tests. */
  now?: () => number;
};

export type AnalyticsApi = {
  /** Tracks a custom event through the same safe pipeline. */
  trackAnalyticsEvent(name: string, payload?: Record<string, unknown>): AnalyticsTrackedEvent;
  /** The last 100 tracked events (successes and failures). */
  getRecentEvents(): readonly AnalyticsRecentEvent[];
  clearRecentEvents(): void;
};

const RECENT_EVENT_CAPACITY = 100;

/**
 * Converts journey observations (transitions, lifecycle, blocked navigations,
 * errors) into analytics envelopes delivered to the configured sink.
 */
export function createAnalyticsPlugin(
  options: AnalyticsPluginOptions
): JourneyPlugin<"analytics", AnalyticsApi, never> {
  const now = options.now ?? Date.now;

  return {
    name: "analytics",
    // Per-instance state lives inside `setup()` (called once per machine) so a
    // single plugin instance reused across machines never shares its buffer.
    setup(host) {
      let recent: AnalyticsRecentEvent[] = [];

      const record = (entry: AnalyticsRecentEvent) => {
        recent.push(entry);
        if (recent.length > RECENT_EVENT_CAPACITY) {
          recent = recent.slice(recent.length - RECENT_EVENT_CAPACITY);
        }
      };

      const trackSafely = (
        source: AnalyticsRecentEvent["source"],
        name: string,
        payload: Record<string, unknown>
      ): AnalyticsTrackedEvent => {
        const tracked: AnalyticsTrackedEvent = {
          name,
          timestamp: now(),
          stepId: host.getSnapshot().currentStep?.id ?? null,
          payload
        };
        try {
          options.track(tracked);
          record({ source, tracked, success: true });
        } catch (error) {
          record({ source, tracked, success: false, error });
          options.onError?.(error, tracked);
        }
        return tracked;
      };

      host.onTransition(({ from, to }) => {
        trackSafely("lifecycle", "journey.transition", { from, to });
      });
      host.onStatusChange(({ previous, current }) => {
        trackSafely("lifecycle", `journey.${current}`, { previous });
      });
      host.onNavigationBlocked(({ reason, from, to }) => {
        trackSafely("lifecycle", "journey.navigationBlocked", { reason, from, to });
      });
      host.onError(({ phase, stepId, error }) => {
        trackSafely("lifecycle", "journey.error", { phase, stepId, error });
      });

      return {
        api: {
          trackAnalyticsEvent: (name, payload = {}) => trackSafely("custom", name, payload),
          getRecentEvents: () => [...recent],
          clearRecentEvents: () => {
            recent = [];
          }
        }
      };
    }
  };
}
