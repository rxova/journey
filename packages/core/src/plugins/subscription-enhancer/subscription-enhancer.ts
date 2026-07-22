import type { StatusListener, SubscriptionEnhancerApi } from "./subscription-enhancer.types";
import type { JourneyPlugin, JourneyStatus, Unsubscribe } from "../../core/types";

export type {
  StatusChangeInfo,
  StatusListener,
  SubscriptionEnhancerApi
} from "./subscription-enhancer.types";

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
