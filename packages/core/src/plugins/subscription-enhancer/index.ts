import type { JourneyPlugin, JourneyStatus, PluginHost, Unsubscribe } from "../../core/types";

type StatusChangeInfo = Parameters<Parameters<PluginHost["onStatusChange"]>[0]>[0];
type StatusListener = (info: StatusChangeInfo) => void;

/**
 * Lifecycle-filtered subscription conveniences — sugar over `statusChange`,
 * kept out of the base machine surface by design. Every helper returns its
 * unsubscribe function.
 */
export type SubscriptionEnhancerApi = {
  /** idle → running. */
  subscribeStart(listener: StatusListener): Unsubscribe;
  /** completed | terminated → running. */
  subscribeRestart(listener: StatusListener): Unsubscribe;
  subscribeComplete(listener: StatusListener): Unsubscribe;
  subscribeTerminate(listener: StatusListener): Unsubscribe;
  subscribePause(listener: StatusListener): Unsubscribe;
  subscribeResume(listener: StatusListener): Unsubscribe;
};

export function createSubscriptionEnhancerPlugin(): JourneyPlugin<
  "subscription-enhancer",
  SubscriptionEnhancerApi,
  never
> {
  return {
    name: "subscription-enhancer",
    setup(host) {
      const filtered =
        (matches: (previous: JourneyStatus, current: JourneyStatus) => boolean) =>
        (listener: StatusListener): Unsubscribe =>
          host.onStatusChange((info) => {
            if (matches(info.previous, info.current)) listener(info);
          });

      return {
        api: {
          subscribeStart: filtered(
            (previous, current) => previous === "idle" && current === "running"
          ),
          subscribeRestart: filtered(
            (previous, current) =>
              (previous === "completed" || previous === "terminated") && current === "running"
          ),
          subscribeComplete: filtered((_previous, current) => current === "completed"),
          subscribeTerminate: filtered((_previous, current) => current === "terminated"),
          subscribePause: filtered((_previous, current) => current === "paused"),
          subscribeResume: filtered(
            (previous, current) => previous === "paused" && current === "running"
          )
        }
      };
    }
  };
}
