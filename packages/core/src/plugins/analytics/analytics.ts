import { RECENT_EVENT_CAPACITY } from "./analytics.helpers";

export { RECENT_EVENT_CAPACITY } from "./analytics.helpers";
import type {
  AnalyticsApi,
  AnalyticsPluginOptions,
  AnalyticsRecentEvent,
  AnalyticsTrackedEvent
} from "./analytics.types";
import type { JourneyPlugin } from "../../core/types";

export type {
  AnalyticsApi,
  AnalyticsPluginOptions,
  AnalyticsRecentEvent,
  AnalyticsTrackedEvent
} from "./analytics.types";

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
          // The error handler sits inside the guard: a throwing onError used to
          // escape trackSafely, which made "the sink failed" indistinguishable
          // from "your error handler failed" at the isolation boundary.
          try {
            options.onError?.(error, tracked);
          } catch (handlerError) {
            host.reportError(handlerError);
          }
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
