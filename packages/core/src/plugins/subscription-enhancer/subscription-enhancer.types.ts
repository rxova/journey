import type { PluginHost, Unsubscribe } from "../../core/types";

export type StatusChangeInfo = Parameters<Parameters<PluginHost["onStatusChange"]>[0]>[0];
export type StatusListener = (info: StatusChangeInfo) => void;

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
