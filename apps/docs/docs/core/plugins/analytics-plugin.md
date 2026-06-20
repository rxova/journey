---
title: Analytics
sidebar_label: Analytics
---

# Analytics

The analytics plugin turns Journey's lifecycle events into normalized analytics envelopes and
forwards them to your client. It doesn't touch transition behavior — it listens and reports, so your
transition logic stays free of tracking calls.

## Install and use

```ts
import { createGraphJourney } from "@rxova/journey-core";
import { createAnalyticsPlugin } from "@rxova/journey-core/analytics";

const machine = createGraphJourney(journey, {
  plugins: [
    createAnalyticsPlugin({
      machineId: "checkout",
      includeStepMeta: true,
      track: (event) => analytics.track(event.name, event.payload)
    })
  ]
});
```

## What you get

The plugin emits a normalized event for each lifecycle moment, and adds one method for your own
custom markers:

```ts
machine.trackAnalyticsEvent(name, payload);
```

The built-in event names:

`journey_started`, `step_viewed`, `step_exited`, `transition_started`, `transition_succeeded`,
`transition_failed`, `journey_completed`, `journey_terminated`, `navigation_previous`,
`navigation_last_visited`.

Every event carries `name`, `timestamp`, `payload`, and an optional `machineId`. Depending on the
event, the payload may include the raw `context`, `stepId`, `from`, `to`, `eventType`,
`transitionId`, `dwellMs`, `durationMs`, and step metadata (`stepMeta`, `fromStepMeta`,
`toStepMeta`). `payload.context` always holds the raw machine context from the current snapshot.

## Options

| Option                  | What it does                                          |
| ----------------------- | ----------------------------------------------------- |
| `track(event)`          | Your analytics sink                                   |
| `machineId`             | Optional id included on every tracked event           |
| `includeStepMeta`       | Include step metadata in payloads                     |
| `onError(error, event)` | Handle a tracker failure without breaking the machine |

## Gotchas

:::warning
A throwing `track(...)` never breaks the machine. The failure goes to `onError` if you provided it,
otherwise a development warning — and transitions, navigation, and commits carry on. Analytics is a
side channel, never a gate.
:::

## Where to next

- [Lifecycle & events](/docs/core/lifecycle) — the raw events these envelopes normalize.
- [Writing a plugin](/docs/core/plugins/authoring) — build a tracker tuned to your own schema.
