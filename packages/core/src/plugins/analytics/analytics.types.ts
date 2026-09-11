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
