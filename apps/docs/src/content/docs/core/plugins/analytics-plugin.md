---
id: analytics-plugin
title: Analytics
---

# Analytics

The analytics plugin converts runtime observations into a stable event envelope and sends them to
your analytics sink.

## Install and use

```ts
import { createAnalyticsPlugin } from "@rxova/journey-core/analytics";

const machine = createGraphJourney(definition, {
  plugins: [
    createAnalyticsPlugin({
      track: (event) => analytics.track(event.name, event.payload),
      onError: (error, event) => report(error, event)
    })
  ]
});
```

Lifecycle names include `journey.transition`, `journey.navigationBlocked`, `journey.error`, and
`journey.<status>`.

## Event envelope

```ts
type AnalyticsTrackedEvent = {
  name: string;
  timestamp: number;
  stepId: string | null;
  payload: Readonly<Record<string, unknown>>;
};
```

Sink exceptions are captured and never rethrown into the journey pipeline.

## API

```ts
const api = machine.plugins.analytics;

api.trackAnalyticsEvent("coupon_applied", { code: "SAVE20" });
api.getRecentEvents(); // last 100 successes and failures
api.clearRecentEvents();
```

`now` may be supplied as an injectable clock for tests.

## Where to next

- [Plugins](./overview)
- [Writing a plugin](./authoring)
